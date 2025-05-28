const express = require('express');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server to support WebSocket
const server = http.createServer(app);

// Create WebSocket server for live reload
const wss = new WebSocket.Server({ server });

// Track connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('🔌 Client connected for live reload');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('🔌 Client disconnected from live reload');
    });
});

// Function to notify all clients to reload
function notifyReload(filePath) {
    const message = JSON.stringify({ 
        type: 'reload', 
        file: path.relative(__dirname, filePath),
        timestamp: Date.now()
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    console.log(`🔄 Notifying ${clients.size} clients to reload (${path.basename(filePath)} changed)`);
}

// Set up file watcher
const watcher = chokidar.watch(__dirname, {
    ignored: [
        'node_modules/**',
        '.git/**',
        '*.log',
        '.DS_Store',
        'package-lock.json'
    ],
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
    }
});

watcher.on('change', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    // Only reload for web-related files
    if (['.html', '.css', '.js', '.json'].includes(ext)) {
        console.log(`📝 File changed: ${path.relative(__dirname, filePath)}`);
        notifyReload(filePath);
    }
});

watcher.on('error', error => {
    console.error('File watcher error:', error);
});

// Enable CORS for all routes (helpful for development)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// Inject live reload script into HTML files
app.use((req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
        // Only inject script into HTML responses
        if (res.getHeader('Content-Type')?.includes('text/html') && typeof body === 'string') {
            const liveReloadScript = `
<script>
(function() {
    const ws = new WebSocket('ws://localhost:${PORT}');
    
    ws.onopen = function() {
        console.log('🔄 Live reload connected');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'reload') {
            console.log('🔄 Reloading page - file changed:', data.file);
            location.reload();
        }
    };
    
    ws.onclose = function() {
        console.log('🔄 Live reload disconnected');
        // Try to reconnect after a delay
        setTimeout(() => {
            location.reload();
        }, 1000);
    };
    
    ws.onerror = function(error) {
        console.log('🔄 Live reload error:', error);
    };
})();
</script>`;
            
            // Inject before closing body tag, or at the end if no body tag
            if (body.includes('</body>')) {
                body = body.replace('</body>', liveReloadScript + '\n</body>');
            } else {
                body += liveReloadScript;
            }
        }
        
        originalSend.call(this, body);
    };
    
    next();
});

// Serve static files from the current directory
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        // Set proper MIME types
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
        } else if (path.endsWith('.json') || path.endsWith('.ansybl')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Ansybl Feed Reader Server is running',
        timestamp: new Date().toISOString(),
        liveReload: {
            enabled: true,
            connectedClients: clients.size,
            watchedDirectory: __dirname
        }
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ 
        error: 'File not found',
        requested: req.originalUrl,
        message: 'The requested resource was not found on this server.'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong on the server.'
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Ansybl Feed Reader Server is running!`);
    console.log(`📍 Local:            http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔄 Live reload:      ENABLED`);
    console.log(`⚡ Ready to load your feeds!`);
    console.log('');
    console.log('📝 Watching for changes in:');
    console.log('   • HTML files (.html)');
    console.log('   • CSS files (.css)');
    console.log('   • JavaScript files (.js)');
    console.log('   • JSON files (.json)');
    console.log('');
    console.log('To stop the server, press Ctrl+C');
});

// Graceful shutdown
function cleanup() {
    console.log('\n👋 Shutting down server...');
    watcher.close();
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);