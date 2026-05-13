require('dotenv').config();
const { Pool } = require('pg');
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

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // щоб читати JSON у запитах

const upload = multer({ dest: path.join(options.cache, 'uploads') });

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

  const result = await pool.query(
    'INSERT INTO inventory (inventory_name, description, photo) VALUES ($1, $2, $3) RETURNING *',
    [inventory_name, description, photoPath]
  );
  res.status(201).json(result.rows[0]);
});

app.all('/register', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// GET /invertory
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.all('/inventory', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// GET /inventory/<ID>
app.get('/inventory/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id=$1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// PUT /inventory/:id
app.put('/inventory/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { inventory_name, description } = req.body;

  try {
    const result = await pool.query(
      'UPDATE inventory SET inventory_name=$1, description=$2 WHERE id=$3 RETURNING *',
      [inventory_name, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// GET /inventory/:id/photo
app.get('/inventory/:id/photo', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('SELECT photo FROM inventory WHERE id=$1', [id]);
    if (result.rows.length === 0 || !result.rows[0].photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const filePath = path.resolve(options.cache, 'uploads', path.basename(result.rows[0].photo));
    const jpegBuffer = await sharp(filePath).jpeg().toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(jpegBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Photo retrieval failed' });
  }
});

// PUT /inventory/<ID>/photo
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!req.file) {
    return res.status(400).json({ error: 'Photo file is required' });
  }

  try {
    // створюємо нове фото
    const jpegPath = path.join(options.cache, 'uploads', req.file.filename + '.jpg');
    await sharp(req.file.path).jpeg().toFile(jpegPath);
    const photoPath = '/uploads/' + path.basename(jpegPath);

    // оновлюємо запис у базі
    const result = await pool.query(
      'UPDATE inventory SET photo=$1 WHERE id=$2 RETURNING *',
      [photoPath, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Photo update failed' });
  }
});

app.all('/inventory/:id/photo', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// DELETE /inventory/<ID>
app.delete('/inventory/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM inventory WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully', item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database delete failed' });
  }
});

app.all('/inventory/:id', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }));

// POST /search
app.post('/search', express.urlencoded({ extended: true }), async (req, res) => {
  const id = parseInt(req.body.id, 10);
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id=$1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let item = result.rows[0];

    if (req.body.has_photo && item.photo) {
      item.description = item.description + ` (Фото: ${item.photo})`;
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
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