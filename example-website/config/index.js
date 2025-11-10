/**
 * Configuration Manager
 * Loads and merges configuration based on NODE_ENV
 */

import defaultConfig from './default.js';
import developmentConfig from './development.js';
import productionConfig from './production.js';

// Determine environment
const env = process.env.NODE_ENV || 'development';

// Deep merge utility
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Load environment-specific configuration
let envConfig = {};
switch (env) {
  case 'production':
    envConfig = productionConfig;
    break;
  case 'development':
    envConfig = developmentConfig;
    break;
  default:
    envConfig = developmentConfig;
}

// Merge configurations
const config = deepMerge(defaultConfig, envConfig);

// Add environment info
config.env = env;
config.isDevelopment = env === 'development';
config.isProduction = env === 'production';

// Validate required production settings
if (config.isProduction) {
  const requiredEnvVars = ['BASE_URL'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing required environment variables for production: ${missing.join(', ')}`);
  }
}

// Export configuration
export default config;

// Export individual sections for convenience
export const {
  server,
  site,
  security,
  upload,
  media,
  logging,
  cache,
  websocket,
  database,
  monitoring,
  secrets
} = config;
