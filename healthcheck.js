const http = require('http');

// Simple health check endpoint
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const port = process.env.HEALTH_CHECK_PORT || 3000;
server.listen(port, () => {
  console.log(`Health check server running on port ${port}`);
});

// For Docker health check
if (process.argv[2] === '--check') {
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };
  
  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
  
  req.on('error', () => {
    process.exit(1);
  });
  
  req.on('timeout', () => {
    req.destroy();
    process.exit(1);
  });
  
  req.end();
}