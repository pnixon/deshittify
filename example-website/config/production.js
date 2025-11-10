/**
 * Production Configuration
 * Configuration overrides for production environment
 */

export default {
  // Server configuration
  server: {
    port: process.env.PORT || 8080,
    host: '0.0.0.0',
    trustProxy: true, // Enable when behind a reverse proxy
    requestTimeout: 30000,
    keepAliveTimeout: 65000
  },

  // Site configuration
  site: {
    title: process.env.SITE_TITLE || 'Ansybl Example Site',
    description: process.env.SITE_DESCRIPTION || 'A demonstration of the Ansybl social syndication protocol',
    baseUrl: process.env.BASE_URL || 'https://example.com',
    author: {
      name: process.env.AUTHOR_NAME || 'Demo Author',
      url: process.env.AUTHOR_URL || 'https://example.com/author',
      avatar: process.env.AUTHOR_AVATAR || 'https://example.com/avatar.jpg'
    }
  },

  // Security configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: []
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    cors: {
      origin: process.env.CORS_ORIGIN || false,
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50, // More restrictive in production
      standardHeaders: true,
      legacyHeaders: false
    },
    fileDownloadRateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  },

  // File upload configuration
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB in production
    maxFiles: 3,
    allowedTypes: /^(image|video|audio|application\/pdf)\//,
    uploadsDir: process.env.UPLOADS_DIR || '/var/app/uploads'
  },

  // Media processing configuration
  media: {
    image: {
      thumbnailWidth: 400,
      thumbnailHeight: 300,
      thumbnailQuality: 75, // Lower quality for bandwidth
      maxWidth: 1920,
      maxHeight: 1080,
      generateBlurhash: true
    },
    video: {
      extractMetadata: true
    },
    audio: {
      extractMetadata: true
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'warn',
    format: 'json',
    includeTimestamp: true,
    includeCorrelationId: true
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttl: 600, // 10 minutes
    checkPeriod: 120 // 2 minutes
  },

  // WebSocket configuration
  websocket: {
    enabled: true,
    pingInterval: 25000,
    pingTimeout: 5000
  },

  // Database configuration
  database: {
    type: process.env.DB_TYPE || 'memory',
    connectionString: process.env.DATABASE_URL || null
  },

  // Monitoring configuration
  monitoring: {
    enabled: true,
    metricsPort: process.env.METRICS_PORT || 9090,
    healthCheckPath: '/health',
    readinessCheckPath: '/ready'
  },

  // Secrets (loaded from environment variables)
  secrets: {
    privateKey: process.env.ANSYBL_PRIVATE_KEY || null,
    sessionSecret: process.env.SESSION_SECRET || null,
    apiKey: process.env.API_KEY || null
  }
};
