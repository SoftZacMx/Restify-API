// Mock for @middy/http-error-handler
module.exports = () => ({
  onError: async (handler) => {
    // Mock implementation - no-op for tests
    return;
  },
});

