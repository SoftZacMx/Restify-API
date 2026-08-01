import { NotFoundMiddleware } from '../../../src/server/middleware/not-found.middleware';

describe('NotFoundMiddleware', () => {
  it('responde 404 con el código NOT_FOUND y la ruta solicitada', () => {
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as any;
    const req = { method: 'GET', path: '/api/no-existe' } as any;

    NotFoundMiddleware.handle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route GET /api/no-existe not found',
        },
        timestamp: expect.any(String),
      })
    );
  });
});
