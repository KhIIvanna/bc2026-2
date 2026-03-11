const { Command } = require('commander');
const fs = require('fs');
const program = new Command();

program
  .requiredOption('-i, --input <path>', 'шлях до файлу для читання')
  .option('-o, --output <path>', 'шлях до файлу для запису результату')
  .option('-d, --display', 'вивести результат у консоль') // ПРИБРАЛИ КРАПКУ З КОМОЮ ТУТ
  .option('-h, --humidity', 'чи виводити вологість')
  .option('-r, --rainfall <number>', 'фільтрувати опади, більше ніж зазначене число');

program.exitOverride();
try {
  program.parse(process.argv);
} catch (err) {
  if (err.code === 'commander.missingMandatoryOptionValue') {
    console.error("Please, specify input file");
    process.exit(1);
  }
}

const options = program.opts();

if (!fs.existsSync(options.input)) {
  console.error("Cannot find input file");
  process.exit(1);
}

const rawData = fs.readFileSync(options.input, 'utf8');
const data = JSON.parse(rawData);

let filteredData = data;

if (options.rainfall) {
    const limit = parseFloat(options.rainfall);
    filteredData = data.filter(item => item.Rainfall > limit);
}

const resultLines = filteredData.map(item => {
    let line = `Rainfall: ${item.Rainfall}, Pressure3pm: ${item.Pressure3pm}`;
    if (options.humidity) {
        line += `, Humidity3pm: ${item.Humidity3pm}`;
    }
    return line;
});

const finalOutput = resultLines.join('\n');

if (options.display) {
  console.log(finalOutput);
}

if (options.output) {
  fs.writeFileSync(options.output, finalOutput, {
    encoding: 'utf8',
    flag: 'w'
  });
}
