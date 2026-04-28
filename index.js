const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії для кешу');

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();
const upload = multer({ dest: path.join(options.cache, 'uploads') });

let inventory = [];
let nextId = 1;

// POST /register
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).json({ error: 'Inventory name is required' });
  }

  const item = {
    id: nextId++,
    inventory_name,
    description,
    photo: req.file ? `/uploads/${req.file.filename}` : null
  };

  inventory.push(item);
  res.status(201).json(item);
});
app.use(express.static(path.join(__dirname)));

app.get('/inventory', (req, res) => {
  res.json(inventory);
});

app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
