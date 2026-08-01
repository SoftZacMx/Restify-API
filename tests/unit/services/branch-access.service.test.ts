import { BranchAccessService } from '../../../src/core/application/services/branch-access.service';
import { OrganizationRole } from '../../../src/shared/constants/roles.constants';

describe('BranchAccessService', () => {
  let service: BranchAccessService;
  let branchRepository: { findAllIdsByOrganizationId: jest.Mock };
  let userBranchAccessRepository: { findBranchIdsByUserId: jest.Mock };

  beforeEach(() => {
    branchRepository = { findAllIdsByOrganizationId: jest.fn() };
    userBranchAccessRepository = { findBranchIdsByUserId: jest.fn() };
    service = new BranchAccessService(branchRepository as any, userBranchAccessRepository as any);
  });

  describe('getAccessibleBranchIds', () => {
    it('OWNER accede a todas las sucursales de la org sin consultar asignaciones', async () => {
      branchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2', 'b3']);

      const ids = await service.getAccessibleBranchIds('org-1', 'user-1', OrganizationRole.OWNER);

      expect(ids).toEqual(['b1', 'b2', 'b3']);
      expect(userBranchAccessRepository.findBranchIdsByUserId).not.toHaveBeenCalled();
    });

    it('ADMIN también accede a todas (rol org-wide)', async () => {
      branchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1']);

      const ids = await service.getAccessibleBranchIds('org-1', 'user-1', OrganizationRole.ADMIN);

      expect(ids).toEqual(['b1']);
      expect(userBranchAccessRepository.findBranchIdsByUserId).not.toHaveBeenCalled();
    });

    it('devuelve [] si el rol no-org-wide no tiene sucursales asignadas', async () => {
      userBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue([]);

      const ids = await service.getAccessibleBranchIds('org-1', 'user-1', OrganizationRole.MANAGER);

      expect(ids).toEqual([]);
      expect(branchRepository.findAllIdsByOrganizationId).not.toHaveBeenCalled();
    });

    it('intersecta las asignaciones con las sucursales de la org (aislamiento de tenant)', async () => {
      userBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['b1', 'b-otra-org', 'b2']);
      branchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2', 'b3']);

      const ids = await service.getAccessibleBranchIds('org-1', 'user-1', OrganizationRole.WAITER);

      expect(ids).toEqual(['b1', 'b2']);
    });
  });

  describe('assertCanAccessBranch', () => {
    it('resuelve si el branch está dentro de los accesibles', async () => {
      branchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2']);

      await expect(
        service.assertCanAccessBranch('org-1', 'user-1', OrganizationRole.OWNER, 'b1')
      ).resolves.toBeUndefined();
    });

    it('lanza FORBIDDEN si el branch no está dentro de los accesibles', async () => {
      userBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['b1']);
      branchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1']);

      await expect(
        service.assertCanAccessBranch('org-1', 'user-1', OrganizationRole.CHEF, 'b2')
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });
});
