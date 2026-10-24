const { openDb, seed } = require('./db');
const { createApp } = require('./app');

const db = openDb();
seed(db); // idempotent: keeps existing records and IDs
const port = Number(process.env.PORT) || 3000;
createApp(db).listen(port, () => console.log(`Internship portal running at http://localhost:${port}`));
