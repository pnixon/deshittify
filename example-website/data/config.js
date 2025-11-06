/**
 * Application Configuration
 */

export const siteConfig = {
  title: 'Ansybl Example Site',
  description: 'A demonstration of the Ansybl social syndication protocol with live commenting',
  baseUrl: 'https://example.com',
  author: {
    name: 'Demo Author',
    url: 'https://example.com/author',
    avatar: 'https://example.com/avatar.jpg'
  }
};

export const serverConfig = {
  port: process.env.PORT || 3000,
  uploadsDir: 'public/uploads',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  allowedMimeTypes: /^(image|video|audio|application\/pdf)\//,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp4', '.webm', '.mp3', '.ogg', '.wav', '.pdf'],
  secureFileServing: {
    requireAuth: false,
    maxAge: 86400, // 24 hours
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxDownloads: 100 // per IP
    }
  }
};

export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
};