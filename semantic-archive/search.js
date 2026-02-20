#!/usr/bin/env node
/**
 * Hybrid search CLI tool
 * Combines vector similarity with BM25 lexical search using RRF
 */

const { Client } = require('pg');
const { Ollama } = require('ollama');
const { program } = require('commander');
const config = require('./config');

const ollama = new Ollama({ host: config.ollama.host });

/**
 * Execute hybrid search with Reciprocal Rank Fusion
 */
async function executeSearch(queryText, limit = 5) {
  const client = new Client(config.postgres);
  
  try {
    await client.connect();

    // Step 1: Embed the search query
    console.log('Embedding query...');
    const embedResponse = await ollama.embed({
      model: config.ollama.models.embedding,
      input: queryText
    });
    const queryVector = `[${embedResponse.embeddings[0].join(',')}]`;

    // Step 2: Execute Hybrid RRF Query
    console.log('Executing hybrid search...\n');
    const sql = `
      WITH vector_search AS (
        SELECT 
          id, 
          content, 
          metadata,
          ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) as rank
        FROM entity 
        WHERE _class = 'Document' AND embedding IS NOT NULL
        LIMIT 50
      ),
      keyword_search AS (
        SELECT 
          id, 
          content, 
          metadata,
          ROW_NUMBER() OVER (
            ORDER BY ts_rank_cd(search_vector, plainto_tsquery('codebase_search', $2)) DESC
          ) as rank
        FROM entity 
        WHERE search_vector @@ plainto_tsquery('codebase_search', $2)
        LIMIT 50
      )
      SELECT 
        COALESCE(v.id, k.id) as document_id,
        COALESCE(v.content, k.content) as content,
        COALESCE(v.metadata, k.metadata) as metadata,
        COALESCE(1.0 / (60 + v.rank), 0.0) + COALESCE(1.0 / (60 + k.rank), 0.0) as rrf_score,
        CASE 
          WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'both'
          WHEN v.id IS NOT NULL THEN 'semantic'
          ELSE 'lexical'
        END as match_type
      FROM vector_search v
      FULL OUTER JOIN keyword_search k ON v.id = k.id
      ORDER BY rrf_score DESC
      LIMIT $3
    `;

    const res = await client.query(sql, [queryVector, queryText, limit]);
    
    if (res.rows.length === 0) {
      console.log('No results found.\n');
      return;
    }

    console.log(`--- Found ${res.rows.length} results for: "${queryText}" ---\n`);
    
    res.rows.forEach((row, i) => {
      const meta = row.metadata;
      const score = parseFloat(row.rrf_score) || 0;
      console.log(`${i + 1}. ${meta.title || 'Untitled'} (Score: ${score.toFixed(4)}, Match: ${row.match_type})`);
      console.log(`   Type: ${meta.documentType || 'Unknown'}`);
      console.log(`   File: ${meta.fileName || 'Unknown'}`);
      
      if (meta.entities && meta.entities.length > 0) {
        const entityNames = meta.entities.slice(0, 5).map(e => e.name).join(', ');
        console.log(`   Entities: ${entityNames}${meta.entities.length > 5 ? '...' : ''}`);
      }
      
      console.log(`   Summary: ${row.content.substring(0, 200)}...`);
      console.log('');
    });

  } catch (error) {
    console.error('Search error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Get entity relationships
 */
async function getRelationships(entityId) {
  const client = new Client(config.postgres);
  
  try {
    await client.connect();

    const sql = `
      SELECT 
        r._class as relationship,
        e.id as related_entity,
        e._type as entity_type,
        e.metadata
      FROM relationship r
      JOIN entity e ON e.id = r.target_entity_id
      WHERE r.source_entity_id = $1
      
      UNION ALL
      
      SELECT 
        r._class as relationship,
        e.id as related_entity,
        e._type as entity_type,
        e.metadata
      FROM relationship r
      JOIN entity e ON e.id = r.source_entity_id
      WHERE r.target_entity_id = $1
    `;

    const res = await client.query(sql, [entityId]);
    
    if (res.rows.length === 0) {
      console.log('No relationships found.\n');
      return;
    }

    console.log(`\n--- Relationships for: ${entityId} ---\n`);
    
    res.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.relationship} → ${row.related_entity}`);
      console.log(`   Type: ${row.entity_type}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// CLI setup
program
  .name('search')
  .description('Search the semantic knowledge graph')
  .version('1.0.0');

program
  .command('query <text>')
  .description('Search for documents')
  .option('-l, --limit <number>', 'number of results', '5')
  .action(async (text, options) => {
    await executeSearch(text, parseInt(options.limit));
  });

program
  .command('relationships <entityId>')
  .description('Show relationships for an entity')
  .action(async (entityId) => {
    await getRelationships(entityId);
  });

// If no command, treat single argument as search query
if (process.argv.length === 3 && !process.argv[2].startsWith('-')) {
  executeSearch(process.argv[2])
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  program.parse();
}
