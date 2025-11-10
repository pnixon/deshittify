#!/bin/bash

# Ansybl Example Website Deployment Script
# This script handles deployment to production environments

set -e  # Exit on error

echo "🚀 Starting Ansybl deployment..."

# Configuration
DEPLOY_ENV=${1:-production}
APP_NAME="ansybl-example"
DEPLOY_DIR="/var/app/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"
LOG_FILE="/var/log/${APP_NAME}/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $1" >> "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then 
    error "Do not run this script as root"
fi

# Validate environment
if [ "$DEPLOY_ENV" != "production" ] && [ "$DEPLOY_ENV" != "staging" ]; then
    error "Invalid environment: $DEPLOY_ENV (must be 'production' or 'staging')"
fi

log "Deploying to environment: $DEPLOY_ENV"

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
fi

NODE_VERSION=$(node --version)
log "Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
fi

# Check if required environment variables are set
if [ -z "$BASE_URL" ]; then
    warn "BASE_URL environment variable is not set"
fi

# Create backup of current deployment
if [ -d "$DEPLOY_DIR" ]; then
    log "Creating backup of current deployment..."
    BACKUP_NAME="${APP_NAME}_$(date +'%Y%m%d_%H%M%S').tar.gz"
    mkdir -p "$BACKUP_DIR"
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}" -C "$DEPLOY_DIR" . || warn "Backup creation failed"
    log "Backup created: ${BACKUP_NAME}"
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +6 | xargs -r rm --
fi

# Create deployment directory if it doesn't exist
mkdir -p "$DEPLOY_DIR"

# Copy application files
log "Copying application files..."
rsync -av --exclude='node_modules' --exclude='.git' --exclude='public/uploads' \
    ./ "$DEPLOY_DIR/" || error "Failed to copy files"

# Navigate to deployment directory
cd "$DEPLOY_DIR"

# Install dependencies
log "Installing dependencies..."
npm ci --production || error "Failed to install dependencies"

# Run build if needed
if [ -f "build.js" ]; then
    log "Running build process..."
    npm run build || error "Build failed"
fi

# Create necessary directories
log "Creating necessary directories..."
mkdir -p public/uploads
mkdir -p logs
mkdir -p temp

# Set proper permissions
log "Setting file permissions..."
chmod -R 755 public
chmod -R 700 config
chmod 600 .env 2>/dev/null || true

# Validate configuration
log "Validating configuration..."
node -e "import('./config/index.js').then(c => console.log('✅ Configuration valid'))" || error "Configuration validation failed"

# Run database migrations (if applicable)
if [ -f "scripts/migrate.js" ]; then
    log "Running database migrations..."
    node scripts/migrate.js || error "Migration failed"
fi

# Health check before restart
log "Performing health check..."
if systemctl is-active --quiet "${APP_NAME}"; then
    HEALTH_URL="${BASE_URL:-http://localhost:3000}/health"
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        log "Current instance is healthy"
    else
        warn "Current instance health check failed"
    fi
fi

# Restart application service
log "Restarting application service..."
if systemctl is-active --quiet "${APP_NAME}"; then
    sudo systemctl restart "${APP_NAME}" || error "Failed to restart service"
else
    sudo systemctl start "${APP_NAME}" || error "Failed to start service"
fi

# Wait for service to start
log "Waiting for service to start..."
sleep 5

# Post-deployment health check
log "Running post-deployment health check..."
MAX_RETRIES=10
RETRY_COUNT=0
HEALTH_URL="${BASE_URL:-http://localhost:3000}/health"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        log "✅ Health check passed"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            error "Health check failed after $MAX_RETRIES attempts"
        fi
        log "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying..."
        sleep 3
    fi
done

# Verify service status
if systemctl is-active --quiet "${APP_NAME}"; then
    log "✅ Service is running"
else
    error "Service is not running"
fi

# Clean up old logs (keep last 30 days)
log "Cleaning up old logs..."
find /var/log/${APP_NAME} -name "*.log" -mtime +30 -delete 2>/dev/null || true

# Deployment summary
log "========================================="
log "✅ Deployment completed successfully!"
log "Environment: $DEPLOY_ENV"
log "Deployed at: $(date)"
log "Application URL: ${BASE_URL:-http://localhost:3000}"
log "========================================="

exit 0
