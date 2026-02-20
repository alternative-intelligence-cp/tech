/**
 * Document text extraction using OS-level binaries
 * Supports PDF, DOCX, TXT, MD
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Extract text from a document file
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractDocumentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Text file extensions (direct read)
  const textExtensions = [
    '.txt', '.md', '.markdown',
    '.idea', '.gemini', '.research',  // Custom research extensions
    '.py', '.js', '.sh', '.json', '.yaml', '.yml', '.ini', '.conf',  // Code/config files
    '.log', '.csv', '.tsv'  // Data files
  ];
  
  return new Promise((resolve, reject) => {
    let output = '';
    let processInstance;

    if (ext === '.pdf') {
      // Use pdftotext with layout preservation
      processInstance = spawn('pdftotext', ['-layout', filePath, '-']);
    } else if (ext === '.docx') {
      // Use pandoc to convert DOCX to Github-Flavored Markdown
      processInstance = spawn('pandoc', ['-f', 'docx', '-t', 'gfm', filePath]);
    } else if (textExtensions.includes(ext) || ext === '') {
      // Direct file read for text files (including files with no extension)
      try {
        return resolve(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        return reject(err);
      }
    } else {
      return reject(new Error(`Unsupported file extension: ${ext}`));
    }
    
    processInstance.stdout.on('data', (data) => output += data.toString());
    processInstance.stderr.on('data', (data) => {
      console.warn(`Extraction Warning: ${data}`);
    });
    
    processInstance.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    processInstance.on('error', (err) => {
      reject(new Error(`Failed to start extraction process: ${err.message}`));
    });
  });
}

/**
 * Extract metadata from file path
 * @param {string} filePath - Path to the file
 * @returns {object} - Metadata object
 */
function extractMetadata(filePath) {
  const stats = fs.statSync(filePath);
  const parsed = path.parse(filePath);
  
  return {
    fileName: parsed.base,
    extension: parsed.ext,
    directory: parsed.dir,
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime
  };
}

module.exports = {
  extractDocumentText,
  extractMetadata
};
