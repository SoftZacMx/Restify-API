import { RegisterWebSocketConnectionUseCase } from '../../../../src/core/application/use-cases/websocket/register-websocket-connection.use-case';
import { IWebSocketConnectionRepository } from '../../../../src/core/domain/interfaces/websocket-connection-repository.interface';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { PaymentSession } from '../../../../src/core/domain/entities/payment-session.entity';

describe('RegisterWebSocketConnectionUseCase', () => {
  let useCase: RegisterWebSocketConnectionUseCase;
  let connectionRepository: jest.Mocked<IWebSocketConnectionRepository>;
  let paymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    connectionRepository = {
      save: jest.fn(),
      getByConnectionId: jest.fn(),
      getByCustomConnectionId: jest.fn(),
      getByUserId: jest.fn(),
      getByPaymentId: jest.fn(),
      delete: jest.fn(),
      deleteByCustomConnectionId: jest.fn(),
    };
    paymentSessionRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByPaymentId: jest.fn(),
    };

    useCase = new RegisterWebSocketConnectionUseCase(
      connectionRepository,
      paymentSessionRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  function makeSession(connectionId: string | null, id = 'session-1'): PaymentSession {
    return new PaymentSession(id, 'payment-1', 'secret', connectionId, new Date(), new Date());
  }

  it('registra una conexión simple sin sesión vinculada', async () => {
    connectionRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({ connectionId: 'conn-1' });

    expect(result).toEqual({ success: true, message: 'Connection registered successfully' });
    expect(connectionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'conn-1',
        connectedAt: expect.any(String),
      })
    );
    expect(paymentSessionRepository.findByPaymentId).not.toHaveBeenCalled();
    expect(paymentSessionRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza un customConnectionId que no coincide con la sesión del pago', async () => {
    paymentSessionRepository.findByPaymentId.mockResolvedValue(makeSession('other-conn'));

    const result = await useCase.execute({
      connectionId: 'conn-1',
      paymentId: 'payment-1',
      customConnectionId: 'custom-1',
    });

    expect(result).toEqual({
      success: false,
      message: 'Invalid customConnectionId for this payment',
    });
    expect(connectionRepository.save).not.toHaveBeenCalled();
  });

  it('registra y vincula la sesión cuando el customConnectionId coincide', async () => {
    paymentSessionRepository.findByPaymentId
      .mockResolvedValueOnce(makeSession('custom-1'))
      .mockResolvedValueOnce(makeSession(null));
    connectionRepository.save.mockResolvedValue(undefined);
    paymentSessionRepository.update.mockResolvedValue(makeSession('custom-1'));

    const result = await useCase.execute({
      connectionId: 'conn-1',
      paymentId: 'payment-1',
      customConnectionId: 'custom-1',
    });

    expect(result).toEqual({ success: true, message: 'Connection registered successfully' });
    expect(connectionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ customConnectionId: 'custom-1', paymentId: 'payment-1' })
    );
    expect(paymentSessionRepository.update).toHaveBeenCalledWith('session-1', {
      connectionId: 'custom-1',
    });
  });

  it('prosigue cuando la sesión no existe', async () => {
    paymentSessionRepository.findByPaymentId.mockResolvedValue(null);
    connectionRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      connectionId: 'conn-1',
      paymentId: 'payment-1',
      customConnectionId: 'custom-1',
    });

    expect(result.success).toBe(true);
    expect(paymentSessionRepository.update).not.toHaveBeenCalled();
  });

  it('no re-escribe la sesión si ya tiene connectionId', async () => {
    paymentSessionRepository.findByPaymentId.mockResolvedValue(makeSession('custom-1'));
    connectionRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      connectionId: 'conn-1',
      paymentId: 'payment-1',
      customConnectionId: 'custom-1',
    });

    expect(result.success).toBe(true);
    expect(paymentSessionRepository.update).not.toHaveBeenCalled();
  });

  it('no falla el registro si falla la actualización de la sesión', async () => {
    paymentSessionRepository.findByPaymentId
      .mockResolvedValueOnce(makeSession('custom-1'))
      .mockResolvedValueOnce(makeSession(null));
    connectionRepository.save.mockResolvedValue(undefined);
    paymentSessionRepository.update.mockRejectedValue(new Error('dynamo down'));

    const result = await useCase.execute({
      connectionId: 'conn-1',
      paymentId: 'payment-1',
      customConnectionId: 'custom-1',
    });

    expect(result).toEqual({ success: true, message: 'Connection registered successfully' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('devuelve success:false con el mensaje del error si falla el guardado', async () => {
    connectionRepository.save.mockRejectedValue(new Error('dynamo down'));

    const result = await useCase.execute({ connectionId: 'conn-1' });

    expect(result).toEqual({ success: false, message: 'dynamo down' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('devuelve mensaje genérico si el error no es una instancia de Error', async () => {
    connectionRepository.save.mockRejectedValue('boom-string');

    const result = await useCase.execute({ connectionId: 'conn-1' });

    expect(result).toEqual({ success: false, message: 'Failed to register connection' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
