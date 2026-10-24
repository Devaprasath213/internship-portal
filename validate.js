// Server-side validation. public/main.js mirrors these rules for instant feedback,
// but the server is always the source of truth.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateApplication(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];

  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const portfolioUrl = String(b.portfolioUrl ?? '').trim();
  const message = String(b.message ?? '').trim();
  const internshipId = String(b.internshipId ?? '').trim();

  if (!name) errors.push({ field: 'name', message: 'Name is required.' });
  else if (name.length > 100) errors.push({ field: 'name', message: 'Name must be 100 characters or fewer.' });

  if (!email || email.length > 254 || !EMAIL_RE.test(email))
    errors.push({ field: 'email', message: 'Enter a valid email address.' });

  if (!/^INT-\d{1,6}$/.test(internshipId))
    errors.push({ field: 'internshipId', message: 'Invalid internship ID.' });

  if (portfolioUrl) {
    let ok = false;
    try {
      const u = new URL(portfolioUrl);
      ok = (u.protocol === 'http:' || u.protocol === 'https:') && portfolioUrl.length <= 300;
    } catch { ok = false; }
    if (!ok) errors.push({ field: 'portfolioUrl', message: 'Portfolio must be a valid http(s) URL.' });
  }

  if (message.length > 1000)
    errors.push({ field: 'message', message: 'Message must be 1000 characters or fewer.' });

  return { errors, clean: { name, email, portfolioUrl, message, internshipId } };
}

module.exports = { validateApplication };
