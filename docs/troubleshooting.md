# Ansybl Protocol Troubleshooting Guide

This guide provides solutions to common issues encountered when implementing, deploying, or using the Ansybl protocol.

## Table of Contents

1. [Feed Validation Issues](#feed-validation-issues)
2. [Signature Problems](#signature-problems)
3. [Parser Implementation Issues](#parser-implementation-issues)
4. [Bridge Service Problems](#bridge-service-problems)
5. [Discovery Service Issues](#discovery-service-issues)
6. [Performance Problems](#performance-problems)
7. [Security Issues](#security-issues)
8. [Network and Connectivity](#network-and-connectivity)
9. [Development and Testing](#development-and-testing)
10. [Emergency Procedures](#emergency-procedures)

## Feed Validation Issues

### Invalid JSON Schema Errors

**Problem:** Feed fails schema validation with cryptic error messages.

**Common Causes:**
- Missing required fields
- Incorrect data types
- Invalid URL formats
- Malformed timestamps

**Solutions:**

1. **Use the official validator:**
   ```bash
   ansybl validate --verbose --feed your-feed.ansybl
   ```

2. **Check required fields:**
   ```javascript
   // Minimal required structure
   {
     "version": "https://ansybl.org/version/1.0",
     "title": "Your Feed Title",
     "home_page_url": "https://yourdomain.com",
     "feed_url": "https://yourdomain.com/feed.ansybl",
     "author": {
       "name": "Your Name",
       "public_key": "ed25519:your_public_key_here"
     },
     "items": []
   }
   ```

3. **Validate URLs:**
   ```bash
   # URLs must be HTTPS
   curl -I https://yourdomain.com  # Should return 200
   ```

4. **Check timestamp format:**
   ```javascript
   // Correct ISO 8601 format
   "date_published": "2025-11-04T10:00:00Z"
   
   // Common mistakes to avoid
   "date_published": "2025-11-04"           // Missing time
   "date_published": "11/04/2025 10:00 AM"  // Wrong format
   ```

### Content Item Validation Failures

**Problem:** Individual items fail validation.

**Solutions:**

1. **Ensure content presence:**
   ```javascript
   // At least one content field OR title is required
   {
     "id": "https://example.com/post/1",
     "url": "https://example.com/post/1",
     "content_text": "Some content",  // OR content_html OR title
     "date_published": "2025-11-04T10:00:00Z",
     "signature": "ed25519:signature_here"
   }
   ```

2. **Validate attachment structure:**
   ```javascript
   "attachments": [{
     "url": "https://example.com/image.jpg",
     "mime_type": "image/jpeg",  // Required
     "alt_text": "Description"   // Recommended for accessibility
   }]
   ```

### Extension Field Issues

**Problem:** Custom fields cause validation errors.

**Solutions:**

1. **Use underscore prefix for extensions:**
   ```javascript
   // Correct
   "_custom_field": "custom data"
   "_my_extension": { "nested": "data" }
   
   // Incorrect - will cause validation error
   "custom_field": "custom data"
   ```

2. **Preserve extensions during parsing:**
   ```javascript
   const result = await parser.parse(feed, { 
     preserveExtensions: true 
   });
   ```

## Signature Problems

### Signature Verification Failures

**Problem:** Valid signatures are reported as invalid.

**Common Causes:**
- Incorrect canonical JSON generation
- Key format issues
- Timestamp drift
- Content modification after signing

**Solutions:**

1. **Verify key format:**
   ```bash
   # Public key should start with ed25519:
   echo "ed25519:AAAC4NiQqKqBdgYkCdoO21cjWFPluCcHK2aXgwf9fAG2Ag==" | base64 -d
   ```

2. **Check canonical JSON generation:**
   ```javascript
   import { CanonicalJSONSerializer } from 'ansybl-schema';
   
   const canonicalizer = new CanonicalJSONSerializer();
   const canonical = canonicalizer.canonicalize(itemData);
   console.log('Canonical JSON:', canonical);
   ```

3. **Debug signature data:**
   ```javascript
   // Log the exact data being signed
   const signatureData = {
     author: item.author,
     content_text: item.content_text,
     date_published: item.date_published,
     id: item.id,
     url: item.url
   };
   console.log('Signature data:', JSON.stringify(signatureData, null, 2));
   ```

4. **Re-generate signatures:**
   ```bash
   ansybl resign-feed --feed feed.ansybl --key private.key --output resigned-feed.ansybl
   ```

### Key Management Issues

**Problem:** Lost or corrupted cryptographic keys.

**Solutions:**

1. **Key recovery from backup:**
   ```bash
   # Restore from encrypted backup
   gpg --decrypt keys_backup.gpg | tar -xz
   ```

2. **Generate new keys and migrate:**
   ```bash
   # Generate new key pair
   ansybl generate-keys --output ./new-keys/
   
   # Update feed with new public key
   ansybl update-author \
     --feed feed.ansybl \
     --public-key "$(cat ./new-keys/public.key)" \
     --private-key ./new-keys/private.key
   ```

3. **Key rotation procedure:**
   ```javascript
   // Gradual key rotation
   const feed = {
     // ... existing feed data
     author: {
       name: "Author Name",
       public_key: "ed25519:new_public_key",
       _previous_keys: ["ed25519:old_public_key"]  // For backward compatibility
     }
   };
   ```

## Parser Implementation Issues

### Memory Issues with Large Feeds

**Problem:** Parser crashes or runs out of memory with large feeds.

**Solutions:**

1. **Implement streaming parser:**
   ```javascript
   import { createReadStream } from 'fs';
   import { pipeline } from 'stream/promises';
   
   const parser = new AnsyblStreamingParser();
   
   await pipeline(
     createReadStream('large-feed.ansybl'),
     parser.createParseStream(),
     async function* (chunks) {
       for await (const chunk of chunks) {
         yield processChunk(chunk);
       }
     }
   );
   ```

2. **Use pagination:**
   ```javascript
   const items = parser.getItems(feed, { 
     limit: 50,
     offset: 0 
   });
   ```

3. **Optimize memory usage:**
   ```javascript
   // Process items one at a time
   for (const item of feed.items) {
     await processItem(item);
     // Item can be garbage collected after processing
   }
   ```

### Cross-Implementation Compatibility

**Problem:** Different parsers produce different results for the same feed.

**Solutions:**

1. **Use reference test suite:**
   ```bash
   npm test -- --grep "cross-implementation"
   ```

2. **Validate canonical JSON consistency:**
   ```javascript
   // All implementations should produce identical canonical JSON
   const canonical1 = parser1.canonicalize(data);
   const canonical2 = parser2.canonicalize(data);
   assert.strictEqual(canonical1, canonical2);
   ```

3. **Test with reference feeds:**
   ```bash
   # Download reference test feeds
   curl -O https://ansybl.org/test-feeds/comprehensive.ansybl
   ansybl validate comprehensive.ansybl
   ```

## Bridge Service Problems

### ActivityPub Bridge Issues

**Problem:** Conversion to ActivityPub format fails or produces invalid output.

**Solutions:**

1. **Check ActivityPub actor creation:**
   ```javascript
   const actor = {
     "@context": "https://www.w3.org/ns/activitystreams",
     "type": "Person",
     "id": `https://yourdomain.com/actor`,
     "name": ansyblFeed.author.name,
     "preferredUsername": ansyblFeed.author.name.toLowerCase().replace(/\s+/g, ''),
     "inbox": `https://yourdomain.com/actor/inbox`,
     "outbox": `https://yourdomain.com/actor/outbox`,
     "publicKey": {
       "id": `https://yourdomain.com/actor#main-key`,
       "owner": `https://yourdomain.com/actor`,
       "publicKeyPem": convertEd25519ToPEM(ansyblFeed.author.public_key)
     }
   };
   ```

2. **Debug content conversion:**
   ```javascript
   // Log conversion steps
   console.log('Original Ansybl item:', JSON.stringify(item, null, 2));
   const activityPubNote = convertToNote(item);
   console.log('Converted ActivityPub note:', JSON.stringify(activityPubNote, null, 2));
   ```

3. **Test with ActivityPub validator:**
   ```bash
   curl -X POST https://activitypub-validator.example.com/validate \
        -H "Content-Type: application/json" \
        -d @converted-activity.json
   ```

### RSS/JSON Feed Bridge Issues

**Problem:** RSS or JSON Feed output is malformed or missing data.

**Solutions:**

1. **Validate RSS output:**
   ```bash
   # Use RSS validator
   curl -X POST https://validator.w3.org/feed/check.cgi \
        -F "rawdata=@converted-feed.rss"
   ```

2. **Check JSON Feed compliance:**
   ```javascript
   // Ensure required JSON Feed fields
   const jsonFeed = {
     version: "https://jsonfeed.org/version/1.1",
     title: ansyblFeed.title,
     home_page_url: ansyblFeed.home_page_url,
     feed_url: ansyblFeed.feed_url,
     items: ansyblFeed.items.map(convertItem)
   };
   ```

3. **Handle media attachments:**
   ```javascript
   // Convert Ansybl attachments to RSS enclosures
   const enclosures = item.attachments?.map(att => ({
     url: att.url,
     type: att.mime_type,
     length: att.size_in_bytes || 0
   })) || [];
   ```

## Discovery Service Issues

### Webring Registry Problems

**Problem:** Feeds not appearing in search results or health checks failing.

**Solutions:**

1. **Check feed registration:**
   ```bash
   curl -X POST https://webring.ansybl.org/register \
        -H "Content-Type: application/json" \
        -d '{
          "url": "https://yourdomain.com/feed.ansybl",
          "title": "Your Feed Title",
          "description": "Feed description",
          "tags": ["tag1", "tag2"]
        }'
   ```

2. **Debug health check failures:**
   ```bash
   # Manual health check
   curl -v https://yourdomain.com/feed.ansybl
   
   # Check from webring server
   curl -X POST https://webring.ansybl.org/health-check \
        -H "Content-Type: application/json" \
        -d '{"url": "https://yourdomain.com/feed.ansybl"}'
   ```

3. **Fix search indexing:**
   ```sql
   -- Rebuild search index
   REINDEX INDEX idx_feeds_search;
   
   -- Update feed metadata
   UPDATE feeds SET 
     last_updated = CURRENT_TIMESTAMP,
     health_status = 'active'
   WHERE url = 'https://yourdomain.com/feed.ansybl';
   ```

### Webmention Issues

**Problem:** Webmentions not being sent or received properly.

**Solutions:**

1. **Verify Webmention endpoint discovery:**
   ```bash
   # Check for Webmention endpoint in HTML
   curl -s https://target-site.com | grep -i webmention
   
   # Check HTTP headers
   curl -I https://target-site.com | grep -i webmention
   ```

2. **Test Webmention sending:**
   ```bash
   curl -X POST https://target-site.com/webmention \
        -d "source=https://yourdomain.com/post/1" \
        -d "target=https://target-site.com/post/1"
   ```

3. **Debug verification process:**
   ```javascript
   // Verify source contains target link
   const sourceContent = await fetch(sourceUrl).then(r => r.text());
   const containsTarget = sourceContent.includes(targetUrl);
   console.log('Source contains target:', containsTarget);
   ```

## Performance Problems

### Slow Feed Loading

**Problem:** Feeds take too long to load or parse.

**Solutions:**

1. **Enable compression:**
   ```nginx
   # Nginx configuration
   gzip on;
   gzip_types application/json;
   gzip_min_length 1000;
   ```

2. **Implement caching:**
   ```javascript
   // Simple in-memory cache
   const feedCache = new Map();
   
   async function getCachedFeed(url) {
     const cached = feedCache.get(url);
     if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
       return cached.data;
     }
     
     const feed = await fetchFeed(url);
     feedCache.set(url, { data: feed, timestamp: Date.now() });
     return feed;
   }
   ```

3. **Optimize feed size:**
   ```bash
   # Check feed size
   ls -lh feed.ansybl
   
   # Consider pagination for large feeds
   ansybl paginate --feed feed.ansybl --items-per-page 50
   ```

### High Memory Usage

**Problem:** Parser or generator uses excessive memory.

**Solutions:**

1. **Use streaming processing:**
   ```javascript
   // Process items as stream
   const parser = new AnsyblStreamingParser();
   parser.on('item', (item) => {
     processItem(item);
   });
   parser.parse(feedStream);
   ```

2. **Implement garbage collection hints:**
   ```javascript
   // Force garbage collection after processing large feeds
   if (global.gc && feed.items.length > 1000) {
     global.gc();
   }
   ```

3. **Monitor memory usage:**
   ```javascript
   const used = process.memoryUsage();
   console.log('Memory usage:', {
     rss: Math.round(used.rss / 1024 / 1024) + ' MB',
     heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
     heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB'
   });
   ```

## Security Issues

### SSL/TLS Problems

**Problem:** HTTPS certificate issues or SSL handshake failures.

**Solutions:**

1. **Check certificate validity:**
   ```bash
   openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
   ```

2. **Verify certificate chain:**
   ```bash
   curl -I https://yourdomain.com/feed.ansybl
   ```

3. **Update certificates:**
   ```bash
   # Let's Encrypt renewal
   sudo certbot renew --dry-run
   sudo certbot renew
   ```

### Content Security Issues

**Problem:** Malicious content in feeds or XSS vulnerabilities.

**Solutions:**

1. **Sanitize HTML content:**
   ```javascript
   import DOMPurify from 'dompurify';
   
   const sanitizedHTML = DOMPurify.sanitize(item.content_html, {
     ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
     ALLOWED_ATTR: ['href']
   });
   ```

2. **Validate content size:**
   ```javascript
   const MAX_CONTENT_SIZE = 100000; // 100KB
   
   if (item.content_text && item.content_text.length > MAX_CONTENT_SIZE) {
     throw new Error('Content too large');
   }
   ```

3. **Implement rate limiting:**
   ```javascript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/api/', limiter);
   ```

## Network and Connectivity

### DNS Resolution Issues

**Problem:** Domain names not resolving or pointing to wrong servers.

**Solutions:**

1. **Check DNS records:**
   ```bash
   dig yourdomain.com
   dig AAAA yourdomain.com  # IPv6
   nslookup yourdomain.com
   ```

2. **Test from different locations:**
   ```bash
   # Use different DNS servers
   dig @8.8.8.8 yourdomain.com
   dig @1.1.1.1 yourdomain.com
   ```

3. **Clear DNS cache:**
   ```bash
   # Linux
   sudo systemctl restart systemd-resolved
   
   # macOS
   sudo dscacheutil -flushcache
   
   # Windows
   ipconfig /flushdns
   ```

### Firewall and Port Issues

**Problem:** Connections blocked by firewall or wrong ports.

**Solutions:**

1. **Check port accessibility:**
   ```bash
   telnet yourdomain.com 443
   nc -zv yourdomain.com 443
   ```

2. **Configure firewall:**
   ```bash
   # UFW (Ubuntu)
   sudo ufw allow 443/tcp
   sudo ufw status
   
   # iptables
   sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
   ```

3. **Test from external network:**
   ```bash
   # Use external service to test connectivity
   curl -I https://yourdomain.com/feed.ansybl
   ```

## Development and Testing

### Test Environment Setup

**Problem:** Tests failing due to environment issues.

**Solutions:**

1. **Set up test environment:**
   ```bash
   # Install test dependencies
   npm install --save-dev
   
   # Run specific test suite
   npm test -- --grep "integration"
   ```

2. **Mock external services:**
   ```javascript
   // Mock webring registry for tests
   const mockRegistry = {
     registerFeed: jest.fn().mockResolvedValue({ success: true }),
     searchFeeds: jest.fn().mockResolvedValue([])
   };
   ```

3. **Use test fixtures:**
   ```javascript
   // Load test data
   const testFeed = JSON.parse(
     fs.readFileSync('./test/fixtures/valid-feed.json', 'utf8')
   );
   ```

### Debugging Parser Issues

**Problem:** Parser behaving unexpectedly during development.

**Solutions:**

1. **Enable debug logging:**
   ```javascript
   const parser = new AnsyblParser({ debug: true });
   parser.on('debug', (message) => console.log('DEBUG:', message));
   ```

2. **Use step-by-step debugging:**
   ```javascript
   // Break down parsing steps
   console.log('1. Validating JSON...');
   const validation = validator.validateDocument(feedData);
   console.log('Validation result:', validation);
   
   console.log('2. Parsing structure...');
   const parsed = parser.parseStructure(feedData);
   console.log('Parsed structure:', parsed);
   
   console.log('3. Verifying signatures...');
   const signatures = await parser.verifySignatures(parsed);
   console.log('Signature results:', signatures);
   ```

3. **Compare with reference implementation:**
   ```bash
   # Test against reference parser
   ansybl parse --reference --feed test-feed.ansybl
   ```

## Emergency Procedures

### Service Recovery

**Problem:** Critical service failure requiring immediate recovery.

**Immediate Actions:**

1. **Check service status:**
   ```bash
   systemctl status nginx ansybl-bridge
   journalctl -u ansybl-bridge --since "10 minutes ago"
   ```

2. **Restart services:**
   ```bash
   sudo systemctl restart nginx
   sudo systemctl restart ansybl-bridge
   ```

3. **Restore from backup:**
   ```bash
   # Restore feed files
   sudo cp /backup/ansybl/feeds_latest.tar.gz /tmp/
   cd /var/www/html
   sudo tar -xzf /tmp/feeds_latest.tar.gz
   
   # Restore database (if applicable)
   psql ansybl < /backup/ansybl/database_latest.sql
   ```

### Data Corruption Recovery

**Problem:** Feed files or database corrupted.

**Recovery Steps:**

1. **Assess damage:**
   ```bash
   # Check file integrity
   ansybl validate --feed /var/www/html/feed.ansybl
   
   # Check database integrity
   psql ansybl -c "SELECT COUNT(*) FROM feeds;"
   ```

2. **Restore from backup:**
   ```bash
   # Find latest good backup
   ls -la /backup/ansybl/ | grep feeds
   
   # Restore specific backup
   sudo tar -xzf /backup/ansybl/feeds_20251104_120000.tar.gz -C /var/www/html/
   ```

3. **Regenerate corrupted data:**
   ```bash
   # Regenerate feed from source content
   ansybl generate-feed \
     --config ./config.json \
     --content ./content/ \
     --key ./keys/private.key \
     --output ./feed.ansybl
   ```

### Security Incident Response

**Problem:** Suspected security breach or compromise.

**Immediate Actions:**

1. **Isolate affected systems:**
   ```bash
   # Block suspicious IPs
   sudo ufw deny from suspicious.ip.address
   
   # Stop affected services
   sudo systemctl stop ansybl-bridge
   ```

2. **Assess compromise:**
   ```bash
   # Check for unauthorized changes
   sudo find /var/www/html -name "*.ansybl" -mtime -1 -ls
   
   # Review access logs
   sudo tail -n 1000 /var/log/nginx/access.log | grep -E "(POST|PUT|DELETE)"
   ```

3. **Rotate compromised keys:**
   ```bash
   # Generate new keys immediately
   ansybl generate-keys --output /tmp/emergency-keys/
   
   # Update feeds with new keys
   ansybl update-author \
     --feed /var/www/html/feed.ansybl \
     --public-key "$(cat /tmp/emergency-keys/public.key)" \
     --private-key /tmp/emergency-keys/private.key
   ```

### Contact Information

For critical issues requiring immediate assistance:

- **Emergency Support:** emergency@ansybl.org
- **Security Issues:** security@ansybl.org
- **Community Discord:** https://discord.gg/ansybl
- **GitHub Issues:** https://github.com/ansybl/protocol/issues

### Escalation Procedures

1. **Level 1:** Check this troubleshooting guide
2. **Level 2:** Search community forum and GitHub issues
3. **Level 3:** Post detailed issue report with logs
4. **Level 4:** Contact emergency support for critical production issues

Remember to include the following information when reporting issues:
- Ansybl protocol version
- Implementation language/platform
- Error messages and logs
- Steps to reproduce
- Expected vs. actual behavior
- System environment details