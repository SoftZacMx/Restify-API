const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/integration/**/*.test.ts'],
  globalSetup: '<rootDir>/tests/integration/global-setup.ts',
};
