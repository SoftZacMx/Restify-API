import { UpdateBranchUseCase } from '../../../../src/core/application/use-cases/branches/update-branch.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../../../src/core/application/services/branch-access.service';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { OrganizationRole } from '../../../../src/shared/constants/roles.constants';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
}));

function makeBranch(): Branch {
  const now = new Date();
  return new Branch(
    'branch-1',
    'org-1',
    'Tacos El Rey',
    'CDMX',
    'CDMX',
    'Reforma',
    '123',
    '5512345678',
    null,
    null,
    null,
    null,
    null,
    null,
    'America/Mexico_City',
    'MXN',
    'active',
    now,
    now,
    null,
    'tacos-el-rey'
  );
}

describe('UpdateBranchUseCase', () => {
  let useCase: UpdateBranchUseCase;
  let branchRepository: jest.Mocked<IBranchRepository>;
  let branchAccessService: jest.Mocked<BranchAccessService>;

  beforeEach(() => {
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

    branchAccessService = {
      assertCanAccessBranch: jest.fn(),
      getAccessibleBranchIds: jest.fn(),
    } as unknown as jest.Mocked<BranchAccessService>;

    useCase = new UpdateBranchUseCase(branchRepository, branchAccessService);
  });

  it('actualiza la sucursal y devuelve el detalle', async () => {
    const branch = makeBranch();
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(branch);
    branchRepository.update.mockResolvedValue(branch);

    const result = await useCase.execute({
      branchId: 'branch-1',
      userId: 'user-1',
      role: OrganizationRole.OWNER,
      data: { name: 'Tacos Nuevos', phone: '999' },
    });

    expect(branchAccessService.assertCanAccessBranch).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      OrganizationRole.OWNER,
      'branch-1'
    );
    expect(branchRepository.update).toHaveBeenCalledWith('branch-1', {
      name: 'Tacos Nuevos',
      phone: '999',
    });
    expect(result).toMatchObject({ id: 'branch-1' });
  });

  it('solo pasa los campos provistos (no toca los ausentes)', async () => {
    const branch = makeBranch();
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(branch);
    branchRepository.update.mockResolvedValue(branch);

    await useCase.execute({
      branchId: 'branch-1',
      userId: 'user-1',
      role: OrganizationRole.OWNER,
      data: { name: 'Renombrada' },
    });

    expect(branchRepository.update).toHaveBeenCalledWith('branch-1', { name: 'Renombrada' });
  });

  it('pasa todos los campos cuando vienen completos', async () => {
    const branch = makeBranch();
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(branch);
    branchRepository.update.mockResolvedValue(branch);

    await useCase.execute({
      branchId: 'branch-1',
      userId: 'user-1',
      role: OrganizationRole.OWNER,
      data: {
        name: 'Nueva',
        state: 'JAL',
        city: 'GDL',
        street: 'Av',
        exteriorNumber: '1',
        phone: '111',
        rfc: 'RFC',
        logoUrl: 'https://logo.png',
        startOperations: '08:00',
        endOperations: '22:00',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        ticketConfig: { footer: 'x' },
        paymentConfig: 'config',
      },
    });

    expect(branchRepository.update).toHaveBeenCalledWith('branch-1', {
      name: 'Nueva',
      state: 'JAL',
      city: 'GDL',
      street: 'Av',
      exteriorNumber: '1',
      phone: '111',
      rfc: 'RFC',
      logoUrl: 'https://logo.png',
      startOperations: '08:00',
      endOperations: '22:00',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      ticketConfig: { footer: 'x' },
      paymentConfig: 'config',
    });
  });

  it('lanza BRANCH_NOT_FOUND si la sucursal no existe en la org', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        branchId: 'branch-1',
        userId: 'user-1',
        role: OrganizationRole.OWNER,
        data: { name: 'X' },
      })
    ).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });

    expect(branchRepository.update).not.toHaveBeenCalled();
  });

  it('propaga FORBIDDEN cuando el usuario no tiene acceso', async () => {
    branchAccessService.assertCanAccessBranch.mockRejectedValue(
      Object.assign(new Error('No tienes acceso a esta sucursal'), { code: 'FORBIDDEN' })
    );

    await expect(
      useCase.execute({
        branchId: 'branch-1',
        userId: 'user-1',
        role: OrganizationRole.WAITER,
        data: { name: 'X' },
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(branchRepository.update).not.toHaveBeenCalled();
  });
});
