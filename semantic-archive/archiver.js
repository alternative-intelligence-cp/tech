/**
 * File archival subsystem
 */

const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

/**
 * Archive a file and optionally delete the original
 * @param {string} filePath - Path to file to archive
 * @param {string} archivePath - Path to ZIP archive
 * @param {boolean} deleteOriginal - Whether to delete the original file
 */
async function archiveAndClean(filePath, archivePath, deleteOriginal = true) {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    // Ensure archive directory exists
    const archiveDir = path.dirname(archivePath);
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const output = fs.createWriteStream(archivePath, { flags: 'a' });
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      console.log(`✓ Archived ${path.basename(filePath)} (${archive.pointer()} bytes)`);
      
      // Delete original file if requested
      if (deleteOriginal) {
        try {
          fs.unlinkSync(filePath);
          console.log(`✓ Deleted original file: ${filePath}`);
          resolve();
        } catch (err) {
          reject(new Error(`Failed to delete original: ${err.message}`));
        }
      } else {
        resolve();
      }
    });

    archive.on('error', (err) => reject(err));
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        reject(err);
      }
    });

    archive.pipe(output);
    
    const fileName = path.basename(filePath);
    archive.file(filePath, { name: fileName });
    archive.finalize();
  });
}

module.exports = {
  archiveAndClean
};
