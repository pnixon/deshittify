#!/bin/bash

# Production Environment Setup Script
# Sets up the production environment for Ansybl Example Website

set -e

echo "🔧 Setting up production environment for Ansybl..."

# Configuration
APP_NAME="ansybl-example"
APP_USER="ansybl"
APP_DIR="/var/app/${APP_NAME}"
LOG_DIR="/var/log/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create application user if it doesn't exist
if ! id "$APP_USER" &>/dev/null; then
    echo "Creating application user: $APP_USER"
    useradd -r -s /bin/bash -d "$APP_DIR" -m "$APP_USER"
else
    echo "User $APP_USER already exists"
fi

# Create necessary directories
echo "Creating application directories..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "${APP_DIR}/public/uploads"
mkdir -p "${APP_DIR}/logs"
mkdir -p "${APP_DIR}/temp"

# Set ownership
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$BACKUP_DIR"

# Set permissions
chmod 755 "$APP_DIR"
chmod 755 "$LOG_DIR"
chmod 700 "$BACKUP_DIR"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js is already installed: $(node --version)"
fi

# Install PM2 globally for process management
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
else
    echo "PM2 is already installed: $(pm2 --version)"
fi

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=Ansybl Example Website
Documentation=https://github.com/ansybl/ansybl
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/app.log
StandardError=append:$LOG_DIR/error.log
SyslogIdentifier=$APP_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/public/uploads $APP_DIR/logs $APP_DIR/temp $LOG_DIR

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Create logrotate configuration
echo "Creating logrotate configuration..."
cat > /etc/logrotate.d/${APP_NAME} << EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 $APP_USER $APP_USER
    sharedscripts
    postrotate
        systemctl reload ${APP_NAME} > /dev/null 2>&1 || true
    endscript
}
EOF

# Create nginx configuration (if nginx is installed)
if command -v nginx &> /dev/null; then
    echo "Creating nginx configuration..."
    cat > /etc/nginx/sites-available/${APP_NAME} << 'EOF'
upstream ansybl_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/ansybl_access.log;
    error_log /var/log/nginx/ansybl_error.log;

    # Client body size limit
    client_max_body_size 10M;

    # Static files
    location /uploads/ {
        alias /var/app/ansybl-example/public/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /css/ {
        alias /var/app/ansybl-example/public/css/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /js/ {
        alias /var/app/ansybl-example/public/js/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy to Node.js application
    location / {
        proxy_pass http://ansybl_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://ansybl_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME}
    
    # Test nginx configuration
    nginx -t && systemctl reload nginx
    echo "✅ Nginx configured"
else
    echo "⚠️  Nginx not installed, skipping nginx configuration"
fi

# Create environment file template
if [ ! -f "${APP_DIR}/.env" ]; then
    echo "Creating .env template..."
    cat > "${APP_DIR}/.env" << EOF
NODE_ENV=production
PORT=3000
BASE_URL=https://example.com
SITE_TITLE=Ansybl Example Site
SITE_DESCRIPTION=A demonstration of the Ansybl social syndication protocol
LOG_LEVEL=warn
ENABLE_MONITORING=true
ENABLE_CACHE=true
EOF
    chown "$APP_USER:$APP_USER" "${APP_DIR}/.env"
    chmod 600 "${APP_DIR}/.env"
    echo "⚠️  Please edit ${APP_DIR}/.env with your configuration"
fi

# Setup firewall rules (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 22/tcp
    echo "✅ Firewall configured"
fi

# Enable and start service
echo "Enabling service..."
systemctl enable ${APP_NAME}

echo ""
echo "========================================="
echo "✅ Production environment setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Copy your application files to: $APP_DIR"
echo "2. Edit configuration: $APP_DIR/.env"
echo "3. Install dependencies: cd $APP_DIR && npm ci --production"
echo "4. Start service: systemctl start ${APP_NAME}"
echo "5. Check status: systemctl status ${APP_NAME}"
echo "6. View logs: journalctl -u ${APP_NAME} -f"
echo ""
echo "For SSL/TLS, install certbot:"
echo "  apt-get install certbot python3-certbot-nginx"
echo "  certbot --nginx -d your-domain.com"
echo ""

exit 0
