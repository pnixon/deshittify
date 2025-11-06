/**
 * File upload middleware configuration
 */

import multer from 'multer';
import { serverConfig } from '../data/config.js';

// Configure multer for file uploads
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: serverConfig.maxFileSize,
    files: serverConfig.maxFiles
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and PDF documents
    if (serverConfig.allowedMimeTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image, video, audio, and PDF files are allowed'), false);
    }
  }
});