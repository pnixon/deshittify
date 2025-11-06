/**
 * Media processing utilities
 */

import sharp from 'sharp';
import mime from 'mime-types';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { parseBuffer } from 'music-metadata';
import * as pdfParse from 'pdf-parse';
import { encode } from 'blurhash';
import ffprobeStatic from 'ffprobe-static';
import { siteConfig } from '../data/config.js';
import { generateSecureFilename, validateFileType, sanitizeFilename } from './security.js';

export async function processMediaFile(file, uploadsDir) {
  // Validate file type security
  const validation = validateFileType(file.buffer, file.mimetype, file.originalname);
  if (!validation.isValid) {
    throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Generate secure filename
  const filename = generateSecureFilename(file.buffer, sanitizeFilename(file.originalname));
  const filepath = join(uploadsDir, filename);
  
  let processedFile = {
    url: `${siteConfig.baseUrl}/uploads/${filename}`,
    mime_type: file.mimetype,
    title: file.originalname,
    size_in_bytes: file.buffer.length
  };
  
  // Process images with sharp
  if (file.mimetype.startsWith('image/')) {
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      
      processedFile.width = metadata.width;
      processedFile.height = metadata.height;
      
      // Generate optimized version of the original image
      const baseHash = filename.split('_')[0]; // Extract hash from secure filename
      const optimizedFilename = `opt_${baseHash}.webp`; // Always convert to WebP for optimization
      const optimizedPath = join(uploadsDir, optimizedFilename);
      
      await image
        .webp({ quality: 85, effort: 4 })
        .toFile(optimizedPath);
      
      processedFile.optimized_url = `${siteConfig.baseUrl}/uploads/${optimizedFilename}`;
      
      // Generate multiple thumbnail sizes
      const thumbnailSizes = [
        { name: 'small', width: 150, height: 150 },
        { name: 'medium', width: 400, height: 300 },
        { name: 'large', width: 800, height: 600 }
      ];
      
      processedFile.thumbnails = {};
      
      for (const size of thumbnailSizes) {
        if (metadata.width > size.width || metadata.height > size.height) {
          const thumbFilename = `thumb_${size.name}_${filename}`;
          const thumbPath = join(uploadsDir, thumbFilename);
          
          await image
            .resize(size.width, size.height, { 
              fit: 'inside', 
              withoutEnlargement: true,
              background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .jpeg({ quality: 80, progressive: true })
            .toFile(thumbPath);
          
          processedFile.thumbnails[size.name] = `${siteConfig.baseUrl}/uploads/${thumbFilename}`;
        }
      }
      
      // Maintain backward compatibility with single thumbnail
      if (processedFile.thumbnails.medium) {
        processedFile.thumbnail_url = processedFile.thumbnails.medium;
      }
      
      // Generate actual blurhash placeholder
      processedFile.blurhash = await generateBlurhash(file.buffer);
      
      // Generate responsive image set for modern web delivery
      try {
        const responsiveSet = await generateResponsiveImageSet(file.buffer, baseHash, uploadsDir);
        processedFile.responsive = responsiveSet;
      } catch (error) {
        console.warn('Responsive image generation failed:', error.message);
      }
      
      // Add image optimization info
      processedFile.optimization = {
        original_size: file.buffer.length,
        format: metadata.format,
        has_alpha: metadata.hasAlpha,
        color_space: metadata.space,
        density: metadata.density
      };
      
    } catch (error) {
      console.warn('Image processing failed:', error.message);
    }
  }
  
  // Process videos
  else if (file.mimetype.startsWith('video/')) {
    try {
      const videoMeta = await generateVideoMetadata(file);
      Object.assign(processedFile, videoMeta);
    } catch (error) {
      console.warn('Video processing failed:', error.message);
    }
  }
  
  // Process audio files
  else if (file.mimetype.startsWith('audio/')) {
    try {
      const audioMeta = await generateAudioMetadata(file);
      Object.assign(processedFile, audioMeta);
    } catch (error) {
      console.warn('Audio processing failed:', error.message);
    }
  }
  
  // Process documents (PDF)
  else if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('application/')) {
    try {
      const docMeta = await generateDocumentMetadata(file);
      Object.assign(processedFile, docMeta);
    } catch (error) {
      console.warn('Document processing failed:', error.message);
    }
  }
  
  // Save original file
  await fs.writeFile(filepath, file.buffer);
  
  return processedFile;
}

/**
 * Generate actual BlurHash for progressive image loading
 */
export async function generateBlurhash(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const { data, info } = await image
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
  } catch (error) {
    console.warn('BlurHash generation failed:', error.message);
    // Fallback to simple hash
    const colors = ['L9AB8S', 'L6PZfQ', 'L4Rme7', 'L8Q]%M'];
    return colors[Math.floor(Math.random() * colors.length)] + 'j[ayj[';
  }
}

/**
 * Generate responsive image set with multiple formats and sizes
 */
export async function generateResponsiveImageSet(imageBuffer, baseFilename, uploadsDir) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  const responsiveSet = {
    original: { width: metadata.width, height: metadata.height },
    formats: {},
    sizes: {}
  };
  
  // Generate different formats (WebP, AVIF for modern browsers, JPEG for fallback)
  const formats = [
    { ext: 'webp', options: { quality: 85, effort: 4 } },
    { ext: 'avif', options: { quality: 80, effort: 4 } },
    { ext: 'jpg', options: { quality: 85, progressive: true } }
  ];
  
  for (const format of formats) {
    try {
      const formatFilename = `${baseFilename}.${format.ext}`;
      const formatPath = join(uploadsDir, formatFilename);
      
      await image[format.ext](format.options).toFile(formatPath);
      
      responsiveSet.formats[format.ext] = {
        url: `${siteConfig.baseUrl}/uploads/${formatFilename}`,
        mime_type: `image/${format.ext === 'jpg' ? 'jpeg' : format.ext}`
      };
    } catch (error) {
      console.warn(`Failed to generate ${format.ext} format:`, error.message);
    }
  }
  
  // Generate different sizes for responsive loading
  const breakpoints = [480, 768, 1024, 1200, 1920];
  
  for (const width of breakpoints) {
    if (metadata.width > width) {
      try {
        const sizeFilename = `${baseFilename}_${width}w.webp`;
        const sizePath = join(uploadsDir, sizeFilename);
        
        const resizedImage = await image
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 85, effort: 4 })
          .toFile(sizePath);
        
        responsiveSet.sizes[`${width}w`] = {
          url: `${siteConfig.baseUrl}/uploads/${sizeFilename}`,
          width: resizedImage.width,
          height: resizedImage.height
        };
      } catch (error) {
        console.warn(`Failed to generate ${width}w size:`, error.message);
      }
    }
  }
  
  return responsiveSet;
}

/**
 * Extract video metadata using ffprobe
 */
export async function generateVideoMetadata(file) {
  try {
    const tempPath = join(process.cwd(), 'temp', `temp_${Date.now()}.${mime.extension(file.mimetype)}`);
    
    // Write buffer to temporary file for ffprobe
    await fs.writeFile(tempPath, file.buffer);
    
    const metadata = await new Promise((resolve, reject) => {
      const ffprobe = spawn(ffprobeStatic, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        tempPath
      ]);
      
      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            reject(new Error('Failed to parse ffprobe output'));
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}`));
        }
      });
      
      ffprobe.on('error', reject);
    });
    
    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});
    
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const format = metadata.format;
    
    return {
      duration_in_seconds: parseFloat(format.duration) || 0,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      bitrate: parseInt(format.bit_rate) || 0,
      codec: videoStream?.codec_name || 'unknown'
    };
    
  } catch (error) {
    console.warn('Video metadata extraction failed:', error.message);
    return {
      duration_in_seconds: 0,
      width: 0,
      height: 0,
      bitrate: 0,
      codec: 'unknown'
    };
  }
}

/**
 * Extract audio metadata using music-metadata
 */
export async function generateAudioMetadata(file) {
  try {
    const metadata = await parseBuffer(file.buffer, file.mimetype);
    
    return {
      duration_in_seconds: metadata.format.duration || 0,
      bitrate: metadata.format.bitrate || 0,
      sample_rate: metadata.format.sampleRate || 0,
      channels: metadata.format.numberOfChannels || 0,
      codec: metadata.format.codec || 'unknown',
      title: metadata.common.title || file.originalname,
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album'
    };
    
  } catch (error) {
    console.warn('Audio metadata extraction failed:', error.message);
    return {
      duration_in_seconds: 0,
      bitrate: 0,
      sample_rate: 0,
      channels: 0,
      codec: 'unknown',
      title: file.originalname,
      artist: 'Unknown Artist',
      album: 'Unknown Album'
    };
  }
}

/**
 * Extract PDF document metadata
 */
export async function generateDocumentMetadata(file) {
  try {
    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(file.buffer);
      
      return {
        page_count: pdfData.numpages || 0,
        text_content: pdfData.text ? pdfData.text.substring(0, 500) : '', // First 500 chars for preview
        title: pdfData.info?.Title || file.originalname,
        author: pdfData.info?.Author || 'Unknown',
        creator: pdfData.info?.Creator || 'Unknown',
        creation_date: pdfData.info?.CreationDate || null,
        modification_date: pdfData.info?.ModDate || null
      };
    }
    
    // For other document types, return basic metadata
    return {
      title: file.originalname,
      author: 'Unknown',
      creation_date: null,
      modification_date: null
    };
    
  } catch (error) {
    console.warn('Document metadata extraction failed:', error.message);
    return {
      title: file.originalname,
      author: 'Unknown',
      creation_date: null,
      modification_date: null
    };
  }
}