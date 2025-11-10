/**
 * Default Configuration
 * Base configuration values that apply to all environments
 */

export default {
  // Server configuration
  server: {
    port: 3000,
    host: '0.0.0.0',
    trustProxy: false,
    requestTimeout: 30000, // 30 seconds
    keepAliveTimeout: 65000 // 65 seconds
  },

  // Site configuration
  site: {
    title: 'Ansybl Example Site',
    description: 'A demonstration of the Ansybl social syndication protocol',
    baseUrl: 'http://localhost:3000',
    author: {
      name: 'Demo Author',
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
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"]
        }
      }
    },
    cors: {
      origin: '*',
      credentials: false
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    },
    fileDownloadRateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 200
    }
  },

  // File upload configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    allowedTypes: /^(image|video|audio|application\/pdf)\//,
    uploadsDir: 'public/uploads'
  },

  // Media processing configuration
  media: {
    image: {
      thumbnailWidth: 400,
      thumbnailHeight: 300,
      thumbnailQuality: 80,
      maxWidth: 2048,
      maxHeight: 2048,
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
    level: 'info',
    format: 'json',
    includeTimestamp: true,
    includeCorrelationId: true
  },

  // Cache configuration
  cache: {
    enabled: false,
    ttl: 300, // 5 minutes
    checkPeriod: 60 // 1 minute
  },

  // WebSocket configuration
  websocket: {
    enabled: true,
    pingInterval: 25000,
    pingTimeout: 5000
  },

  // Database configuration (for future use)
  database: {
    type: 'memory', // 'memory', 'sqlite', 'postgres', etc.
    connectionString: null
  },

  // Monitoring configuration
  monitoring: {
    enabled: false,
    metricsPort: 9090,
    healthCheckPath: '/health',
    readinessCheckPath: '/ready'
  }
};
