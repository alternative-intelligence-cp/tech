// Configuration for semantic archive pipeline
module.exports = {
  // PostgreSQL connection
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5433,
    database: process.env.POSTGRES_DB || 'semantic_archive',
    user: process.env.POSTGRES_USER || 'randy',
    password: process.env.POSTGRES_PASSWORD || 'randy'
  },

  // Redis connection
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },

  // Ollama configuration
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    models: {
      classifier: 'glm-4.7-flash:q4_K_M',     // Flash model: recent training + better instruction following
      checker: 'glm-4.7-flash:q4_K_M',        // Flash model: should understand semantic inferences
      functionCaller: 'qwen3-coder:latest',
      embedding: 'qwen3-embedding:8b'
    }
  },

  // Paths
  paths: {
    ingest: process.env.INGEST_PATH || '/home/randy/Workspace/META/RESEARCH',
    archive: process.env.ARCHIVE_PATH || '/home/randy/Workspace/META/RESEARCH_ARCHIVE/archive.zip'
  },

  // Pipeline settings
  pipeline: {
    maxRetries: 3,
    checkValidation: false,    // DISABLED: Validators too strict despite prompts
    enableArchival: true
  }
};
