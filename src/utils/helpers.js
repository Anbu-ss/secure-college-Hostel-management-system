// src/utils/helpers.js
const normalizeOrigin = (origin) => (origin || '').trim().replace(/\/$/, '');

module.exports = {
  normalizeOrigin,
};

