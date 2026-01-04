const { nanoid } = require('nanoid');

// Default nanoid configuration
const DEFAULT_LENGTH = 12; // 12 characters for good balance of uniqueness and brevity
const DEFAULT_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generate a nanoid with default settings
 * @returns {string} A unique ID string
 */
const generateId = () => nanoid(DEFAULT_LENGTH);

/**
 * Generate a nanoid with custom length
 * @param {number} length - Length of the generated ID
 * @returns {string} A unique ID string
 */
const generateIdWithLength = (length) => nanoid(length);

/**
 * Generate a nanoid with custom alphabet
 * @param {string} alphabet - Custom alphabet for ID generation
 * @param {number} length - Length of the generated ID
 * @returns {string} A unique ID string
 */
const generateIdWithAlphabet = (alphabet, length = DEFAULT_LENGTH) => nanoid(length, alphabet);

/**
 * Generate a URL-safe nanoid (shorter alphabet, more URL-friendly)
 * @param {number} length - Length of the generated ID
 * @returns {string} A URL-safe unique ID string
 */
const generateUrlSafeId = (length = DEFAULT_LENGTH) => {
  const urlSafeAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  return nanoid(length, urlSafeAlphabet);
};

/**
 * Generate a numeric-only nanoid
 * @param {number} length - Length of the generated ID
 * @returns {string} A numeric unique ID string
 */
const generateNumericId = (length = DEFAULT_LENGTH) => {
  const numericAlphabet = '0123456789';
  return nanoid(length, numericAlphabet);
};

module.exports = {
  generateId,
  generateIdWithLength,
  generateIdWithAlphabet,
  generateUrlSafeId,
  generateNumericId,
  DEFAULT_LENGTH,
  DEFAULT_ALPHABET,
};
