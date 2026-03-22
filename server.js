const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(express.json());
app.use(cors());

// ── DATABASE CONNECTION ──────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        email      VARCHAR(150) NOT NULL,
        subject    VARCHAR(200) NOT NULL,
        message    TEXT        NOT NULL,
        created_at TIMESTAMP   DEFAULT NOW()
      );
    `);
    console.log('Database table ready');
  } catch (err) {
    console.error('Database init error:', err.message);
  }
}

// ── ROUTES ──────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Amal Joseph Portfolio API is running!',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [name.trim(), email.trim(), subject.trim(), message.trim()]
    );

    console.log('New message from ' + name + ' - ID: ' + result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Message received! I will reply within 24 hours.',
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('DB insert error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

app.get('/api/messages', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY || 'changethis';
  if (req.query.key !== adminKey) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM contacts ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch messages' });
  }
});

// ── START SERVER ─────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
  });
});
