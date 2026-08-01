import { LogoutUseCase } from '../../../../src/core/application/use-cases/auth/logout.use-case';

describe('LogoutUseCase', () => {
  it('devuelve el mensaje de logout exitoso', async () => {
    const useCase = new LogoutUseCase();

    await expect(useCase.execute()).resolves.toEqual({ message: 'Logged out successfully' });
  });
});
