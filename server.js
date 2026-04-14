const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API proxy
  if (req.method === 'POST' && req.url === '/proxy') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { apiKey, model, messages, system } = JSON.parse(body);
        
        console.log('Proxy received request:', { model, hasApiKey: !!apiKey, apiKeyPrefix: apiKey ? apiKey.substring(0, 10) : null });
        
        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API key required' }));
          return;
        }

        // All models use /zen/go/v1/chat/completions with OpenAI format
        const targetPath = '/zen/go/v1/chat/completions';
        
        // Build messages array with system message
        const allMessages = [];
        if (system) {
          allMessages.push({ role: 'system', content: system });
        }
        if (messages) {
          allMessages.push(...messages);
        }
        
        const requestBody = JSON.stringify({ model, messages: allMessages });

        const options = {
          hostname: 'opencode.ai',
          port: 443,
          path: targetPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
            'Content-Length': Buffer.byteLength(requestBody)
          }
        };

        console.log('Making request to OpenCode:', { 
          url: 'https://opencode.ai' + targetPath, 
          model,
          authPrefix: apiKey ? apiKey.substring(0, 15) : null
        });

        const proxyReq = https.request(options, (proxyRes) => {
          let data = '';
          proxyRes.on('data', chunk => data += chunk);
          proxyRes.on('end', () => {
            console.log('OpenCode response:', proxyRes.statusCode, data.substring(0, 200));
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        proxyReq.on('error', (err) => {
          console.log('OpenCode request error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.on('timeout', () => {
          console.log('OpenCode request timeout');
          proxyReq.destroy();
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request timeout' }));
        });

        proxyReq.write(requestBody);
        proxyReq.end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html for SPA routing
      fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, html) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        }
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
