import { BranchTimezoneService } from '../../../src/core/application/services/branch-timezone.service';
import { IBranchRepository } from '../../../src/core/domain/interfaces/branch-repository.interface';
import { APP_TIMEZONE } from '../../../src/shared/constants';

jest.mock('../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getBranchId: jest.fn(() => 'branch-1'),
}));

import { getBranchId } from '../../../src/core/infrastructure/tenant/tenant-context';

describe('BranchTimezoneService', () => {
  let service: BranchTimezoneService;
  let branchRepository: jest.Mocked<IBranchRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    branchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    service = new BranchTimezoneService(branchRepository);
    (getBranchId as jest.Mock).mockReturnValue('branch-1');
  });

  it('cae a APP_TIMEZONE cuando no hay sucursal en curso', async () => {
    (getBranchId as jest.Mock).mockReturnValue(undefined);

    await expect(service.get()).resolves.toBe(APP_TIMEZONE);
    expect(branchRepository.findById).not.toHaveBeenCalled();
  });

  it('usa la zona horaria válida de la sucursal', async () => {
    branchRepository.findById.mockResolvedValue({
      timezone: 'America/Argentina/Buenos_Aires',
    } as any);

    await expect(service.get()).resolves.toBe('America/Argentina/Buenos_Aires');
    expect(branchRepository.findById).toHaveBeenCalledWith('branch-1');
  });

  it('cae a APP_TIMEZONE si la sucursal no existe', async () => {
    branchRepository.findById.mockResolvedValue(null);

    await expect(service.get()).resolves.toBe(APP_TIMEZONE);
  });

  it('cae a APP_TIMEZONE si la zona guardada es inválida', async () => {
    branchRepository.findById.mockResolvedValue({ timezone: 'America/Mexico' } as any);

    await expect(service.get()).resolves.toBe(APP_TIMEZONE);
  });

  it('cae a APP_TIMEZONE si la sucursal no tiene zona guardada', async () => {
    branchRepository.findById.mockResolvedValue({ timezone: null } as any);

    await expect(service.get()).resolves.toBe(APP_TIMEZONE);
  });
});
