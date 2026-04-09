const http = require('http');
const fs = require('fs');
const { program } = require('commander');

program
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії з кешем');

program.parse();
const options = program.opts();

if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
}

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Proxy server is running');
});

server.listen(options.port, options.host, () => {
    console.log(`Server is running at http://${options.host}:${options.port}`);
    console.log(`Cache directory is set to: ${options.cache}`);
});
