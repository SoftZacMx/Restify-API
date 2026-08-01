import { RequestLoggerMiddleware } from '../../../src/server/middleware/request-logger.middleware';

describe('RequestLoggerMiddleware', () => {
  it('delega al siguiente middleware', () => {
    const next = jest.fn();

    RequestLoggerMiddleware.handle({} as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
