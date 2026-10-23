function storageErrorResponse(error) {
  const code = Number(error.code || error.statusCode);
  if (code === 404) return { status: 404, message: 'Document not found' };
  if ([401, 403, 429, 500, 502, 503, 504].includes(code) || ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(error.code)) {
    return { status: 503, message: 'Cloud storage is currently unavailable. Please try again later.' };
  }
  return { status: 500, message: 'Could not access cloud storage' };
}

module.exports = { storageErrorResponse };
