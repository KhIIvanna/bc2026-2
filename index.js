const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // щоб читати JSON у запитах

const upload = multer({ dest: path.join(options.cache, 'uploads') });

let inventory = [];
let nextId = 1;

// POST /register
app.post('/register', upload.single('photo'), async (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) {
    return res.status(400).json({ error: 'Inventory name is required' });
  }

  let photoPath = null;
  if (req.file) {
    const jpegPath = path.join(options.cache, 'uploads', req.file.filename + '.jpg');
    await sharp(req.file.path).jpeg().toFile(jpegPath);
    photoPath = '/uploads/' + path.basename(jpegPath);
  }

  const item = {
    id: nextId++,
    inventory_name,
    description,
    photo: photoPath
  };

  inventory.push(item);
  res.status(201).json(item);
});

app.all('/register', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// GET /invertory
app.get('/inventory', (req, res) => {
  res.json(inventory);
});

app.all('/inventory', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// GET /inventory/<ID>
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json(item);
});

// PUT /inventory/:id
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { inventory_name, description } = req.body;

  if (inventory_name) {
    item.inventory_name = inventory_name;
  }
  if (description) {
    item.description = description;
  }

  res.json(item);
});

// GET /inventory/:id/photo
app.get('/inventory/:id/photo', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item || !item.photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const filePath = path.resolve(options.cache, 'uploads', path.basename(item.photo));

  try {
    const jpegBuffer = await sharp(filePath).jpeg().toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(jpegBuffer);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Photo not found or conversion failed' });
  }
});

// PUT /inventory/<ID>/photo
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Photo file is required' });
  }

  try {
    // видаляється старе фото, якщо було
    if (item.photo) {
      const oldPath = path.resolve(options.cache, 'uploads', path.basename(item.photo));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // створюємо нове фото
    const jpegPath = path.join(options.cache, 'uploads', req.file.filename + '.jpg');
    await sharp(req.file.path).jpeg().toFile(jpegPath);

    item.photo = '/uploads/' + path.basename(jpegPath);

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Photo update failed' });
  }
});

app.all('/inventory/:id/photo', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// DELETE /inventory/<ID>
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const deletedItem = inventory.splice(index, 1)[0];

  res.json({ message: 'Item deleted successfully', item: deletedItem });
});

app.all('/inventory/:id', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// POST /search
app.post('/search', express.urlencoded({ extended: true }), (req, res) => {
  const id = parseInt(req.body.id, 10);
  const item = inventory.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const result = { ...item };

  if (req.body.has_photo && item.photo) {
    result.description += ` (Фото: ${item.photo})`;
  }

  res.json(result);
});

app.all('/search', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

app.use(express.static(path.join(__dirname)));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});