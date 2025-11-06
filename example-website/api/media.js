/**
 * Media API routes
 */

import { Router } from 'express';
import { join } from 'path';
import { processMediaFile, generateVideoMetadata, generateAudioMetadata } from '../utils/media.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Media upload endpoint
router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`📎 Processing ${req.files.length} media file(s)`);
    
    const processedFiles = [];
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    
    for (const file of req.files) {
      try {
        const processedFile = await processMediaFile(file, uploadsDir);
        
        // All metadata extraction is now handled within processMediaFile function
        // This includes video, audio, and document metadata extraction
        
        processedFiles.push(processedFile);
        console.log(`✅ Processed: ${file.originalname} -> ${processedFile.url}`);
        
      } catch (error) {
        console.error(`❌ Failed to process ${file.originalname}:`, error.message);
        if (!req.body.skipErrors) {
          throw error;
        }
      }
    }
    
    res.json({
      success: true,
      files: processedFiles,
      count: processedFiles.length
    });
    
  } catch (error) {
    console.error('❌ Media upload error:', error.message);
    res.status(500).json({
      error: 'Failed to process media files',
      message: error.message
    });
  }
});

export default router;