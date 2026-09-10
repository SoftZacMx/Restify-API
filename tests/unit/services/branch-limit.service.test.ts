import { BranchLimitService } from '../../../src/core/application/services/branch-limit.service';

describe('BranchLimitService', () => {
  let service: BranchLimitService;
  let subscriptionRepository: { find: jest.Mock };
  let planRepository: { findById: jest.Mock };

  beforeEach(() => {
    subscriptionRepository = { find: jest.fn() };
    planRepository = { findById: jest.fn() };
    service = new BranchLimitService(
      subscriptionRepository as any,
      planRepository as any
    );
  });

  it('devuelve el maxBranches del plan de la suscripcion', async () => {
    subscriptionRepository.find.mockResolvedValue({ id: 'sub-1', planId: 'plan-1' });
    planRepository.findById.mockResolvedValue({ id: 'plan-1', maxBranches: 10 });

    await expect(service.getMaxBranches()).resolves.toBe(10);
    expect(planRepository.findById).toHaveBeenCalledWith('plan-1');
  });

  it('devuelve el default si no hay suscripcion', async () => {
    subscriptionRepository.find.mockResolvedValue(null);

    await expect(service.getMaxBranches()).resolves.toBe(3);
    expect(planRepository.findById).not.toHaveBeenCalled();
  });

  it('devuelve el default si la suscripcion no tiene plan', async () => {
    subscriptionRepository.find.mockResolvedValue({ id: 'sub-1', planId: null });

    await expect(service.getMaxBranches()).resolves.toBe(3);
    expect(planRepository.findById).not.toHaveBeenCalled();
  });

  it('devuelve el default si el plan referenciado no existe', async () => {
    subscriptionRepository.find.mockResolvedValue({ id: 'sub-1', planId: 'plan-borrado' });
    planRepository.findById.mockResolvedValue(null);

    await expect(service.getMaxBranches()).resolves.toBe(3);
  });
});
