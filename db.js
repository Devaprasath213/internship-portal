const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS internships (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  mode TEXT NOT NULL,
  location TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '[]',
  openings INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  internship_id TEXT NOT NULL REFERENCES internships(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  portfolio_url TEXT,
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (internship_id, email)
);
`;

function openDb(file = process.env.DB_FILE || path.join(__dirname, 'data', 'internships.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

function seed(db, seedFile = path.join(__dirname, 'data', 'internships-seed.json')) {
  const { internships } = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  const stmt = db.prepare(`INSERT OR IGNORE INTO internships
    (id, title, domain, mode, location, skills, openings)
    VALUES (@id, @title, @domain, @mode, @location, @skills, @openings)`);
  db.transaction(() => {
    for (const r of internships) stmt.run({ ...r, skills: JSON.stringify(r.skills) });
  })();
  return internships.length;
}

if (require.main === module && process.argv.includes('--seed')) {
  const db = openDb();
  console.log(`Seeded ${seed(db)} internships (existing IDs preserved).`);
}

module.exports = { openDb, seed, SCHEMA };
