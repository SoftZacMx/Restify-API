/// <reference types="jest" />

import { BranchStatus } from '@prisma/client';
import { BranchRepository } from '../../../src/core/infrastructure/database/repositories/branch.repository';
import { Branch } from '../../../src/core/domain/entities/branch.entity';

const now = new Date();

const mockBranchRow = {
  id: 'branch-1',
  organizationId: 'org-1',
  name: 'Sucursal Centro',
  state: 'CDMX',
  city: 'Ciudad de México',
  street: 'Av. Reforma',
  exteriorNumber: '100',
  phone: '5555555555',
  rfc: 'RFC123',
  logoUrl: null,
  startOperations: '08:00',
  endOperations: '22:00',
  ticketConfig: { showBrandBranch: true },
  paymentConfig: null,
  timezone: 'America/Mexico_City',
  currency: 'MXN',
  status: BranchStatus.ACTIVE,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const mockPrismaClient = {
  branch: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('BranchRepository', () => {
  let repository: BranchRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new BranchRepository(mockPrismaClient as any);
  });

  describe('findById', () => {
    it('should map prisma row to Branch entity', async () => {
      mockPrismaClient.branch.findUnique.mockResolvedValue(mockBranchRow);

      const result = await repository.findById('branch-1');

      expect(result).toBeInstanceOf(Branch);
      expect(result?.id).toBe('branch-1');
      expect(result?.organizationId).toBe('org-1');
      expect(result?.status).toBe('active');
      expect(result?.isActive()).toBe(true);
    });

    it('should return null when not found', async () => {
      mockPrismaClient.branch.findUnique.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndOrganizationId', () => {
    it('should scope by organization', async () => {
      mockPrismaClient.branch.findFirst.mockResolvedValue(mockBranchRow);

      await repository.findByIdAndOrganizationId('branch-1', 'org-1');

      expect(mockPrismaClient.branch.findFirst).toHaveBeenCalledWith({
        where: { id: 'branch-1', organizationId: 'org-1' },
      });
    });
  });

  describe('findManyByOrganizationId', () => {
    it('should filter active branches by default', async () => {
      mockPrismaClient.branch.findMany.mockResolvedValue([mockBranchRow]);

      const result = await repository.findManyByOrganizationId('org-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaClient.branch.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', status: BranchStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should include disabled when requested', async () => {
      mockPrismaClient.branch.findMany.mockResolvedValue([]);

      await repository.findManyByOrganizationId('org-1', { includeDisabled: true });

      expect(mockPrismaClient.branch.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('countActiveByOrganizationId', () => {
    it('should count only active branches', async () => {
      mockPrismaClient.branch.count.mockResolvedValue(2);

      const result = await repository.countActiveByOrganizationId('org-1');

      expect(result).toBe(2);
      expect(mockPrismaClient.branch.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', status: BranchStatus.ACTIVE },
      });
    });
  });

  describe('create', () => {
    it('should create branch with defaults', async () => {
      mockPrismaClient.branch.create.mockResolvedValue(mockBranchRow);

      const result = await repository.create({
        organizationId: 'org-1',
        name: 'Sucursal Centro',
        state: 'CDMX',
        city: 'Ciudad de México',
        street: 'Av. Reforma',
        exteriorNumber: '100',
        phone: '5555555555',
      });

      expect(result).toBeInstanceOf(Branch);
      expect(mockPrismaClient.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            timezone: 'America/Mexico_City',
            currency: 'MXN',
            status: BranchStatus.ACTIVE,
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('should map disabled status', async () => {
      mockPrismaClient.branch.update.mockResolvedValue({
        ...mockBranchRow,
        status: BranchStatus.DISABLED,
      });

      const result = await repository.update('branch-1', { status: 'disabled' });

      expect(result.status).toBe('disabled');
      expect(result.isActive()).toBe(false);
    });
  });
});
