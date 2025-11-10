# Production Readiness Guide

This document outlines the production readiness features implemented in the Ansybl Example Website.

## Overview

The application includes comprehensive production deployment features:

- **Configuration Management**: Environment-specific configuration
- **Monitoring & Logging**: Structured logging with correlation IDs
- **Health Checks**: Liveness and readiness probes
- **Scaling**: Horizontal and vertical scaling support
- **High Availability**: Load balancing and failover
- **Backup & Recovery**: Automated backup and restore procedures
- **Security**: Production-grade security configurations
- **Deployment Automation**: Scripts and containerization

## Configuration Management

### Environment-Based Configuration

The application uses a hierarchical configuration system:

```
config/
├── default.js       # Base configuration
├── development.js   # Development overrides
├── production.js    # Production overrides
└── index.js        # Configuration loader
```

Configuration is automatically loaded based on `NODE_ENV`:

```javascript
import config from './config/index.js';

console.log(config.server.port);  // Environment-specific port
console.log(config.isProduction); // true in production
```

### Environment Variables

All sensitive configuration is loaded from environment variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `BASE_URL` - Public URL
- `ANSYBL_PRIVATE_KEY` - Cryptographic signing key
- `SESSION_SECRET` - Session encryption key
- `DATABASE_URL` - Database connection string

See `.env.example` for complete list.

### Secrets Management

Production secrets should be:
- Never committed to version control
- Stored in secure secret management systems
- Loaded via environment variables
- Rotated regularly

## Monitoring & Logging

### Structured Logging

The application uses structured JSON logging in production:

```javascript
import logger from './lib/logger.js';

logger.info('User action', {
  correlationId: req.correlationId,
  userId: user.id,
  action: 'post_created'
});
```

Features:
- **Correlation IDs**: Track requests across services
- **Log Levels**: debug, info, warn, error
- **Structured Output**: JSON format for log aggregation
- **Context Preservation**: Automatic context propagation

### Application Performance Monitoring

Built-in metrics collection:

```javascript
import monitor from './lib/monitoring.js';

// Metrics are automatically collected
const metrics = monitor.getMetrics();
```

Tracked metrics:
- Request rate and latency
- Error rates by endpoint
- Memory and CPU usage
- Custom business metrics

### Health Check Endpoints

**Liveness Probe** (`/health`):
- Checks if application is running
- Returns 200 if healthy, 503 if unhealthy
- Used by load balancers and orchestrators

**Readiness Probe** (`/ready`):
- Checks if application can serve traffic
- Verifies dependencies are available
- Returns 200 if ready, 503 if not ready

**Metrics Endpoint** (`/metrics`):
- Exposes application metrics
- Compatible with Prometheus
- Includes system and custom metrics

**Status Endpoint** (`/status`):
- Detailed application status
- System information
- Performance statistics

### Prometheus Integration

Metrics are exposed in Prometheus format at `/metrics`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ansybl-app'
    static_configs:
      - targets: ['app:3000']
```

### Grafana Dashboards

Pre-configured dashboards for:
- Application performance
- System resources
- Error rates
- Request latency

Access Grafana at `http://localhost:3001` (Docker deployment).

## Scaling

### Horizontal Scaling

**Docker Compose:**
```bash
docker-compose up -d --scale app=5
```

**Kubernetes:**
```bash
kubectl scale deployment ansybl-app --replicas=5 -n ansybl
```

**Auto-scaling (Kubernetes):**
- Configured via HorizontalPodAutoscaler
- Scales based on CPU and memory usage
- Min replicas: 3, Max replicas: 10

### Vertical Scaling

Increase resources per instance:

**Docker:**
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '2'
```

**Kubernetes:**
```yaml
resources:
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Load Balancing

**Nginx** (included in all deployments):
- Round-robin load balancing
- Health check integration
- Connection pooling
- Rate limiting

**Kubernetes Ingress**:
- Automatic load balancing
- SSL termination
- Path-based routing

## High Availability

### Redundancy

- **Multiple Replicas**: Run 3+ instances
- **Health Checks**: Automatic failure detection
- **Rolling Updates**: Zero-downtime deployments
- **Graceful Shutdown**: Proper connection draining

### Failover

**Automatic Failover:**
- Load balancer removes unhealthy instances
- Traffic redirected to healthy instances
- Failed instances automatically restarted

**Database Failover:**
- Connection retry logic
- Circuit breaker pattern
- Fallback to read replicas

### Session Management

For multi-instance deployments:
- Use Redis for session storage
- Enable sticky sessions in load balancer
- Implement stateless authentication (JWT)

## Backup & Recovery

### Automated Backups

**Setup Cron Job:**
```bash
crontab -e
# Add: 0 2 * * * /var/app/ansybl-example/scripts/backup.sh
```

**Backup Script** (`scripts/backup.sh`):
- Backs up application data
- Backs up uploaded files
- Compresses and timestamps backups
- Uploads to S3 (optional)
- Retains last 30 days

### Manual Backup

```bash
bash scripts/backup.sh
```

Backups stored in `/var/backups/ansybl-example/`

### Restore Procedure

```bash
# List backups
ls -lh /var/backups/ansybl-example/

# Restore specific backup
bash scripts/restore.sh ansybl-example_20250101_020000.tar.gz
```

The restore script:
- Creates safety backup of current data
- Extracts backup archive
- Restores data and uploads
- Restarts application
- Verifies service health

### Disaster Recovery

**Recovery Time Objective (RTO)**: < 1 hour
**Recovery Point Objective (RPO)**: < 24 hours

**Disaster Recovery Steps:**
1. Provision new infrastructure
2. Install application
3. Restore from latest backup
4. Update DNS records
5. Verify functionality

## Deployment Methods

### 1. Traditional Server Deployment

**Setup:**
```bash
sudo bash scripts/setup-production.sh
```

**Deploy:**
```bash
npm run deploy
```

**Features:**
- Systemd service management
- Nginx reverse proxy
- Logrotate integration
- Automated SSL with Let's Encrypt

### 2. Docker Deployment

**Build:**
```bash
npm run docker:build
```

**Deploy:**
```bash
npm run docker:up
```

**Features:**
- Multi-stage builds
- Non-root user
- Health checks
- Volume management
- Service orchestration

### 3. Kubernetes Deployment

**Deploy:**
```bash
npm run k8s:deploy
```

**Features:**
- Horizontal pod autoscaling
- Rolling updates
- Persistent volumes
- Ingress with SSL
- Resource limits

## Security

### Production Security Features

- **HTTPS Enforcement**: All traffic over TLS
- **Security Headers**: Helmet.js configuration
- **Rate Limiting**: API and endpoint protection
- **Input Validation**: Comprehensive validation
- **XSS Protection**: Content sanitization
- **CSRF Protection**: Token-based protection
- **Secrets Management**: Environment-based secrets
- **Non-root Execution**: Runs as unprivileged user

### Security Checklist

- [ ] Change all default passwords
- [ ] Configure firewall rules
- [ ] Enable HTTPS with valid certificate
- [ ] Set secure environment variables
- [ ] Configure rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Monitor security logs
- [ ] Implement backup strategy
- [ ] Test disaster recovery

## Performance Optimization

### Caching

**Enable in Production:**
```env
ENABLE_CACHE=true
CACHE_TTL=600
```

**Cache Strategy:**
- Feed caching with TTL
- Static asset caching
- Response compression
- Connection pooling

### Database Optimization

- Connection pooling
- Query optimization
- Index management
- Read replicas

### CDN Integration

Serve static assets through CDN:
- Images and media files
- CSS and JavaScript
- Font files

### Compression

- Gzip compression enabled
- Brotli compression (nginx)
- Image optimization
- Minification

## Monitoring Best Practices

### Key Metrics to Monitor

**Application Metrics:**
- Request rate and latency
- Error rate by endpoint
- Active connections
- Queue depth

**System Metrics:**
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

**Business Metrics:**
- User registrations
- Content creation rate
- API usage
- Feature adoption

### Alerting

Configure alerts for:
- Service downtime
- High error rates
- Performance degradation
- Resource exhaustion
- Security events

### Log Aggregation

Recommended tools:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch Logs
- Datadog

## Troubleshooting

### Common Issues

**High Memory Usage:**
- Check for memory leaks
- Review metrics endpoint
- Increase memory limits
- Enable garbage collection logging

**Slow Response Times:**
- Check system resources
- Review slow query logs
- Enable caching
- Optimize database queries

**Connection Timeouts:**
- Increase timeout values
- Check network connectivity
- Review load balancer settings
- Scale horizontally

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

View detailed logs:
```bash
# Systemd
journalctl -u ansybl-example -f

# Docker
docker-compose logs -f app

# Kubernetes
kubectl logs -f deployment/ansybl-app -n ansybl
```

## Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor health checks
- Review error logs
- Check disk space

**Weekly:**
- Review performance metrics
- Analyze slow queries
- Check backup status

**Monthly:**
- Security updates
- Dependency updates
- Certificate renewal
- Backup testing

### Update Procedure

1. Test updates in staging
2. Create backup
3. Deploy with rolling update
4. Monitor health checks
5. Verify functionality
6. Rollback if issues

## Support

For production issues:
1. Check health endpoints
2. Review logs
3. Check monitoring dashboards
4. Consult troubleshooting guide
5. Contact support team

## Additional Resources

- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Security Implementation](./SECURITY.md)
- [Troubleshooting Guide](./troubleshooting.md)
