module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Customize rules as needed
    'no-console': 'off', // Allow console.log in Node.js
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'max-len': ['error', { code: 120, ignoreComments: true }],
    indent: ['error', 2],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    'prefer-const': 'error',
    'no-var': 'error',
    'arrow-spacing': 'error',
    'space-before-blocks': 'error',
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'space-before-function-paren': ['error', 'never'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    camelcase: ['error', { properties: 'never' }],
    'consistent-return': 'off', // Allow inconsistent returns
    'no-underscore-dangle': 'off', // Allow underscore dangle for database fields
    'no-param-reassign': ['error', { props: false }], // Allow parameter property reassignment
  },
  overrides: [
    {
      files: ['migrations/**/*.js', 'seeders/**/*.js'],
      rules: {
        'no-console': 'off',
        'func-names': 'off',
      },
    },
    {
      files: ['src/models/index.js', 'models/index.js'],
      rules: {
        'import/no-dynamic-require': 'off',
        'global-require': 'off',
      },
    },
  ],
};
