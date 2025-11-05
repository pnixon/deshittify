/**
 * Analytics Dashboard for Ansybl Protocol
 * Provides web-based dashboard for monitoring and analytics
 */

import express from 'express';
import { AnsyblMonitor, AnsyblAnalytics } from './monitoring.js';

/**
 * Web dashboard for Ansybl monitoring and analytics
 */
export class AnsyblDashboard {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3005,
      host: options.host || 'localhost',
      auth: options.auth || null, // { username: 'admin', password: 'secret' }
      updateInterval: options.updateInterval || 30000, // 30 seconds
      ...options
    };
    
    this.app = express();
    this.monitor = options.monitor || new AnsyblMonitor();
    this.analytics = options.analytics || new AnsyblAnalytics();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    // Basic auth if configured
    if (this.options.auth) {
      this.app.use((req, res, next) => {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Basic ')) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Ansybl Dashboard"');
          return res.status(401).send('Authentication required');
        }
        
        const credentials = Buffer.from(auth.slice(6), 'base64').toString();
        const [username, password] = credentials.split(':');
        
        if (username !== this.options.auth.username || password !== this.options.auth.password) {
          return res.status(401).send('Invalid credentials');
        }
        
        next();
      });
    }
    
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    // Main dashboard page
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // Health status endpoint
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.monitor.getHealthStatus();
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Metrics endpoint
    this.app.get('/api/metrics', (req, res) => {
      const format = req.query.format || 'json';
      
      if (format === 'prometheus') {
        res.setHeader('Content-Type', 'text/plain');
        res.send(this.monitor.exportData('prometheus'));
      } else {
        res.json(this.monitor.getMetrics());
      }
    });

    // Analytics endpoint
    this.app.get('/api/analytics', (req, res) => {
      const startTime = req.query.start ? parseInt(req.query.start) : Date.now() - (24 * 60 * 60 * 1000);
      const endTime = req.query.end ? parseInt(req.query.end) : Date.now();
      
      const summary = this.analytics.getAnalyticsSummary(startTime, endTime);
      res.json(summary);
    });

    // Recent logs endpoint
    this.app.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      const level = req.query.level || null;
      
      const logs = this.monitor.getRecentLogs(limit, level);
      res.json(logs);
    });

    // Export data endpoint
    this.app.get('/api/export', (req, res) => {
      const format = req.query.format || 'json';
      const type = req.query.type || 'metrics';
      
      let data;
      let contentType;
      let filename;
      
      if (type === 'analytics') {
        data = this.analytics.exportAnalytics(format);
        contentType = format === 'csv' ? 'text/csv' : 'application/json';
        filename = `ansybl-analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      } else {
        data = this.monitor.exportData(format);
        contentType = format === 'prometheus' ? 'text/plain' : 'application/json';
        filename = `ansybl-metrics-${new Date().toISOString().split('T')[0]}.${format}`;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
    });

    // Real-time feed status
    this.app.get('/api/feeds/status', async (req, res) => {
      // This would integrate with feed registry if available
      res.json({
        total_feeds: 0,
        active_feeds: 0,
        last_updated: new Date().toISOString()
      });
    });
  }

  setupWebSocket() {
    // WebSocket support for real-time updates would go here
    // For now, we'll use Server-Sent Events for simplicity
    
    this.app.get('/api/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const sendUpdate = () => {
        const data = {
          timestamp: new Date().toISOString(),
          metrics: this.monitor.getMetrics(),
          health: this.monitor.healthChecks.size > 0 ? 'checking' : 'unknown'
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send initial data
      sendUpdate();

      // Send updates periodically
      const interval = setInterval(sendUpdate, this.options.updateInterval);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(interval);
      });
    });
  }

  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ansybl Protocol Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .card h2 {
            font-size: 1.2rem;
            margin-bottom: 1rem;
            color: #2c3e50;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-value {
            font-weight: 600;
            color: #27ae60;
        }
        
        .status {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status.healthy {
            background: #d4edda;
            color: #155724;
        }
        
        .status.unhealthy {
            background: #f8d7da;
            color: #721c24;
        }
        
        .status.unknown {
            background: #fff3cd;
            color: #856404;
        }
        
        .logs {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 1rem;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.8rem;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .log-entry {
            margin-bottom: 0.5rem;
            padding: 0.25rem;
            border-radius: 2px;
        }
        
        .log-entry.error {
            background: rgba(231, 76, 60, 0.2);
        }
        
        .log-entry.warn {
            background: rgba(241, 196, 15, 0.2);
        }
        
        .log-entry.info {
            background: rgba(52, 152, 219, 0.2);
        }
        
        .controls {
            margin-bottom: 2rem;
        }
        
        .btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 0.5rem;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn:hover {
            background: #2980b9;
        }
        
        .btn.secondary {
            background: #95a5a6;
        }
        
        .btn.secondary:hover {
            background: #7f8c8d;
        }
        
        .loading {
            text-align: center;
            padding: 2rem;
            color: #7f8c8d;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Ansybl Protocol Dashboard</h1>
    </div>
    
    <div class="container">
        <div class="controls">
            <button class="btn" onclick="refreshData()">Refresh</button>
            <a href="/api/export?format=json&type=metrics" class="btn secondary">Export Metrics</a>
            <a href="/api/export?format=csv&type=analytics" class="btn secondary">Export Analytics</a>
            <a href="/api/metrics?format=prometheus" class="btn secondary">Prometheus</a>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>System Health</h2>
                <div id="health-status" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h2>Performance Metrics</h2>
                <div id="metrics" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h2>Analytics Summary</h2>
                <div id="analytics" class="loading">Loading...</div>
            </div>
        </div>
        
        <div class="card">
            <h2>Recent Logs</h2>
            <div id="logs" class="logs loading">Loading...</div>
        </div>
    </div>

    <script>
        let eventSource;
        
        async function fetchData(endpoint) {
            try {
                const response = await fetch(endpoint);
                return await response.json();
            } catch (error) {
                console.error('Fetch error:', error);
                return null;
            }
        }
        
        function formatValue(value) {
            if (typeof value === 'number') {
                if (value > 1000000) {
                    return (value / 1000000).toFixed(1) + 'M';
                } else if (value > 1000) {
                    return (value / 1000).toFixed(1) + 'K';
                } else if (value < 1 && value > 0) {
                    return value.toFixed(3);
                } else {
                    return value.toFixed(1);
                }
            }
            return value;
        }
        
        function updateHealthStatus(health) {
            const container = document.getElementById('health-status');
            if (!health) {
                container.innerHTML = '<div class="status unknown">Unknown</div>';
                return;
            }
            
            let html = '<div class="metric">';
            html += '<span>Overall Status</span>';
            html += '<span class="status ' + health.status + '">' + health.status + '</span>';
            html += '</div>';
            
            html += '<div class="metric">';
            html += '<span>Uptime</span>';
            html += '<span class="metric-value">' + Math.floor(health.uptime / 1000 / 60) + ' minutes</span>';
            html += '</div>';
            
            if (health.system) {
                html += '<div class="metric">';
                html += '<span>Memory Usage</span>';
                html += '<span class="metric-value">' + Math.round(health.system.memory.heapUsed / 1024 / 1024) + ' MB</span>';
                html += '</div>';
            }
            
            if (health.checks) {
                Object.entries(health.checks).forEach(([name, check]) => {
                    html += '<div class="metric">';
                    html += '<span>' + name.replace(/_/g, ' ') + '</span>';
                    html += '<span class="status ' + check.status + '">' + check.status + '</span>';
                    html += '</div>';
                });
            }
            
            container.innerHTML = html;
        }
        
        function updateMetrics(metrics) {
            const container = document.getElementById('metrics');
            if (!metrics) {
                container.innerHTML = '<div class="loading">No metrics available</div>';
                return;
            }
            
            let html = '';
            Object.entries(metrics).forEach(([name, metric]) => {
                html += '<div class="metric">';
                html += '<span>' + name.replace(/_/g, ' ') + '</span>';
                html += '<span class="metric-value">' + formatValue(metric.current) + '</span>';
                html += '</div>';
            });
            
            container.innerHTML = html || '<div class="loading">No metrics available</div>';
        }
        
        function updateAnalytics(analytics) {
            const container = document.getElementById('analytics');
            if (!analytics) {
                container.innerHTML = '<div class="loading">No analytics available</div>';
                return;
            }
            
            let html = '';
            html += '<div class="metric">';
            html += '<span>Total Events</span>';
            html += '<span class="metric-value">' + formatValue(analytics.total_events) + '</span>';
            html += '</div>';
            
            if (analytics.feed_access) {
                html += '<div class="metric">';
                html += '<span>Feed Accesses</span>';
                html += '<span class="metric-value">' + formatValue(analytics.feed_access.total) + '</span>';
                html += '</div>';
                
                html += '<div class="metric">';
                html += '<span>Unique Feeds</span>';
                html += '<span class="metric-value">' + formatValue(analytics.feed_access.unique_feeds) + '</span>';
                html += '</div>';
            }
            
            if (analytics.performance && analytics.performance.parsing) {
                html += '<div class="metric">';
                html += '<span>Parse Success Rate</span>';
                html += '<span class="metric-value">' + analytics.performance.parsing.success_rate.toFixed(1) + '%</span>';
                html += '</div>';
            }
            
            container.innerHTML = html;
        }
        
        function updateLogs(logs) {
            const container = document.getElementById('logs');
            if (!logs || logs.length === 0) {
                container.innerHTML = '<div class="loading">No logs available</div>';
                return;
            }
            
            let html = '';
            logs.slice(-20).forEach(log => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                html += '<div class="log-entry ' + log.level.toLowerCase() + '">';
                html += '[' + time + '] ' + log.level + ': ' + log.message;
                if (log.data && Object.keys(log.data).length > 0) {
                    html += ' ' + JSON.stringify(log.data);
                }
                html += '</div>';
            });
            
            container.innerHTML = html;
            container.scrollTop = container.scrollHeight;
        }
        
        async function refreshData() {
            const [health, metrics, analytics, logs] = await Promise.all([
                fetchData('/api/health'),
                fetchData('/api/metrics'),
                fetchData('/api/analytics'),
                fetchData('/api/logs?limit=50')
            ]);
            
            updateHealthStatus(health);
            updateMetrics(metrics);
            updateAnalytics(analytics);
            updateLogs(logs);
        }
        
        function startRealTimeUpdates() {
            if (eventSource) {
                eventSource.close();
            }
            
            eventSource = new EventSource('/api/stream');
            
            eventSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                updateMetrics(data.metrics);
                
                // Update health status indicator
                const healthElement = document.querySelector('#health-status .status');
                if (healthElement && data.health) {
                    healthElement.className = 'status ' + data.health;
                    healthElement.textContent = data.health;
                }
            };
            
            eventSource.onerror = function(event) {
                console.error('EventSource failed:', event);
                setTimeout(startRealTimeUpdates, 5000); // Retry after 5 seconds
            };
        }
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            refreshData();
            startRealTimeUpdates();
            
            // Refresh analytics every 5 minutes
            setInterval(() => {
                fetchData('/api/analytics').then(updateAnalytics);
                fetchData('/api/logs?limit=50').then(updateLogs);
            }, 5 * 60 * 1000);
        });
        
        // Clean up on page unload
        window.addEventListener('beforeunload', function() {
            if (eventSource) {
                eventSource.close();
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Start the dashboard server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, this.options.host, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Ansybl Dashboard running on http://${this.options.host}:${this.options.port}`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the dashboard server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

/**
 * Prometheus metrics exporter
 */
export class PrometheusExporter {
  constructor(monitor, options = {}) {
    this.monitor = monitor;
    this.options = {
      port: options.port || 9090,
      host: options.host || 'localhost',
      path: options.path || '/metrics',
      ...options
    };
    
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.get(this.options.path, (req, res) => {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(this.monitor.exportData('prometheus'));
    });

    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, this.options.host, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Prometheus metrics available at http://${this.options.host}:${this.options.port}${this.options.path}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

export default AnsyblDashboard;