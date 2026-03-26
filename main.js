const { Command } = require('commander');
const http = require('http');
const fs = require('fs');
const { XMLBuilder } = require('fast-xml-parser');
const program = new Command();

program
  .requiredOption('-i, --input <path>')
  .requiredOption('-h, --host <address>')
  .requiredOption('-p, --port <number>')
  .option('--humidity')
  .option('-r, --rainfall <number>');

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.input)) {
    console.error("Cannot find input file");
    process.exit(1);
}

const server = http.createServer((req, res) => {
    fs.readFile(options.input, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500);
            return res.end();
        }

        try {
            const weatherData = JSON.parse(data);
            const baseURL = `http://${req.headers.host}`;
            const parsedUrl = new URL(req.url, baseURL);
            const query = parsedUrl.searchParams;

            const showHumidity = query.get('humidity') === 'true' || options.humidity;
            
            const minRainFromUrl = query.get('min_rainfall');
            const minRain = minRainFromUrl !== null 
                ? parseFloat(minRainFromUrl) 
                : (options.rainfall ? parseFloat(options.rainfall) : -1);

            const filteredResults = weatherData
                .filter(item => item.Rainfall > minRain)
                .map(item => {
                    const record = {
                        rainfall: item.Rainfall,
                        pressure3pm: item.Pressure3pm
                    };
                    if (showHumidity) {
                        record.humidity = item.Humidity3pm;
                    }
                    return record;
                });

            const builder = new XMLBuilder({ format: true });
            const xmlOutput = builder.build({
                weather_data: { record: filteredResults }
            });
            
            fs.writeFile('result.txt', xmlOutput, (writeErr) => {
                if (writeErr) {
                    console.error(writeErr);
                }
            });
               
            res.writeHead(200);
            res.end(xmlOutput);

        } catch (e) {
            res.writeHead(500);
            res.end();
        }
    });
});

server.listen(options.port, options.host, () => {
    console.log(`Server: http://${options.host}:${options.port}`);
});
