import { BranchLimitService } from '../../../src/core/application/services/branch-limit.service';
import { OrganizationPlan } from '@prisma/client';

describe('BranchLimitService', () => {
  let service: BranchLimitService;
  let organizationRepository: { findById: jest.Mock };

  beforeEach(() => {
    organizationRepository = { findById: jest.fn() };
    service = new BranchLimitService(organizationRepository as any);
  });

  it('lanza ORGANIZATION_NOT_FOUND si la org no existe', async () => {
    organizationRepository.findById.mockResolvedValue(null);

    await expect(service.getMaxBranches('org-1')).rejects.toMatchObject({
      code: 'ORGANIZATION_NOT_FOUND',
    });
  });

  it('devuelve 3 para el plan FREE', async () => {
    organizationRepository.findById.mockResolvedValue({ id: 'org-1', plan: OrganizationPlan.FREE });

    await expect(service.getMaxBranches('org-1')).resolves.toBe(3);
  });

  it('devuelve 10 para el plan PRO', async () => {
    organizationRepository.findById.mockResolvedValue({ id: 'org-1', plan: OrganizationPlan.PRO });

    await expect(service.getMaxBranches('org-1')).resolves.toBe(10);
  });

  it('devuelve 999 para el plan ENTERPRISE', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      plan: OrganizationPlan.ENTERPRISE,
    });

    await expect(service.getMaxBranches('org-1')).resolves.toBe(999);
  });

  it('cae a FREE si el plan es desconocido', async () => {
    organizationRepository.findById.mockResolvedValue({ id: 'org-1', plan: 'UNKNOWN' });

    await expect(service.getMaxBranches('org-1')).resolves.toBe(3);
  });
});
