/**
 * Development Configuration
 * Configuration overrides for development environment
 */

export default {
  // Server configuration
  server: {
    port: 3000,
    host: 'localhost',
    trustProxy: false,
    requestTimeout: 60000, // Longer timeout for debugging
    keepAliveTimeout: 65000
  },

  // Site configuration
  site: {
    title: 'Ansybl Example Site (Dev)',
    description: 'Development instance of Ansybl protocol demonstration',
    baseUrl: 'http://localhost:3000',
    author: {
      name: 'Dev Author',
      url: 'http://localhost:3000/author',
      avatar: 'http://localhost:3000/avatar.jpg'
    }
  },

  // Security configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow eval for dev tools
          scriptSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    },
    cors: {
      origin: '*',
      credentials: false
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 1000, // Very permissive for development
      standardHeaders: true,
      legacyHeaders: false
    },
    fileDownloadRateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 1000
    }
  },

  // File upload configuration
  upload: {
    maxFileSize: 20 * 1024 * 1024, // 20MB for testing
    maxFiles: 10,
    allowedTypes: /^(image|video|audio|application\/pdf)\//,
    uploadsDir: 'public/uploads'
  },

  // Media processing configuration
  media: {
    image: {
      thumbnailWidth: 400,
      thumbnailHeight: 300,
      thumbnailQuality: 90, // Higher quality for development
      maxWidth: 4096,
      maxHeight: 4096,
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
    level: 'debug',
    format: 'pretty', // Human-readable format for development
    includeTimestamp: true,
    includeCorrelationId: true
  },

  // Cache configuration
  cache: {
    enabled: false, // Disable caching for development
    ttl: 60,
    checkPeriod: 10
  },

  // WebSocket configuration
  websocket: {
    enabled: true,
    pingInterval: 25000,
    pingTimeout: 5000
  },

  // Database configuration
  database: {
    type: 'memory',
    connectionString: null
  },

  // Monitoring configuration
  monitoring: {
    enabled: true,
    metricsPort: 9090,
    healthCheckPath: '/health',
    readinessCheckPath: '/ready'
  }
};
