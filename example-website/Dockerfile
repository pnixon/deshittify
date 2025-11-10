# Multi-stage Dockerfile for Ansybl Example Website
# Optimized for production deployment

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY . .

# Stage 2: Production
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S ansybl && \
    adduser -S -u 1001 -G ansybl ansybl

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=ansybl:ansybl /app/node_modules ./node_modules
COPY --chown=ansybl:ansybl . .

# Create necessary directories
RUN mkdir -p public/uploads logs temp data && \
    chown -R ansybl:ansybl public/uploads logs temp data

# Switch to non-root user
USER ansybl

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
