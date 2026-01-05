// Mock for @middy/core
module.exports = (handler) => {
  const wrapped = async (event, context) => {
    return handler(event, context);
  };
  
  // Add .use() method for middleware chaining
  wrapped.use = (middleware) => {
    return wrapped; // Return self for chaining
  };
  
  return wrapped;
};

