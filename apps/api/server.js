const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "db.sqlite");
const db = new sqlite3.Database(DB_PATH);

// DB setup
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      priceCents INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userEmail TEXT NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // seed user
  db.run(
    `INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)`,
    ["qa@demo.com", "Password123"]
  );

  // seed products
  const products = [
    { id: 1, name: "Carbon Report", priceCents: 1999 },
    { id: 2, name: "Sustainability Dashboard", priceCents: 4999 },
    { id: 3, name: "Compliance Export", priceCents: 2999 },
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO products (id, name, priceCents) VALUES (?, ?, ?)`
  );
  products.forEach((p) => stmt.run(p.id, p.name, p.priceCents));
  stmt.finalize();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Invalid payload" });

  db.get(
    `SELECT email FROM users WHERE email = ? AND password = ?`,
    [email, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(401).json({ error: "Invalid credentials" });

      const token = Buffer.from(`${email}:${Date.now()}`).toString("base64");
      res.json({ token, email });
    }
  );
});

app.get("/products", (req, res) => {
  db.all(`SELECT id, name, priceCents FROM products ORDER BY id ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ items: rows });
  });
});

app.post("/orders", (req, res) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
  const userEmail = decoded.split(":")[0];

  const { productId, quantity } = req.body || {};
  if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  db.get(`SELECT id FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO orders (userEmail, productId, quantity, createdAt) VALUES (?, ?, ?, ?)`,
      [userEmail, productId, quantity, createdAt],
      function (err2) {
        if (err2) return res.status(500).json({ error: "DB error" });
        res.status(201).json({ id: this.lastID, userEmail, productId, quantity, createdAt });
      }
    );
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
