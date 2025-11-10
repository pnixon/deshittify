# Deployment Guide

This guide covers deploying the Ansybl Example Website to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Deployment Methods](#deployment-methods)
  - [Traditional Server Deployment](#traditional-server-deployment)
  - [Docker Deployment](#docker-deployment)
  - [Kubernetes Deployment](#kubernetes-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Backup and Recovery](#backup-and-recovery)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: v20.x or higher
- **Memory**: Minimum 512MB RAM (1GB+ recommended)
- **Storage**: 10GB+ for application and uploads
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, or similar)

### Required Software

- Node.js and npm
- Git
- Nginx (for reverse proxy)
- PM2 or systemd (for process management)

### Optional Software

- Docker and Docker Compose (for containerized deployment)
- Kubernetes (for orchestrated deployment)
- Redis (for session storage and caching)
- Prometheus and Grafana (for monitoring)

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
nano .env
```

**Required Variables:**

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com
SITE_TITLE=Your Site Title
ANSYBL_PRIVATE_KEY=your-generated-private-key
```

**Generate Cryptographic Keys:**

```bash
node -e "import('./lib/signature.js').then(m => m.generateKeyPair().then(k => console.log('PRIVATE:', k.privateKey, '\nPUBLIC:', k.publicKey)))"
```

### Configuration Files

The application uses environment-specific configuration:

- `config/default.js` - Base configuration
- `config/development.js` - Development overrides
- `config/production.js` - Production overrides

Configuration is automatically loaded based on `NODE_ENV`.

## Deployment Methods

### Traditional Server Deployment

#### 1. Initial Setup

Run the production setup script:

```bash
sudo bash scripts/setup-production.sh
```

This script will:
- Create application user and directories
- Install Node.js and PM2
- Configure systemd service
- Setup logrotate
- Configure nginx (if installed)

#### 2. Deploy Application

```bash
# Clone or copy application files
cd /var/app/ansybl-example

# Install dependencies
npm ci --production

# Configure environment
cp .env.example .env
nano .env

# Start service
sudo systemctl start ansybl-example
sudo systemctl enable ansybl-example
```

#### 3. Configure Nginx

Edit `/etc/nginx/sites-available/ansybl-example` and configure your domain.

Enable SSL with Let's Encrypt:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 4. Verify Deployment

```bash
# Check service status
systemctl status ansybl-example

# Check logs
journalctl -u ansybl-example -f

# Test health endpoint
curl http://localhost:3000/health
```

### Docker Deployment

#### 1. Build Image

```bash
docker build -t ansybl-example:latest .
```

#### 2. Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale application
docker-compose up -d --scale app=3
```

#### 3. Access Application

The application will be available at `http://localhost` (port 80).

Services:
- Application: http://localhost
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Kubernetes Deployment

#### 1. Prerequisites

- Kubernetes cluster (v1.20+)
- kubectl configured
- Ingress controller installed
- cert-manager for SSL (optional)

#### 2. Create Namespace

```bash
kubectl create namespace ansybl
```

#### 3. Configure Secrets

```bash
# Create secrets
kubectl create secret generic ansybl-secrets \
  --from-literal=BASE_URL=https://your-domain.com \
  --from-literal=SESSION_SECRET=your-session-secret \
  --from-literal=ANSYBL_PRIVATE_KEY=your-private-key \
  -n ansybl
```

#### 4. Deploy Application

```bash
# Apply configurations
kubectl apply -f kubernetes/deployment.yaml -n ansybl
kubectl apply -f kubernetes/ingress.yaml -n ansybl

# Check deployment
kubectl get pods -n ansybl
kubectl get svc -n ansybl
kubectl get ingress -n ansybl
```

#### 5. Monitor Deployment

```bash
# Watch pods
kubectl get pods -n ansybl -w

# View logs
kubectl logs -f deployment/ansybl-app -n ansybl

# Check HPA status
kubectl get hpa -n ansybl
```

## Monitoring and Maintenance

### Health Checks

The application provides several health check endpoints:

- `/health` - Overall health status
- `/ready` - Readiness for traffic
- `/metrics` - Application metrics
- `/status` - Detailed status information

### Logging

Logs are written to:
- **Systemd**: `journalctl -u ansybl-example -f`
- **Docker**: `docker-compose logs -f app`
- **Kubernetes**: `kubectl logs -f deployment/ansybl-app -n ansybl`
- **File**: `/var/log/ansybl-example/` (traditional deployment)

### Monitoring with Prometheus

Access Prometheus at `http://localhost:9090` (Docker deployment).

Key metrics to monitor:
- Request rate and latency
- Error rate
- Memory usage
- CPU usage
- Active connections

### Visualization with Grafana

Access Grafana at `http://localhost:3001` (Docker deployment).

Default credentials:
- Username: `admin`
- Password: `admin` (change on first login)

## Backup and Recovery

### Automated Backups

Setup automated backups with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /var/app/ansybl-example/scripts/backup.sh
```

### Manual Backup

```bash
# Run backup script
bash scripts/backup.sh

# Backups are stored in /var/backups/ansybl-example/
```

### Restore from Backup

```bash
# List available backups
ls -lh /var/backups/ansybl-example/

# Restore specific backup
bash scripts/restore.sh /var/backups/ansybl-example/ansybl-example_20250101_020000.tar.gz
```

### S3 Backup (Optional)

Configure S3 backup in backup script:

```bash
export S3_BACKUP_BUCKET=your-bucket-name
export S3_REGION=us-east-1
```

## Scaling

### Vertical Scaling

Increase resources for single instance:

**Systemd:**
Edit `/etc/systemd/system/ansybl-example.service`:
```ini
[Service]
Environment=NODE_OPTIONS="--max-old-space-size=2048"
```

**Docker:**
Edit `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '2'
```

### Horizontal Scaling

**Docker Compose:**
```bash
docker-compose up -d --scale app=5
```

**Kubernetes:**
```bash
# Manual scaling
kubectl scale deployment ansybl-app --replicas=5 -n ansybl

# Auto-scaling is configured via HPA
kubectl get hpa -n ansybl
```

### Load Balancing

Nginx is configured for load balancing in all deployment methods.

For Kubernetes, the Ingress controller handles load balancing automatically.

## Troubleshooting

### Application Won't Start

1. Check logs:
   ```bash
   journalctl -u ansybl-example -n 50
   ```

2. Verify configuration:
   ```bash
   node -e "import('./config/index.js').then(c => console.log('Config valid'))"
   ```

3. Check file permissions:
   ```bash
   ls -la /var/app/ansybl-example
   ```

### High Memory Usage

1. Check metrics:
   ```bash
   curl http://localhost:3000/metrics
   ```

2. Restart service:
   ```bash
   sudo systemctl restart ansybl-example
   ```

3. Increase memory limit if needed

### Slow Response Times

1. Check system resources:
   ```bash
   top
   htop
   ```

2. Review nginx logs:
   ```bash
   tail -f /var/log/nginx/ansybl_access.log
   ```

3. Enable caching in production configuration

### Database Connection Issues

1. Verify database is running
2. Check connection string in `.env`
3. Test connectivity manually

### SSL Certificate Issues

Renew Let's Encrypt certificate:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Configure firewall (ufw/iptables)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Set secure environment variables
- [ ] Configure rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Implement backup strategy
- [ ] Test disaster recovery procedures

## Performance Optimization

1. **Enable Caching**: Set `ENABLE_CACHE=true` in production
2. **Use CDN**: Serve static assets through CDN
3. **Optimize Images**: Images are automatically optimized
4. **Enable Compression**: Gzip is enabled by default
5. **Database Indexing**: Add indexes for frequently queried fields
6. **Connection Pooling**: Configured automatically

## Support

For issues and questions:
- Check logs first
- Review this documentation
- Check GitHub issues
- Contact support team

## Additional Resources

- [Ansybl Protocol Specification](https://ansybl.org)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Docker Documentation](https://docs.docker.com)
- [Kubernetes Documentation](https://kubernetes.io/docs)
