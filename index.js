const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії з кешем');

program.parse();
const options = program.opts();

async function prepareCache() {
    try {
        await fs.access(options.cache);
    } catch {
        await fs.mkdir(options.cache, { recursive: true });
    }
}
prepareCache();

const server = http.createServer(async (req, res) => {
    const statusCode = req.url.slice(1);
    const filePath = path.join(options.cache, `${statusCode}.jpg`);

    if (!statusCode || isNaN(statusCode)) {
        res.writeHead(400);
        return res.end('Invalid status code. Use /200, /404, etc.');
    }

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
                    return res.end('Not Found on http.cat');
                }
            }
        }

        else if (req.method === 'PUT') {
            let body = [];
            req.on('data', chunk => body.push(chunk));
            req.on('end', async () => {
                try {
                    const buffer = Buffer.concat(body);
                    await fs.writeFile(filePath, buffer);
                    res.writeHead(201);
                    return res.end('Created');
                } catch (e) {
                    res.writeHead(500);
                    return res.end('Error saving to cache');
                }
            });
        }

        else if (req.method === 'DELETE') {
            try {
                await fs.unlink(filePath);
                res.writeHead(200);
                return res.end('Deleted');
            } catch (err) {
                res.writeHead(404);
                return res.end('Not Found');
            }
        }

        else {
            res.writeHead(405);
            return res.end('Method Not Allowed');
        }

    } catch (globalError) {
        console.error(globalError);
        if (!res.writableEnded) {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

server.listen(options.port, options.host, () => {
    console.log(`Server is running at http://${options.host}:${options.port}`);
    console.log(`Cache directory: ${options.cache}`);
});