#!/usr/bin/env node
/**
 * Main ingestion pipeline using BullMQ
 */

const { Worker, Queue, QueueEvents } = require('bullmq');
const chokidar = require('chokidar');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const config = require('./config');
const { extractDocumentText, extractMetadata } = require('./extractor');
const { runClassifier, runChecker, runFunctionCaller, runEmbedder } = require('./agents');
const { executeCommands } = require('./executor');
const { archiveAndClean } = require('./archiver');

// Create ingestion queue
const ingestionQueue = new Queue('document-ingestion', {
  connection: config.redis
});

// Create worker to process jobs
const worker = new Worker('document-ingestion', async (job) => {
  const { filePath } = job.data;
  
  console.log(`\n📄 Processing: ${path.basename(filePath)}`);
  
  try {
    // Step 1: Extract text
    job.updateProgress(10);
    console.log('  1/7 Extracting text...');
    const documentText = await extractDocumentText(filePath);
    const metadata = extractMetadata(filePath);
    
    if (!documentText || documentText.trim().length === 0) {
      throw new Error('No text extracted from document');
    }
    
    // Step 2: Run classifier
    job.updateProgress(30);
    console.log('  2/7 Classifying document...');
    const classified = await runClassifier(documentText, metadata);
    
    // Step 3: Run checker (if enabled)
    if (config.pipeline.checkValidation) {
      job.updateProgress(45);
      console.log('  3/7 Validating classification...');
      const validation = await runChecker(documentText, classified);
      
      if (!validation.isValid) {
        throw new Error(`Classification validation failed: ${validation.reasoning}`);
      }
      console.log(`  ✓ Validation passed: ${validation.reasoning}`);
    }
    
    // Step 4: Generate embeddings
    job.updateProgress(60);
    console.log('  4/7 Generating embeddings...');
    const embedding = await runEmbedder(classified.summary);
    
    // Step 5: Generate database commands
    job.updateProgress(75);
    console.log('  5/7 Generating database commands...');
    const documentId = crypto.createHash('md5').update(filePath).digest('hex');
    const commands = await runFunctionCaller(classified, documentId);
    
    // Step 6: Execute commands
    job.updateProgress(85);
    console.log('  6/7 Executing database transaction...');
    await executeCommands(commands, {
      id: documentId,
      type: classified.documentType,
      content: classified.summary,
      embedding: embedding,
      metadata: {
        ...metadata,
        title: classified.title,
        originalPath: filePath,
        entities: classified.entities
      }
    });
    
    // Step 7: Archive and clean
    if (config.pipeline.enableArchival) {
      job.updateProgress(95);
      console.log('  7/7 Archiving file...');
      await archiveAndClean(filePath, config.paths.archive);
    }
    
    job.updateProgress(100);
    console.log(`✅ Completed: ${path.basename(filePath)}`);
    
    return {
      success: true,
      documentId,
      title: classified.title,
      entities: classified.entities.length
    };
    
  } catch (error) {
    console.error(`❌ Failed: ${path.basename(filePath)}`);
    console.error(`   Error: ${error.message}`);
    throw error;
  }
}, {
  connection: config.redis,
  concurrency: 2, // Process 2 documents at a time
  limiter: {
    max: 10,
    duration: 60000 // Max 10 jobs per minute (to not overwhelm Ollama)
  }
});

// Worker event handlers
worker.on('completed', (job, result) => {
  console.log(`\n[Queue] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`\n[Queue] Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Queue] Worker error:', err);
});

// File watcher setup
function startWatcher() {
  const ingestPath = config.paths.ingest;
  
  // Create ingest directory if it doesn't exist
  if (!fs.existsSync(ingestPath)) {
    fs.mkdirSync(ingestPath, { recursive: true });
  }
  
  console.log(`\n👁️  Watching directory: ${ingestPath}`);
  console.log('   Supported formats: PDF, DOCX, TXT, MD\n');
  
  const watcher = chokidar.watch(ingestPath, {
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  
  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    const supportedExtensions = [
      '.pdf', '.docx', '.txt', '.md', '.markdown',
      '.idea', '.gemini', '.research',
      '.py', '.js', '.sh', '.json', '.yaml', '.yml'
    ];
    
    if (supportedExtensions.includes(ext) || ext === '') {
      console.log(`\n[Watcher] New file detected: ${path.basename(filePath)}`);
      
      try {
        await ingestionQueue.add('ingest-document', { filePath }, {
          attempts: config.pipeline.maxRetries,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });
        console.log(`[Watcher] Queued for processing`);
      } catch (error) {
        console.error(`[Watcher] Failed to queue: ${error.message}`);
      }
    }
  });
}

// CLI interface
if (require.main === module) {
  const { program } = require('commander');
  
  program
    .name('semantic-archive')
    .description('Autonomous semantic knowledge graph ingestion pipeline')
    .version('1.0.0');
  
  program
    .command('watch')
    .description('Start watching the ingest directory')
    .action(() => {
      console.log('🚀 Starting Semantic Archive Pipeline...\n');
      console.log('Configuration:');
      console.log(`  • Ingest path: ${config.paths.ingest}`);
      console.log(`  • Archive path: ${config.paths.archive}`);
      console.log(`  • Classifier: ${config.ollama.models.classifier}`);
      console.log(`  • Embedding: ${config.ollama.models.embedding}`);
      console.log(`  • Validation: ${config.pipeline.checkValidation ? 'enabled' : 'disabled'}`);
      console.log(`  • Archival: ${config.pipeline.enableArchival ? 'enabled' : 'disabled'}\n`);
      
      startWatcher();
    });
  
  program
    .command('process <file>')
    .description('Process a single file immediately')
    .action(async (file) => {
      const filePath = path.resolve(file);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
      
      console.log(`Processing file: ${filePath}\n`);
      
      const queueEvents = new QueueEvents('document-ingestion', {
        connection: config.redis
      });
      
      const job = await ingestionQueue.add('ingest-document', { filePath }, {
        attempts: 1
      });
      
      console.log(`Job queued: ${job.id}`);
      console.log('Waiting for completion...\n');
      
      const result = await job.waitUntilFinished(queueEvents);
      console.log('\nResult:', result);
      
      await queueEvents.close();
      process.exit(0);
    });
  
  program
    .command('batch [directory]')
    .description('Process all files in a directory (defaults to ingest path)')
    .option('-l, --limit <number>', 'Maximum number of files to process', '0')
    .action(async (directory, options) => {
      const targetDir = directory ? path.resolve(directory) : config.paths.ingest;
      const limit = parseInt(options.limit);
      
      if (!fs.existsSync(targetDir)) {
        console.error(`❌ Directory not found: ${targetDir}`);
        process.exit(1);
      }
      
      console.log(`🚀 Batch processing: ${targetDir}\n`);
      
      const supportedExtensions = [
        '.pdf', '.docx', '.txt', '.md', '.markdown',
        '.idea', '.gemini', '.research',
        '.py', '.js', '.sh', '.json', '.yaml', '.yml'
      ];
      
      // Recursively find all supported files
      function findFiles(dir, fileList = []) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            findFiles(fullPath, fileList);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              fileList.push(fullPath);
            }
          }
        }
        
        return fileList;
      }
      
      let files;
      try {
        files = findFiles(targetDir);
      } catch (err) {
        console.error('❌ Failed to scan directory:', err.message);
        process.exit(1);
      }
      
      if (limit > 0 && files.length > limit) {
        files = files.slice(0, limit);
        console.log(`📊 Found ${files.length} files (limited from total)\n`);
      } else {
        console.log(`📊 Found ${files.length} files to process\n`);
      }
      
      // Queue all files
      let queued = 0;
      for (const filePath of files) {
        try {
          await ingestionQueue.add('ingest-document', { filePath }, {
            attempts: config.pipeline.maxRetries,
            backoff: { type: 'exponential', delay: 2000 }
          });
          queued++;
          if (queued % 50 === 0) {
            console.log(`⏳ Queued ${queued}/${files.length} files...`);
          }
        } catch (error) {
          console.error(`❌ Failed to queue ${path.basename(filePath)}: ${error.message}`);
        }
      }
      
      console.log(`\n✅ Queued ${queued} files for processing`);
      console.log(`📊 Monitor progress with: npm start watch\n`);
      process.exit(0);
    });
  
  program.parse();
}

module.exports = {
  ingestionQueue,
  worker
};
