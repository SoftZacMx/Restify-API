jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
  singleton: () => (target: any) => target,
  injectable: () => (target: any) => target,
  inject: () => () => undefined,
}));

jest.mock('../../../src/shared/middleware/response-formatter.middleware', () => ({
  sendSuccess: jest.fn(),
}));

jest.mock('../../../src/shared/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { makeController } from '../../../src/shared/utils/make-controller';
import { sendSuccess } from '../../../src/shared/middleware/response-formatter.middleware';

const tsyringe = require('tsyringe');
const mockResolve = tsyringe.container.resolve as jest.Mock;

class FakeUseCase {
  async execute(_input: any) {
    return { ok: true };
  }
}

describe('makeController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let executeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    executeMock = jest.fn().mockResolvedValue({ ok: true });
    mockResolve.mockReturnValue({ execute: executeMock });
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    mockReq = { body: { foo: 'bar' }, user: undefined };
  });

  it('resuelve el use case, usa el mapper por defecto (req.body) y responde con sendSuccess', async () => {
    const controller = makeController(FakeUseCase);

    await controller(mockReq, mockRes, mockNext);

    expect(mockResolve).toHaveBeenCalledWith(FakeUseCase);
    expect(executeMock).toHaveBeenCalledWith({ foo: 'bar' });
    expect(sendSuccess).toHaveBeenCalledWith(mockRes, { ok: true });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('usa un mapper personalizado', async () => {
    const controller = makeController(FakeUseCase, {
      mapper: (req: any) => req.params,
    });
    mockReq = { params: { id: 'order-1' }, user: undefined };

    await controller(mockReq, mockRes, mockNext);

    expect(executeMock).toHaveBeenCalledWith({ id: 'order-1' });
  });

  it('aplica responseMapper al resultado antes de responder', async () => {
    const controller = makeController(FakeUseCase, {
      responseMapper: () => ({ message: 'Deleted' }),
    });

    await controller(mockReq, mockRes, mockNext);

    expect(sendSuccess).toHaveBeenCalledWith(mockRes, { message: 'Deleted' });
  });

  it('soporta use cases legacy que reciben múltiples argumentos', async () => {
    const controller = makeController(FakeUseCase, {
      mapper: () => ['arg1', 'arg2'],
    });

    await controller(mockReq, mockRes, mockNext);

    expect(executeMock).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('con requireAuth y sin user responde 401 UNAUTHORIZED', async () => {
    const controller = makeController(FakeUseCase, { requireAuth: true });

    await controller(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ success: false, error: 'UNAUTHORIZED' });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('con requireAuth inyecta userId y role en el input', async () => {
    const controller = makeController(FakeUseCase, { requireAuth: true });
    mockReq.user = { sub: 'user-1', rol: 'OWNER' };

    await controller(mockReq, mockRes, mockNext);

    expect(executeMock).toHaveBeenCalledWith({
      foo: 'bar',
      userId: 'user-1',
      role: 'OWNER',
    });
  });

  it('con requireAuth e input array inyecta userId/role en el segundo argumento', async () => {
    const controller = makeController(FakeUseCase, {
      requireAuth: true,
      mapper: () => [{ branchId: 'b1' }, { data: 'x' }, 'extra'],
    });
    mockReq.user = { sub: 'user-1', rol: 'ADMIN' };

    await controller(mockReq, mockRes, mockNext);

    expect(executeMock).toHaveBeenCalledWith(
      { branchId: 'b1' },
      { data: 'x', userId: 'user-1', role: 'ADMIN' },
      'extra'
    );
  });

  it('propaga errores del use case al next', async () => {
    const boom = new Error('boom');
    executeMock.mockRejectedValue(boom);
    const controller = makeController(FakeUseCase);

    await controller(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(boom);
    expect(sendSuccess).not.toHaveBeenCalled();
  });

  it('propaga errores del mapper al next', async () => {
    const boom = new Error('mapper boom');
    const controller = makeController(FakeUseCase, {
      mapper: () => {
        throw boom;
      },
    });

    await controller(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(boom);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
