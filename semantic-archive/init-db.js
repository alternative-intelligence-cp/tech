#!/usr/bin/env node
/**
 * Database initialization script
 * Creates the knowledge graph schema with pgvector support
 */

const { Client } = require('pg');
const config = require('./config');

async function initializeDatabase() {
  const client = new Client(config.postgres);
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create extensions
    console.log('Creating extensions...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('✓ Extensions created');

    // Create entity table
    console.log('Creating entity table...');
    await client.query('DROP TABLE IF EXISTS public.entity CASCADE');
    await client.query('DROP TABLE IF EXISTS public.relationship CASCADE');
    await client.query(`
      CREATE TABLE public.entity (
        id text PRIMARY KEY,
        _type text NOT NULL,
        _class text NOT NULL,
        content text,
        embedding vector(4096),
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT current_timestamp
      )
    `);
    console.log('✓ Entity table created');

    // Create indexes
    console.log('Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS entity_class_idx ON entity (_class)');
    await client.query('CREATE INDEX IF NOT EXISTS entity_type_idx ON entity (_type)');
    // Note: Vector index omitted due to pgvector 2000-dimension limit with qwen3-embedding:8b (3584 dims)
    // Vector search will use sequential scan - acceptable for moderate dataset sizes
    console.log('✓ Indexes created');

    // Create relationship table
    console.log('Creating relationship table...');
    await client.query(`
      CREATE TABLE public.relationship (
        source_entity_id text NOT NULL REFERENCES public.entity (id) ON DELETE CASCADE,
        target_entity_id text NOT NULL REFERENCES public.entity (id) ON DELETE CASCADE,
        _class text NOT NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        PRIMARY KEY (source_entity_id, target_entity_id, _class),
        CHECK (source_entity_id != target_entity_id)
      )
    `);
    await client.query('CREATE INDEX relationship_class_idx ON relationship (_class)');
    console.log('✓ Relationship table created');

    // Create cycle detection function
    console.log('Creating cycle detection function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION has_cycle(input_source_node text, input_target_node text)
      RETURNS BOOLEAN LANGUAGE plpgsql AS $$
      DECLARE rec RECORD;
      BEGIN
        FOR rec IN
          WITH RECURSIVE traversed AS (
            SELECT ARRAY[input_source_node] AS path, input_target_node AS target_node_id
            UNION ALL
            SELECT traversed.path || relationship.source_entity_id, relationship.target_entity_id
            FROM traversed
            JOIN relationship ON relationship.source_entity_id = traversed.target_node_id
          )
          SELECT * FROM traversed
        LOOP
          IF rec.target_node_id = ANY(rec.path) THEN RETURN TRUE; END IF;
        END LOOP;
        RETURN FALSE;
      END; $$
    `);
    
    // Add cycle check constraint
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE relationship ADD CONSTRAINT check_no_cycles 
        CHECK (NOT has_cycle(source_entity_id, target_entity_id));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
    console.log('✓ Cycle detection enabled');

    // Create custom text search configuration for codebase
    console.log('Creating custom text search configuration...');
    
    // Drop existing if any
    await client.query('DROP TEXT SEARCH CONFIGURATION IF EXISTS codebase_search CASCADE');
    await client.query('DROP TEXT SEARCH DICTIONARY IF EXISTS custom_codebase_dict CASCADE');
    
    await client.query(`
      CREATE TEXT SEARCH DICTIONARY custom_codebase_dict (
        TEMPLATE = pg_catalog.simple,
        STOPWORDS = english
      )
    `);

    await client.query(`
      ALTER TEXT SEARCH DICTIONARY custom_codebase_dict (Accept = true)
    `);

    await client.query(`
      CREATE TEXT SEARCH CONFIGURATION codebase_search (COPY = pg_catalog.english)
    `);

    await client.query(`
      ALTER TEXT SEARCH CONFIGURATION codebase_search
      ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
      WITH custom_codebase_dict, english_stem
    `);
    console.log('✓ Custom text search configuration created');

    // Add search vector column
    console.log('Adding search vector column...');
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE entity ADD COLUMN search_vector tsvector 
        GENERATED ALWAYS AS (
          to_tsvector('codebase_search', coalesce(content, '') || ' ' || coalesce(_type, ''))
        ) STORED;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END $$
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_entity_search ON entity USING GIN (search_vector)');
    console.log('✓ Search vector column added');

    console.log('\n✅ Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase };
