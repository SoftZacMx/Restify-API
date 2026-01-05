// Mock for @middy/http-json-body-parser
module.exports = () => ({
  before: async (handler) => {
    // Mock implementation - no-op for tests
    return;
  },
});

