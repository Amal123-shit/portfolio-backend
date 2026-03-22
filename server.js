// ============================================================
// AMAL JOSEPH — Portfolio Backend
// Node.js + Express + PostgreSQL
// ============================================================

const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  // Allow requests only from your GitHub Pages site
  // Replace with your actual GitHub Pages URL
  origin: '*',
    'http://localhost:3000',
    'http://127.0.0.1:5500'    // VS Code Live Server
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// ── DATABASE CONNECTION ──────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }   // Required for Render.com
    : false
});

// Create the contacts table if it doesn't exist
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
    console.log('✅ Database table ready');
  } catch (err) {
    console.error('❌ Database init error:', err.message);
  }
}

// ── ROUTES ──────────────────────────────────────────────────

// GET / — Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Amal Joseph Portfolio API is running!',
    timestamp: new Date().toISOString()
  });
});

// POST /api/contact — Save a contact message
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Validate inputs
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  // Sanitize lengths
  if (name.length > 100 || email.length > 150 || subject.length > 200 || message.length > 5000) {
    return res.status(400).json({ error: 'Input too long.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [name.trim(), email.trim(), subject.trim(), message.trim()]
    );

    console.log(`📨 New message from ${name} (${email}) — ID: ${result.rows[0].id}`);

    res.status(201).json({
      success: true,
      message: 'Message received! I will reply within 24 hours.',
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('❌ DB insert error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// GET /api/messages — View all messages (optional admin route)
app.get('/api/messages', async (req, res) => {
  // Simple protection: require an admin key in query string
  // Example: /api/messages?key=your-secret-key
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
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API ready at http://localhost:${PORT}`);
  });
});
