const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

/**
 * Replace environment variable placeholders in config values
 * @param {string} value - The value that may contain ${VAR_NAME} placeholders
 * @returns {string} - The value with environment variables substituted
 */
function substituteEnvVars(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not defined`);
    }
    return envValue;
  });
}

/**
 * Load and process configuration
 * @param {string} configPath - Path to the config.json file
 * @returns {object} - Processed configuration object
 */
function loadConfig(configPath) {
  try {
    // Read the config.json file
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    // Process each environment
    Object.keys(config).forEach((env) => {
      Object.keys(config[env]).forEach((key) => {
        config[env][key] = substituteEnvVars(config[env][key]);
      });
    });

    return config;
  } catch (error) {
    console.error('Error loading configuration:', error.message);
    process.exit(1);
  }
}

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = loadConfig(configPath);

module.exports = config;
