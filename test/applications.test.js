const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { openDb, seed } = require('../db');
const { createApp } = require('../app');

let app, db;
const valid = { internshipId: 'INT-101', name: 'Asha K', email: 'asha@example.com', portfolioUrl: 'https://example.com', message: 'Hello' };

beforeEach(() => {
  db = openDb(':memory:');
  seed(db);
  app = createApp(db, { quiet: true, applyLimit: 1000, apiLimit: 1000 });
});

test('GET /api/internships returns envelope with seeded IDs', async () => {
  const r = await request(app).get('/api/internships');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'success');
  assert.deepEqual(r.body.data.map((d) => d.id), ['INT-101', 'INT-102', 'INT-103', 'INT-104', 'INT-105']);
  assert.equal(r.body.pagination.total, 5);
});

test('filters by domain and mode', async () => {
  const r = await request(app).get('/api/internships').query({ domain: 'Full Stack Development', mode: 'Hybrid' });
  assert.deepEqual(r.body.data.map((d) => d.id), ['INT-102']);
});

test('SQL injection string in search is treated as plain text', async () => {
  const r = await request(app).get('/api/internships').query({ q: "'; DROP TABLE internships;--" });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 0);
  assert.equal((await request(app).get('/api/internships')).body.pagination.total, 5);
});

test('accepts a valid application', async () => {
  const r = await request(app).post('/api/applications').send(valid);
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'success');
});

test('accepts application without optional fields', async () => {
  const r = await request(app).post('/api/applications').send({ internshipId: 'INT-102', name: 'Ravi', email: 'ravi@example.com' });
  assert.equal(r.status, 201);
});

test('rejects missing name', async () => {
  const r = await request(app).post('/api/applications').send({ ...valid, name: '   ' });
  assert.equal(r.status, 400);
  assert.equal(r.body.errors[0].field, 'name');
});

test('rejects invalid email', async () => {
  const r = await request(app).post('/api/applications').send({ ...valid, email: 'not-an-email' });
  assert.equal(r.status, 400);
  assert.equal(r.body.errors[0].field, 'email');
});

test('rejects unsafe URL schemes', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'ftp://x.com', 'not a url']) {
    const r = await request(app).post('/api/applications').send({ ...valid, portfolioUrl: url });
    assert.equal(r.status, 400, url);
    assert.equal(r.body.errors[0].field, 'portfolioUrl');
  }
});

test('rejects unknown internship with 404', async () => {
  const r = await request(app).post('/api/applications').send({ ...valid, internshipId: 'INT-999' });
  assert.equal(r.status, 404);
});

test('rejects duplicate application with 409', async () => {
  await request(app).post('/api/applications').send(valid);
  const r = await request(app).post('/api/applications').send({ ...valid, email: 'ASHA@example.com' });
  assert.equal(r.status, 409);
});

test('rejects malformed JSON and oversized bodies', async () => {
  const bad = await request(app).post('/api/applications').set('Content-Type', 'application/json').send('{bad');
  assert.equal(bad.status, 400);
  const big = await request(app).post('/api/applications').send({ ...valid, message: 'x'.repeat(20000) });
  assert.equal(big.status, 413);
});

test('sends secure headers', async () => {
  const r = await request(app).get('/api/internships');
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-powered-by'], undefined);
});

test('rate limit returns 429 after the limit is exceeded', async () => {
  const ldb = openDb(':memory:'); seed(ldb);
  const a = createApp(ldb, { quiet: true, applyLimit: 2 });
  const codes = [];
  for (let i = 0; i < 3; i++)
    codes.push((await request(a).post('/api/applications').send({ ...valid, email: `u${i}@example.com` })).status);
  assert.deepEqual(codes, [201, 201, 429]);
});
