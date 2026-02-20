# Semantic Archive - Installation & Testing Guide

## Quick Start

### 1. Check Prerequisites

```bash
# Check Node.js
node --version  # Should be 18+

# Check PostgreSQL
psql --version  # Should be 14+

# Check Redis
redis-cli --version

# Check system binaries
which pdftotext pandoc

# Check Ollama models
ollama list | grep -E "nemotron-3-nano:30b|qwen3-coder:30b|qwen3-embedding:8b"
```

If anything is missing:

```bash
# Install poppler (for pdftotext)
sudo apt install poppler-utils  # Ubuntu/Debian

# Install pandoc
sudo apt install pandoc

# Pull Ollama models
ollama pull nemotron-3-nano:30b
ollama pull qwen3-coder:30b
ollama pull qwen3-embedding:8b
```

### 2. Install Node Dependencies

```bash
cd /home/randy/Workspace/REPOS/tech/semantic-archive
npm install
```

### 3. Create PostgreSQL Database

```bash
# Create database
createdb semantic_archive

# Or if you need to specify user:
createdb -U your_user semantic_archive
```

### 4. Initialize Database Schema

```bash
npm run init-db
```

You should see:
```
Connected to PostgreSQL
Creating extensions...
✓ Extensions created
Creating entity table...
✓ Entity table created
...
✅ Database initialization complete!
```

### 5. Start Redis (if not running)

```bash
# Check if Redis is running
redis-cli ping

# If not, start it
redis-server &
# Or on systemd:
sudo systemctl start redis
```

### 6. Create Test Documents

```bash
# Create ingest directory
mkdir -p ./ingest

# Create a test markdown file
cat > ./ingest/test-doc.md << 'EOF'
# Redis Connection Pooling Guide

This document describes Redis connection pooling strategies for Aria applications.

## Key Concepts

- **Connection Pool**: Manages reusable Redis connections
- **MAX_CONNECTIONS**: Set to 20 for production
- **TIMEOUT**: Default 5000ms

## Implementation

The Aria Redis client uses connection pooling to prevent the ERR_TIMEOUT_99 error.

Technologies used:
- Redis
- Aria
- NodeJS

EOF
```

### 7. Test Single File Processing

```bash
npm start process ./ingest/test-doc.md
```

Expected output:
```
Processing file: /path/to/test-doc.md

📄 Processing: test-doc.md
  1/7 Extracting text...
  2/7 Classifying document...
  3/7 Validating classification...
  ✓ Validation passed: ...
  4/7 Generating embeddings...
  5/7 Generating database commands...
  6/7 Executing database transaction...
  ✓ Committed X commands for document ...
  7/7 Archiving file...
  ✓ Archived test-doc.md (XXX bytes)
  ✓ Deleted original file: ...
✅ Completed: test-doc.md
```

### 8. Test Search

```bash
# Search by concept
npm run search "Redis connection pooling"

# Search for exact error code
npm run search "ERR_TIMEOUT_99"

# Search for technology
npm run search "NodeJS"
```

Expected output:
```
--- Found 1 results for: "Redis connection pooling" ---

1. Redis Connection Pooling Guide (Score: 0.0724, Match: both)
   Type: TechSpec
   File: test-doc.md
   Entities: Connection Pool, Redis, Aria, NodeJS
   Summary: This document describes Redis connection pooling...
```

### 9. Start Continuous Monitoring

```bash
npm start watch
```

Now drop any PDF, DOCX, TXT, or MD files into `./ingest/` and watch them get processed automatically!

## Verify Database Contents

```bash
psql semantic_archive

-- View all documents
SELECT id, _type, metadata->>'title' as title 
FROM entity 
WHERE _class = 'Document';

-- View all extracted concepts
SELECT id, _type 
FROM entity 
WHERE _class = 'Concept';

-- View relationships
SELECT 
  e1.metadata->>'title' as document,
  r._class as relationship,
  e2.id as concept
FROM relationship r
JOIN entity e1 ON e1.id = r.source_entity_id
JOIN entity e2 ON e2.id = r.target_entity_id
WHERE e1._class = 'Document';
```

## Common Issues

### "Cannot find module 'bullmq'"

```bash
npm install
```

### "ECONNREFUSED 127.0.0.1:6379"

Redis isn't running:
```bash
redis-server &
```

### "ECONNREFUSED 127.0.0.1:5432"

PostgreSQL isn't running:
```bash
sudo systemctl start postgresql
```

### "relation 'entity' does not exist"

Database not initialized:
```bash
npm run init-db
```

### LLM extraction fails

Check Ollama:
```bash
curl http://127.0.0.1:11434/api/tags
```

Models should be listed. If not, pull them:
```bash
ollama pull nemotron-3-nano:30b
ollama pull qwen3-coder:30b
ollama pull qwen3-embedding:8b
```

## Performance Benchmarks

On a typical system:
- PDF extraction: ~2-5 seconds
- LLM classification: ~3-8 seconds (depends on model and document length)
- Embedding generation: ~1-2 seconds
- Database insertion: <1 second
- **Total per document: ~10-20 seconds**

For 100 documents:
- Sequential: ~20-30 minutes
- With concurrency=2: ~10-15 minutes

## Next Steps

Once working, point it at your real documentation:

```bash
# Process all PDFs in META/RESEARCH
cp ~/Workspace/META/RESEARCH/*.pdf ./ingest/

# Or watch a specific directory
# Edit config.js:
paths: {
  ingest: '/home/randy/Workspace/META/RESEARCH',
  archive: '/home/randy/Workspace/SYSTEM/archives/research.zip'
}
```

Then search your entire knowledge base:

```bash
npm run search "Nikola consciousness implementation"
npm run search "Phase 2 completion status"
npm run search "ERR_" # Find all error codes
```
