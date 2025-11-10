#!/bin/bash

# Restore Script for Ansybl Example Website
# Restores application data from backup

set -e

# Configuration
APP_NAME="ansybl-example"
BACKUP_DIR="/var/backups/${APP_NAME}"
APP_DIR="/var/app/${APP_NAME}"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try looking in backup directory
    if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
    else
        echo "❌ Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "🔄 Starting restore process..."
echo "Backup file: $BACKUP_FILE"

# Confirm restore
read -p "⚠️  This will overwrite existing data. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Stop application service
echo "Stopping application service..."
if systemctl is-active --quiet "${APP_NAME}"; then
    sudo systemctl stop "${APP_NAME}"
    echo "✅ Service stopped"
fi

# Create restore directory
RESTORE_DIR="${BACKUP_DIR}/restore_$(date +'%Y%m%d_%H%M%S')"
mkdir -p "$RESTORE_DIR"

# Extract backup
echo "📦 Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# Find extracted directory
EXTRACTED_DIR=$(find "$RESTORE_DIR" -maxdepth 1 -type d -name "${APP_NAME}_*" | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "❌ Failed to find extracted backup directory"
    exit 1
fi

echo "Extracted to: $EXTRACTED_DIR"

# Display backup metadata
if [ -f "${EXTRACTED_DIR}/backup_metadata.json" ]; then
    echo ""
    echo "Backup metadata:"
    cat "${EXTRACTED_DIR}/backup_metadata.json"
    echo ""
fi

# Backup current data before restore
if [ -d "${APP_DIR}/data" ] || [ -d "${APP_DIR}/public/uploads" ]; then
    echo "Creating safety backup of current data..."
    SAFETY_BACKUP="${BACKUP_DIR}/pre_restore_$(date +'%Y%m%d_%H%M%S').tar.gz"
    tar -czf "$SAFETY_BACKUP" \
        -C "$APP_DIR" \
        data public/uploads 2>/dev/null || true
    echo "✅ Safety backup created: $SAFETY_BACKUP"
fi

# Restore data
if [ -d "${EXTRACTED_DIR}/data" ]; then
    echo "Restoring application data..."
    rm -rf "${APP_DIR}/data"
    cp -r "${EXTRACTED_DIR}/data" "${APP_DIR}/"
    echo "✅ Data restored"
fi

# Restore uploads
if [ -d "${EXTRACTED_DIR}/uploads" ]; then
    echo "Restoring uploads..."
    rm -rf "${APP_DIR}/public/uploads"
    mkdir -p "${APP_DIR}/public"
    cp -r "${EXTRACTED_DIR}/uploads" "${APP_DIR}/public/"
    echo "✅ Uploads restored"
fi

# Restore configuration (optional)
if [ -f "${EXTRACTED_DIR}/.env.backup" ]; then
    read -p "Restore configuration file? (yes/no): " RESTORE_CONFIG
    if [ "$RESTORE_CONFIG" = "yes" ]; then
        cp "${EXTRACTED_DIR}/.env.backup" "${APP_DIR}/.env"
        chmod 600 "${APP_DIR}/.env"
        echo "✅ Configuration restored"
    fi
fi

# Set proper ownership
echo "Setting file ownership..."
sudo chown -R ansybl:ansybl "${APP_DIR}/data" 2>/dev/null || true
sudo chown -R ansybl:ansybl "${APP_DIR}/public/uploads" 2>/dev/null || true

# Clean up restore directory
rm -rf "$RESTORE_DIR"

# Start application service
echo "Starting application service..."
sudo systemctl start "${APP_NAME}"

# Wait for service to start
sleep 3

# Check service status
if systemctl is-active --quiet "${APP_NAME}"; then
    echo "✅ Service started successfully"
else
    echo "⚠️  Service may not have started correctly"
    echo "Check status with: systemctl status ${APP_NAME}"
fi

echo ""
echo "========================================="
echo "✅ Restore completed successfully!"
echo "========================================="
echo ""
echo "Safety backup location: $SAFETY_BACKUP"
echo "Service status: systemctl status ${APP_NAME}"
echo ""

exit 0
