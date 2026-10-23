function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) throw new Error('JWT_SECRET must be configured');
  return secret;
}

function tokenCookieOptions(req) {
  const secure = Boolean(req.secure || process.env.NODE_ENV === 'production');
  return { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/' };
}

module.exports = { getJwtSecret, tokenCookieOptions };
