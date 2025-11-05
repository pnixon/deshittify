# Ansybl Protocol Deployment Guide

This guide provides comprehensive instructions for deploying and hosting Ansybl feeds, parsers, and bridge services in various environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Self-Hosting Ansybl Feeds](#self-hosting-ansybl-feeds)
3. [Deployment Platforms](#deployment-platforms)
4. [Bridge Services Deployment](#bridge-services-deployment)
5. [Discovery Services Setup](#discovery-services-setup)
6. [Security Configuration](#security-configuration)
7. [Performance Optimization](#performance-optimization)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js 18+ (for JavaScript implementations)
- HTTPS-capable web server or hosting platform
- Domain name with SSL certificate
- Basic understanding of JSON and web hosting

### 5-Minute Setup

1. **Generate your key pair:**
   ```bash
   npm install -g ansybl-cli
   ansybl generate-keys --output ./keys
   ```

2. **Create your first feed:**
   ```bash
   ansybl create-feed \
     --title "My Ansybl Feed" \
     --url "https://yourdomain.com" \
     --feed-url "https://yourdomain.com/feed.ansybl" \
     --author "Your Name" \
     --key ./keys/private.key \
     --output ./feed.ansybl
   ```

3. **Upload to your web server:**
   ```bash
   # Upload feed.ansybl to your web server's document root
   scp feed.ansybl user@yourserver:/var/www/html/
   ```

4. **Verify deployment:**
   ```bash
   curl -H "Accept: application/json" https://yourdomain.com/feed.ansybl
   ansybl validate https://yourdomain.com/feed.ansybl
   ```

## Self-Hosting Ansybl Feeds

### Static File Hosting

Ansybl feeds are designed to work with simple static file hosting. No server-side processing is required.

#### Basic Static Setup

1. **Directory Structure:**
   ```
   /var/www/html/
   ├── feed.ansybl          # Main feed file
   ├── media/               # Media attachments (optional)
   │   ├── images/
   │   └── videos/
   ├── .well-known/         # Discovery files (optional)
   │   └── ansybl
   └── index.html           # Your website
   ```

2. **Web Server Configuration:**

   **Apache (.htaccess):**
   ```apache
   # Serve Ansybl feeds with correct MIME type
   <Files "*.ansybl">
       Header set Content-Type "application/json; charset=utf-8"
       Header set Access-Control-Allow-Origin "*"
       Header set Cache-Control "public, max-age=300"
   </Files>

   # Security headers
   Header always set X-Content-Type-Options nosniff
   Header always set X-Frame-Options DENY
   Header always set X-XSS-Protection "1; mode=block"
   ```

   **Nginx:**
   ```nginx
   location ~ \.ansybl$ {
       add_header Content-Type "application/json; charset=utf-8";
       add_header Access-Control-Allow-Origin "*";
       add_header Cache-Control "public, max-age=300";
       
       # Security headers
       add_header X-Content-Type-Options nosniff;
       add_header X-Frame-Options DENY;
       add_header X-XSS-Protection "1; mode=block";
   }
   ```

#### Dynamic Feed Generation

For frequently updated feeds, use a simple script to regenerate the feed file:

```bash
#!/bin/bash
# update-feed.sh

FEED_DIR="/var/www/html"
PRIVATE_KEY="/path/to/private.key"
TEMP_FEED="/tmp/feed.ansybl"

# Generate updated feed
ansybl create-feed \
  --title "My Dynamic Feed" \
  --url "https://yourdomain.com" \
  --feed-url "https://yourdomain.com/feed.ansybl" \
  --author "Your Name" \
  --key "$PRIVATE_KEY" \
  --output "$TEMP_FEED"

# Add recent posts
for post in /path/to/posts/*.md; do
  ansybl add-post \
    --feed "$TEMP_FEED" \
    --post "$post" \
    --key "$PRIVATE_KEY"
done

# Atomically update the live feed
mv "$TEMP_FEED" "$FEED_DIR/feed.ansybl"

echo "Feed updated at $(date)"
```

Set up a cron job for regular updates:
```bash
# Update feed every 15 minutes
*/15 * * * * /path/to/update-feed.sh >> /var/log/ansybl-update.log 2>&1
```

## Deployment Platforms

### GitHub Pages

Perfect for static Ansybl feeds with GitHub Actions for automation.

1. **Repository Structure:**
   ```
   your-repo/
   ├── .github/workflows/
   │   └── update-feed.yml
   ├── content/
   │   └── posts/
   ├── keys/
   │   └── private.key      # Store as GitHub Secret
   ├── feed.ansybl
   └── index.html
   ```

2. **GitHub Actions Workflow (.github/workflows/update-feed.yml):**
   ```yaml
   name: Update Ansybl Feed
   
   on:
     push:
       paths: ['content/**']
     schedule:
       - cron: '0 */6 * * *'  # Every 6 hours
   
   jobs:
     update-feed:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '18'
             
         - name: Install Ansybl CLI
           run: npm install -g ansybl-cli
           
         - name: Generate Feed
           env:
             PRIVATE_KEY: ${{ secrets.ANSYBL_PRIVATE_KEY }}
           run: |
             echo "$PRIVATE_KEY" > private.key
             ansybl generate-feed \
               --config ./config.json \
               --content ./content \
               --key ./private.key \
               --output ./feed.ansybl
             rm private.key
             
         - name: Commit and Push
           run: |
             git config --local user.email "action@github.com"
             git config --local user.name "GitHub Action"
             git add feed.ansybl
             git commit -m "Update feed $(date)" || exit 0
             git push
   ```

### Netlify

1. **netlify.toml Configuration:**
   ```toml
   [build]
     command = "npm run build-feed"
     publish = "dist"
   
   [[headers]]
     for = "*.ansybl"
     [headers.values]
       Content-Type = "application/json; charset=utf-8"
       Access-Control-Allow-Origin = "*"
       Cache-Control = "public, max-age=300"
   
   [[redirects]]
     from = "/.well-known/ansybl"
     to = "/feed.ansybl"
     status = 200
   ```

2. **Build Script (package.json):**
   ```json
   {
     "scripts": {
       "build-feed": "ansybl generate-feed --config ./config.json --output ./dist/feed.ansybl"
     }
   }
   ```

### Vercel

1. **vercel.json Configuration:**
   ```json
   {
     "functions": {
       "api/feed.js": {
         "runtime": "@vercel/node"
       }
     },
     "headers": [
       {
         "source": "/(.*\\.ansybl)",
         "headers": [
           {
             "key": "Content-Type",
             "value": "application/json; charset=utf-8"
           },
           {
             "key": "Cache-Control",
             "value": "public, max-age=300"
           }
         ]
       }
     ]
   }
   ```

2. **Dynamic Feed API (api/feed.js):**
   ```javascript
   import { AnsyblGenerator } from 'ansybl-schema';
   
   export default async function handler(req, res) {
     const generator = new AnsyblGenerator();
     
     // Generate feed dynamically
     const feed = await generator.createCompleteFeed({
       title: process.env.FEED_TITLE,
       home_page_url: process.env.HOME_URL,
       feed_url: `${process.env.HOME_URL}/api/feed`,
       author: {
         name: process.env.AUTHOR_NAME,
         public_key: process.env.PUBLIC_KEY
       }
     }, await loadPosts(), process.env.PRIVATE_KEY);
     
     res.setHeader('Content-Type', 'application/json');
     res.status(200).json(feed);
   }
   ```

### Docker Deployment

1. **Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   # Install dependencies
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Copy application code
   COPY . .
   
   # Create non-root user
   RUN addgroup -g 1001 -S ansybl && \
       adduser -S ansybl -u 1001
   
   # Set permissions
   RUN chown -R ansybl:ansybl /app
   USER ansybl
   
   EXPOSE 3000
   
   CMD ["node", "server.js"]
   ```

2. **Docker Compose (docker-compose.yml):**
   ```yaml
   version: '3.8'
   
   services:
     ansybl-feed:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - FEED_TITLE=My Ansybl Feed
         - AUTHOR_NAME=Your Name
         - PUBLIC_KEY_FILE=/run/secrets/public_key
         - PRIVATE_KEY_FILE=/run/secrets/private_key
       secrets:
         - public_key
         - private_key
       volumes:
         - ./content:/app/content:ro
         - feed_data:/app/data
       restart: unless-stopped
   
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf:ro
         - ./ssl:/etc/nginx/ssl:ro
       depends_on:
         - ansybl-feed
       restart: unless-stopped
   
   secrets:
     public_key:
       file: ./keys/public.key
     private_key:
       file: ./keys/private.key
   
   volumes:
     feed_data:
   ```

## Bridge Services Deployment

### ActivityPub Bridge

1. **Environment Setup:**
   ```bash
   # Install dependencies
   npm install express helmet cors rate-limiter-flexible
   
   # Environment variables
   export ANSYBL_PRIVATE_KEY="ed25519:your_private_key"
   export ANSYBL_PUBLIC_KEY="ed25519:your_public_key"
   export BRIDGE_DOMAIN="bridge.yourdomain.com"
   export RATE_LIMIT_WINDOW=900000  # 15 minutes
   export RATE_LIMIT_MAX=100        # requests per window
   ```

2. **Bridge Server (bridge-server.js):**
   ```javascript
   import express from 'express';
   import helmet from 'helmet';
   import cors from 'cors';
   import { RateLimiterMemory } from 'rate-limiter-flexible';
   import { ActivityPubBridge } from './bridges/activitypub-bridge.js';
   
   const app = express();
   const bridge = new ActivityPubBridge();
   
   // Security middleware
   app.use(helmet());
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
   }));
   
   // Rate limiting
   const rateLimiter = new RateLimiterMemory({
     keyGenerator: (req) => req.ip,
     points: parseInt(process.env.RATE_LIMIT_MAX) || 100,
     duration: parseInt(process.env.RATE_LIMIT_WINDOW) || 900
   });
   
   app.use(async (req, res, next) => {
     try {
       await rateLimiter.consume(req.ip);
       next();
     } catch (rejRes) {
       res.status(429).json({ error: 'Too Many Requests' });
     }
   });
   
   // Bridge endpoints
   app.post('/bridge/activitypub', async (req, res) => {
     try {
       const result = await bridge.convertFromAnsybl(req.body);
       res.json(result);
     } catch (error) {
       res.status(400).json({ error: error.message });
     }
   });
   
   app.listen(3000, () => {
     console.log('ActivityPub bridge running on port 3000');
   });
   ```

3. **Systemd Service (/etc/systemd/system/ansybl-bridge.service):**
   ```ini
   [Unit]
   Description=Ansybl ActivityPub Bridge
   After=network.target
   
   [Service]
   Type=simple
   User=ansybl
   WorkingDirectory=/opt/ansybl-bridge
   ExecStart=/usr/bin/node bridge-server.js
   Restart=always
   RestartSec=10
   
   Environment=NODE_ENV=production
   EnvironmentFile=/etc/ansybl-bridge/environment
   
   # Security
   NoNewPrivileges=true
   PrivateTmp=true
   ProtectSystem=strict
   ProtectHome=true
   ReadWritePaths=/opt/ansybl-bridge/logs
   
   [Install]
   WantedBy=multi-user.target
   ```

### RSS/JSON Feed Bridge

Deploy as a serverless function for cost-effective scaling:

**Vercel Function (api/rss-bridge.js):**
```javascript
import { RSSJSONBridge } from '../lib/bridges/rss-json-bridge.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const bridge = new RSSJSONBridge();
    const { format, feed } = req.body;
    
    let result;
    switch (format) {
      case 'rss':
        result = await bridge.convertToRSS(feed);
        res.setHeader('Content-Type', 'application/rss+xml');
        break;
      case 'json':
        result = await bridge.convertToJSONFeed(feed);
        res.setHeader('Content-Type', 'application/json');
        break;
      default:
        return res.status(400).json({ error: 'Invalid format' });
    }
    
    res.status(200).send(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

## Discovery Services Setup

### Webring Registry

1. **Database Setup (PostgreSQL):**
   ```sql
   CREATE TABLE feeds (
     id SERIAL PRIMARY KEY,
     url VARCHAR(2048) UNIQUE NOT NULL,
     title VARCHAR(200) NOT NULL,
     description TEXT,
     author VARCHAR(100),
     tags TEXT[],
     last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     health_status VARCHAR(20) DEFAULT 'unknown',
     health_checked_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE INDEX idx_feeds_tags ON feeds USING GIN(tags);
   CREATE INDEX idx_feeds_health ON feeds(health_status, health_checked_at);
   ```

2. **Registry Service (webring-service.js):**
   ```javascript
   import express from 'express';
   import { Pool } from 'pg';
   import { WebringRegistry } from './webring-registry.js';
   
   const app = express();
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL
   });
   
   const registry = new WebringRegistry(pool);
   
   app.use(express.json());
   
   // Register feed
   app.post('/register', async (req, res) => {
     try {
       const result = await registry.registerFeed(req.body);
       res.json(result);
     } catch (error) {
       res.status(400).json({ error: error.message });
     }
   });
   
   // Search feeds
   app.get('/search', async (req, res) => {
     try {
       const results = await registry.searchFeeds(req.query);
       res.json(results);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   
   // Health check endpoint
   app.get('/health', (req, res) => {
     res.json({ status: 'healthy', timestamp: new Date().toISOString() });
   });
   
   app.listen(3001, () => {
     console.log('Webring registry running on port 3001');
   });
   ```

3. **Health Monitoring Cron Job:**
   ```bash
   #!/bin/bash
   # health-check.sh
   
   curl -X POST http://localhost:3001/health-check \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $HEALTH_CHECK_TOKEN"
   ```

## Security Configuration

### HTTPS and SSL

1. **Let's Encrypt with Certbot:**
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Obtain certificate
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   
   # Auto-renewal
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

2. **SSL Configuration (Nginx):**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       # Modern SSL configuration
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
       ssl_prefer_server_ciphers off;
       
       # Security headers
       add_header Strict-Transport-Security "max-age=63072000" always;
       add_header X-Content-Type-Options nosniff;
       add_header X-Frame-Options DENY;
       add_header X-XSS-Protection "1; mode=block";
       
       location / {
           root /var/www/html;
           try_files $uri $uri/ =404;
       }
   }
   ```

### Key Management

1. **Secure Key Storage:**
   ```bash
   # Create secure key directory
   sudo mkdir -p /etc/ansybl/keys
   sudo chmod 700 /etc/ansybl/keys
   
   # Generate keys with restricted permissions
   ansybl generate-keys --output /etc/ansybl/keys/
   sudo chmod 600 /etc/ansybl/keys/private.key
   sudo chmod 644 /etc/ansybl/keys/public.key
   sudo chown ansybl:ansybl /etc/ansybl/keys/*
   ```

2. **Environment Variable Security:**
   ```bash
   # /etc/ansybl/environment
   ANSYBL_PRIVATE_KEY_FILE=/etc/ansybl/keys/private.key
   ANSYBL_PUBLIC_KEY_FILE=/etc/ansybl/keys/public.key
   
   # Secure the environment file
   sudo chmod 600 /etc/ansybl/environment
   sudo chown ansybl:ansybl /etc/ansybl/environment
   ```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Fail2ban for SSH protection
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

## Performance Optimization

### Caching Strategy

1. **Nginx Caching:**
   ```nginx
   # Cache configuration
   proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=ansybl_cache:10m max_size=1g inactive=60m use_temp_path=off;
   
   location ~ \.ansybl$ {
       proxy_cache ansybl_cache;
       proxy_cache_valid 200 5m;
       proxy_cache_use_stale error timeout invalid_header updating http_500 http_502 http_503 http_504;
       
       add_header X-Cache-Status $upstream_cache_status;
       add_header Cache-Control "public, max-age=300";
   }
   ```

2. **CDN Integration (Cloudflare):**
   ```javascript
   // Cloudflare Worker for edge caching
   addEventListener('fetch', event => {
     event.respondWith(handleRequest(event.request));
   });
   
   async function handleRequest(request) {
     const url = new URL(request.url);
     
     if (url.pathname.endsWith('.ansybl')) {
       const cache = caches.default;
       const cacheKey = new Request(url.toString(), request);
       
       let response = await cache.match(cacheKey);
       
       if (!response) {
         response = await fetch(request);
         
         if (response.status === 200) {
           const headers = new Headers(response.headers);
           headers.set('Cache-Control', 'public, max-age=300');
           
           response = new Response(response.body, {
             status: response.status,
             statusText: response.statusText,
             headers: headers
           });
           
           event.waitUntil(cache.put(cacheKey, response.clone()));
         }
       }
       
       return response;
     }
     
     return fetch(request);
   }
   ```

### Database Optimization

For discovery services with PostgreSQL:

```sql
-- Optimize feed search queries
CREATE INDEX CONCURRENTLY idx_feeds_search ON feeds USING GIN(to_tsvector('english', title || ' ' || description));

-- Optimize tag searches
CREATE INDEX CONCURRENTLY idx_feeds_tags_gin ON feeds USING GIN(tags);

-- Optimize health status queries
CREATE INDEX CONCURRENTLY idx_feeds_health_status ON feeds(health_status, health_checked_at) WHERE health_status != 'active';

-- Vacuum and analyze regularly
-- Add to cron: 0 2 * * * psql -d ansybl -c "VACUUM ANALYZE feeds;"
```

## Monitoring and Maintenance

### Health Monitoring

1. **System Health Check Script:**
   ```bash
   #!/bin/bash
   # health-monitor.sh
   
   LOG_FILE="/var/log/ansybl-health.log"
   
   check_feed() {
       local url=$1
       local response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
       
       if [ "$response" = "200" ]; then
           echo "$(date): Feed $url is healthy" >> "$LOG_FILE"
           return 0
       else
           echo "$(date): Feed $url returned $response" >> "$LOG_FILE"
           return 1
       fi
   }
   
   check_service() {
       local service=$1
       if systemctl is-active --quiet "$service"; then
           echo "$(date): Service $service is running" >> "$LOG_FILE"
           return 0
       else
           echo "$(date): Service $service is not running" >> "$LOG_FILE"
           systemctl restart "$service"
           return 1
       fi
   }
   
   # Check main feed
   check_feed "https://yourdomain.com/feed.ansybl"
   
   # Check services
   check_service "nginx"
   check_service "ansybl-bridge"
   
   # Check disk space
   DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
   if [ "$DISK_USAGE" -gt 80 ]; then
       echo "$(date): Disk usage is ${DISK_USAGE}%" >> "$LOG_FILE"
   fi
   ```

2. **Prometheus Monitoring:**
   ```yaml
   # prometheus.yml
   global:
     scrape_interval: 15s
   
   scrape_configs:
     - job_name: 'ansybl-feeds'
       static_configs:
         - targets: ['yourdomain.com:443']
       metrics_path: '/metrics'
       scheme: 'https'
       
     - job_name: 'ansybl-bridge'
       static_configs:
         - targets: ['localhost:3000']
   ```

### Log Management

1. **Logrotate Configuration (/etc/logrotate.d/ansybl):**
   ```
   /var/log/ansybl-*.log {
       daily
       missingok
       rotate 30
       compress
       delaycompress
       notifempty
       create 644 ansybl ansybl
       postrotate
           systemctl reload ansybl-bridge
       endscript
   }
   ```

2. **Centralized Logging with rsyslog:**
   ```
   # /etc/rsyslog.d/ansybl.conf
   if $programname == 'ansybl-bridge' then /var/log/ansybl-bridge.log
   & stop
   ```

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/ansybl"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup feed files
tar -czf "$BACKUP_DIR/feeds_$DATE.tar.gz" /var/www/html/*.ansybl

# Backup keys (encrypted)
gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --symmetric \
    --output "$BACKUP_DIR/keys_$DATE.gpg" /etc/ansybl/keys/

# Backup database (if using discovery services)
if command -v pg_dump &> /dev/null; then
    pg_dump ansybl | gzip > "$BACKUP_DIR/database_$DATE.sql.gz"
fi

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.gpg" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

## Troubleshooting

### Common Issues

#### Feed Not Loading

**Symptoms:** 404 errors, CORS issues, or invalid JSON responses

**Solutions:**
1. Check web server configuration:
   ```bash
   # Test direct access
   curl -v https://yourdomain.com/feed.ansybl
   
   # Check MIME type
   curl -I https://yourdomain.com/feed.ansybl
   ```

2. Validate feed format:
   ```bash
   ansybl validate https://yourdomain.com/feed.ansybl
   ```

3. Check file permissions:
   ```bash
   ls -la /var/www/html/feed.ansybl
   # Should be readable by web server user
   ```

#### Signature Verification Failures

**Symptoms:** Parsers report invalid signatures

**Solutions:**
1. Verify key format:
   ```bash
   ansybl verify-key --public-key "ed25519:your_public_key"
   ```

2. Check canonical JSON generation:
   ```bash
   ansybl canonicalize --input feed.ansybl --output canonical.json
   ```

3. Re-sign content:
   ```bash
   ansybl sign-feed --feed feed.ansybl --key private.key --output signed-feed.ansybl
   ```

#### Bridge Service Errors

**Symptoms:** 500 errors, timeout issues, or conversion failures

**Solutions:**
1. Check service logs:
   ```bash
   journalctl -u ansybl-bridge -f
   ```

2. Test bridge endpoints:
   ```bash
   curl -X POST http://localhost:3000/bridge/activitypub \
        -H "Content-Type: application/json" \
        -d @test-feed.json
   ```

3. Verify rate limiting:
   ```bash
   # Check current rate limit status
   curl -I http://localhost:3000/health
   ```

#### Performance Issues

**Symptoms:** Slow feed loading, high server load

**Solutions:**
1. Enable compression:
   ```nginx
   gzip on;
   gzip_types application/json;
   ```

2. Optimize feed size:
   ```bash
   # Check feed size
   ls -lh feed.ansybl
   
   # Consider pagination for large feeds
   ansybl paginate --feed feed.ansybl --items-per-page 50
   ```

3. Monitor resource usage:
   ```bash
   htop
   iotop
   ```

### Diagnostic Tools

1. **Feed Validator:**
   ```bash
   ansybl validate --verbose --feed https://yourdomain.com/feed.ansybl
   ```

2. **Network Diagnostics:**
   ```bash
   # Test SSL configuration
   openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
   
   # Check DNS resolution
   dig yourdomain.com
   
   # Test connectivity
   traceroute yourdomain.com
   ```

3. **Performance Testing:**
   ```bash
   # Load testing with Apache Bench
   ab -n 1000 -c 10 https://yourdomain.com/feed.ansybl
   
   # Monitor during load test
   watch -n 1 'ps aux | grep nginx'
   ```

### Getting Help

- **Documentation:** https://ansybl.org/docs
- **Community Forum:** https://forum.ansybl.org
- **GitHub Issues:** https://github.com/ansybl/protocol/issues
- **Discord:** https://discord.gg/ansybl

### Emergency Procedures

1. **Service Recovery:**
   ```bash
   # Quick service restart
   sudo systemctl restart nginx ansybl-bridge
   
   # Restore from backup
   sudo tar -xzf /backup/ansybl/feeds_latest.tar.gz -C /
   ```

2. **Key Compromise Response:**
   ```bash
   # Generate new keys
   ansybl generate-keys --output /tmp/new-keys/
   
   # Update feed with new public key
   ansybl update-author --feed feed.ansybl --public-key "ed25519:new_key"
   
   # Re-sign all content
   ansybl resign-feed --feed feed.ansybl --key /tmp/new-keys/private.key
   ```

This deployment guide provides comprehensive coverage for hosting Ansybl feeds and services across various platforms and environments. Regular maintenance and monitoring ensure reliable operation and optimal performance.