const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-h, --host <address>')
  .requiredOption('-p, --port <number>')
  .requiredOption('-c, --cache <path>');

program.parse();
const options = program.opts();

const server = http.createServer(async (req, res) => {
    const statusCode = req.url.slice(1);
    if (!statusCode || isNaN(statusCode)) {
        res.writeHead(400);
        return res.end('Invalid status code\n');
    }

    const filePath = path.join(options.cache, `${statusCode}.jpg`);

    try {
        if (req.method === 'GET') {
            try {
                const data = await fs.readFile(filePath);
                res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                return res.end(data);
            } catch (err) {
                try {
                    const catRes = await superagent
                        .get(`https://http.cat/${statusCode}`)
                        .buffer(true)
                        .parse(superagent.parse.image);

                    const imageBuffer = catRes.body;
                    
                    await fs.writeFile(filePath, imageBuffer);

                    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                    return res.end(imageBuffer);
                } catch (catErr) {
                    res.writeHead(404);
                    return res.end('Not Found\n');
                }
            }
        } 
        else if (req.method === 'PUT') {
            let body = [];
            req.on('data', chunk => body.push(chunk));
            req.on('end', async () => {
                await fs.writeFile(filePath, Buffer.concat(body));
                res.writeHead(201);
                return res.end('Created\n');
            });
        } 
        else if (req.method === 'DELETE') {
            try {
                await fs.unlink(filePath);
                res.writeHead(200);
                return res.end('Deleted\n');
            } catch {
                res.writeHead(404);
                return res.end('Not Found\n');
            }
        } 
        else {
            res.writeHead(405);
            return res.end('Method Not Allowed\n');
        }
    } catch (globalError) {
        res.writeHead(500);
        return res.end('Internal Server Error\n');
    }
});

server.listen(options.port, options.host);