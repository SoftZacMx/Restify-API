import { UnregisterWebSocketConnectionUseCase } from '../../../../src/core/application/use-cases/websocket/unregister-websocket-connection.use-case';
import { IWebSocketConnectionRepository } from '../../../../src/core/domain/interfaces/websocket-connection-repository.interface';

describe('UnregisterWebSocketConnectionUseCase', () => {
  let useCase: UnregisterWebSocketConnectionUseCase;
  let connectionRepository: jest.Mocked<IWebSocketConnectionRepository>;
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

    useCase = new UnregisterWebSocketConnectionUseCase(connectionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  it('elimina la conexión y devuelve success', async () => {
    connectionRepository.delete.mockResolvedValue(undefined);

    const result = await useCase.execute({ connectionId: 'conn-1' });

    expect(result).toEqual({ success: true });
    expect(connectionRepository.delete).toHaveBeenCalledWith('conn-1');
  });

  it('devuelve success incluso si el borrado falla', async () => {
    connectionRepository.delete.mockRejectedValue(new Error('dynamo down'));

    const result = await useCase.execute({ connectionId: 'conn-1' });

    expect(result).toEqual({ success: true });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
