const { Command } = require('commander');
const fs = require('fs');
const program = new Command();

program
  .requiredOption('-i, --input <path>', 'шлях до файлу для читання')
  .option('-o, --output <path>', 'шлях до файлу для запису результату')
  .option('-d, --display', 'вивести результат у консоль');

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

const resultText = JSON.stringify(data, null, 4);

if (options.display) {
  console.log(resultText);
}

if (options.output) {
  fs.writeFileSync(options.output, resultText, {
    encoding: 'utf8',
    flag: 'w'
  });
}
