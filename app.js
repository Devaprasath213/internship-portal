const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { validateApplication } = require('./validate');

function createApp(db, opts = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());                         // CSP, nosniff, frameguard, HSTS, etc.
  app.use(express.json({ limit: '10kb' }));  // reject oversized bodies

  // General API limit + stricter limit on the write endpoint.
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: opts.apiLimit ?? 100,
    standardHeaders: true, legacyHeaders: false,
    message: { status: 'error', errors: [{ message: 'Too many requests. Please slow down.' }] },
  });
  const applyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: opts.applyLimit ?? 10,
    standardHeaders: true, legacyHeaders: false,
    message: { status: 'error', errors: [{ message: 'Too many applications. Try again later.' }] },
  });
  app.use('/api', apiLimiter);

  const toRecord = (r) => ({ ...r, skills: JSON.parse(r.skills) });

  app.get('/api/internships', (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    const domain = String(req.query.domain ?? '');
    const mode = String(req.query.mode ?? '');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    // All user input goes through bound parameters (never string-concatenated).
    const params = { q: `%${q}%`, domain, mode };
    const where = `WHERE (title LIKE @q OR domain LIKE @q OR skills LIKE @q)
                   AND (@domain = '' OR domain = @domain)
                   AND (@mode = '' OR mode = @mode)`;
    const total = db.prepare(`SELECT COUNT(*) AS n FROM internships ${where}`).get(params).n;
    const rows = db.prepare(`SELECT * FROM internships ${where} ORDER BY id LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset: (page - 1) * limit });

    res.json({
      status: 'success',
      data: rows.map(toRecord),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  });

  app.get('/api/internships/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM internships WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ status: 'error', errors: [{ message: 'Internship not found.' }] });
    res.json({ status: 'success', data: toRecord(row) });
  });

  app.post('/api/applications', applyLimiter, (req, res) => {
    const { errors, clean } = validateApplication(req.body);
    if (errors.length) return res.status(400).json({ status: 'error', errors });

    const job = db.prepare('SELECT id FROM internships WHERE id = ?').get(clean.internshipId);
    if (!job) return res.status(404).json({ status: 'error', errors: [{ field: 'internshipId', message: 'Internship not found.' }] });

    try {
      db.prepare(`INSERT INTO applications (internship_id, name, email, portfolio_url, message)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(clean.internshipId, clean.name, clean.email, clean.portfolioUrl || null, clean.message || null);
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT'))
        return res.status(409).json({ status: 'error', errors: [{ field: 'email', message: 'You have already applied to this internship.' }] });
      throw e;
    }
    if (!opts.quiet) console.log(`application stored for ${clean.internshipId}`); // no personal data in logs
    res.status(201).json({ status: 'success', data: { internshipId: clean.internshipId } });
  });

  app.use('/api', (req, res) => res.status(404).json({ status: 'error', errors: [{ message: 'Not found.' }] }));

  app.use(express.static(path.join(__dirname, 'public')));

  // Malformed JSON and unexpected errors: generic message, no stack traces.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed')
      return res.status(400).json({ status: 'error', errors: [{ message: 'Malformed JSON.' }] });
    if (err.type === 'entity.too.large')
      return res.status(413).json({ status: 'error', errors: [{ message: 'Request too large.' }] });
    if (!opts.quiet) console.error('Unhandled error:', err.message);
    res.status(500).json({ status: 'error', errors: [{ message: 'Server error.' }] });
  });

  return app;
}

module.exports = { createApp };
