/**
 * Database executor - Executes LLM-generated commands safely
 */

const { Client } = require('pg');
const config = require('./config');

/**
 * Execute database commands in a transaction
 */
async function executeCommands(commands, documentData) {
  const client = new Client(config.postgres);
  
  try {
    await client.connect();
    await client.query('BEGIN');

    // Insert main document entity
    await client.query(
      `INSERT INTO public.entity (id, _type, _class, content, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         embedding = EXCLUDED.embedding,
         metadata = EXCLUDED.metadata`,
      [
        documentData.id,
        documentData.type,
        'Document',
        documentData.content,
        documentData.embedding ? `[${documentData.embedding.join(',')}]` : null,
        JSON.stringify(documentData.metadata)
      ]
    );

    // Execute LLM-generated commands
    for (const cmd of commands) {
      if (cmd.action === 'INSERT_ENTITY') {
        const p = cmd.payload;
        
        // Validate required fields
        if (!p.id) {
          console.warn(`⚠️  Skipping invalid entity: missing id`, p);
          continue;
        }
        
        await client.query(
          `INSERT INTO public.entity (id, _type, _class, metadata)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.type || 'Unknown', 'Concept', JSON.stringify(p.metadata || {})]
        );
      } else if (cmd.action === 'INSERT_RELATIONSHIP') {
        const p = cmd.payload;
        // Safeguard: default _class to 'MENTIONS' if not provided by LLM
        const relationshipClass = p._class || 'MENTIONS';
        
        // Validate required fields
        if (!p.source || !p.target) {
          console.warn(`⚠️  Skipping invalid relationship: missing source/target`, p);
          continue;
        }
        
        await client.query(
          `INSERT INTO public.relationship (source_entity_id, target_entity_id, _class, metadata)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [p.source, p.target, relationshipClass, JSON.stringify(p.metadata || {})]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`✓ Committed ${commands.length} commands for document ${documentData.id}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

module.exports = {
  executeCommands
};
