#!/bin/bash

# Backup Script for Ansybl Example Website
# Creates backups of application data and uploads

set -e

echo "🔄 Starting backup process..."

# Configuration
APP_NAME="ansybl-example"
BACKUP_DIR="/var/backups/${APP_NAME}"
APP_DIR="/var/app/${APP_NAME}"
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_NAME="${APP_NAME}_${TIMESTAMP}"
RETENTION_DAYS=30

# S3 Configuration (optional)
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_REGION="${S3_REGION:-us-east-1}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create temporary backup directory
TEMP_BACKUP_DIR="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "$TEMP_BACKUP_DIR"

echo "📦 Creating backup: $BACKUP_NAME"

# Backup application data
if [ -d "${APP_DIR}/data" ]; then
    echo "Backing up application data..."
    cp -r "${APP_DIR}/data" "${TEMP_BACKUP_DIR}/"
fi

# Backup uploads
if [ -d "${APP_DIR}/public/uploads" ]; then
    echo "Backing up uploads..."
    cp -r "${APP_DIR}/public/uploads" "${TEMP_BACKUP_DIR}/"
fi

# Backup configuration (excluding secrets)
if [ -f "${APP_DIR}/.env" ]; then
    echo "Backing up configuration..."
    cp "${APP_DIR}/.env" "${TEMP_BACKUP_DIR}/.env.backup"
fi

# Backup logs (last 7 days)
if [ -d "/var/log/${APP_NAME}" ]; then
    echo "Backing up recent logs..."
    mkdir -p "${TEMP_BACKUP_DIR}/logs"
    find "/var/log/${APP_NAME}" -name "*.log" -mtime -7 -exec cp {} "${TEMP_BACKUP_DIR}/logs/" \;
fi

# Create metadata file
cat > "${TEMP_BACKUP_DIR}/backup_metadata.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "hostname": "$(hostname)",
  "app_version": "1.0.0",
  "node_version": "$(node --version)",
  "backup_type": "full"
}
EOF

# Compress backup
echo "Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✅ Backup created: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
    if command -v aws &> /dev/null; then
        echo "☁️  Uploading to S3..."
        aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
            "s3://${S3_BUCKET}/backups/${BACKUP_NAME}.tar.gz" \
            --region "$S3_REGION" \
            --storage-class STANDARD_IA
        echo "✅ Uploaded to S3: s3://${S3_BUCKET}/backups/${BACKUP_NAME}.tar.gz"
    else
        echo "⚠️  AWS CLI not installed, skipping S3 upload"
    fi
fi

# Clean up old backups
echo "🧹 Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "${APP_NAME}_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

# List remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "${APP_NAME}_*.tar.gz" | wc -l)
echo "📊 Total backups: $BACKUP_COUNT"

echo "✅ Backup completed successfully!"

exit 0
