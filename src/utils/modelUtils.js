/**
 * Utility functions for Sequelize models
 */

/**
 * Removes snake_case duplicate fields from Sequelize model instances
 * This is needed because Sequelize with underscored: true adds both camelCase and snake_case versions
 * @param {Object} values - The values object from model.get()
 * @returns {Object} - Cleaned values object with only camelCase fields
 */
function removeSnakeCaseDuplicates(values) {
  const cleaned = { ...values };

  // Get all camelCase keys
  const camelCaseKeys = Object
    .keys(cleaned)
    .filter((key) => /^[a-z][a-zA-Z0-9]*$/.test(key) && key !== key.toLowerCase());

  // For each camelCase key, find and remove its snake_case equivalent
  camelCaseKeys.forEach((camelKey) => {
    // Convert camelCase to snake_case
    const snakeKey = camelKey.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (cleaned[snakeKey] !== undefined && cleaned[camelKey] !== undefined) {
      // If both exist and have the same value, remove the snake_case version
      if (JSON.stringify(cleaned[snakeKey]) === JSON.stringify(cleaned[camelKey])) {
        delete cleaned[snakeKey];
      }
    }
  });

  // Handle timestamp fields: convert to camelCase if only snake_case exists
  const timestampFields = [
    { snake: 'created_at', camel: 'createdAt' },
    { snake: 'updated_at', camel: 'updatedAt' },
  ];

  timestampFields.forEach(({ snake, camel }) => {
    if (cleaned[snake] !== undefined) {
      if (cleaned[camel] !== undefined) {
        // Both exist, remove snake_case and keep camelCase
        delete cleaned[snake];
      } else {
        // Only snake_case exists, convert to camelCase
        cleaned[camel] = cleaned[snake];
        delete cleaned[snake];
      }
    }
  });

  return cleaned;
}

/**
 * Creates a toJSON hook for Sequelize models that removes snake_case duplicates
 * @param {Object} Model - Sequelize model instance
 * @param {Array<string>} additionalSnakeFields - Additional snake_case fields to remove (optional)
 */
function addCamelCaseToJSONHook(Model, additionalSnakeFields = []) {
  // Timestamp fields should be converted, not removed
  const timestampFields = ['created_at', 'updated_at'];

  Model.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };

    // Remove snake_case duplicates (this will convert timestamps to camelCase)
    const cleaned = removeSnakeCaseDuplicates(values);

    // Remove additional snake_case fields if specified (excluding timestamps)
    additionalSnakeFields.forEach((field) => {
      // Skip timestamp fields as they are already handled by removeSnakeCaseDuplicates
      if (!timestampFields.includes(field) && cleaned[field] !== undefined) {
        delete cleaned[field];
      }
    });

    return cleaned;
  };
}

module.exports = {
  removeSnakeCaseDuplicates,
  addCamelCaseToJSONHook,
};

