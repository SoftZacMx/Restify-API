/// <reference types="jest" />

import { UserBranchAccessRepository } from '../../../src/core/infrastructure/database/repositories/user-branch-access.repository';
import { UserBranchAccess } from '../../../src/core/domain/entities/user-branch-access.entity';

const now = new Date();

const mockPrismaClient = {
  userBranchAccess: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('UserBranchAccessRepository', () => {
  let repository: UserBranchAccessRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.$transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) {
        await op;
      }
    });
    repository = new UserBranchAccessRepository(mockPrismaClient as any);
  });

  describe('findByUserId', () => {
    it('should map rows to entities', async () => {
      mockPrismaClient.userBranchAccess.findMany.mockResolvedValue([
        { userId: 'user-1', branchId: 'branch-a', createdAt: now },
        { userId: 'user-1', branchId: 'branch-b', createdAt: now },
      ]);

      const result = await repository.findByUserId('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(UserBranchAccess);
      expect(result[1].branchId).toBe('branch-b');
    });
  });

  describe('findBranchIdsByUserId', () => {
    it('should return branch ids only', async () => {
      mockPrismaClient.userBranchAccess.findMany.mockResolvedValue([
        { branchId: 'branch-a' },
        { branchId: 'branch-b' },
      ]);

      const result = await repository.findBranchIdsByUserId('user-1');

      expect(result).toEqual(['branch-a', 'branch-b']);
    });
  });

  describe('countByBranchId', () => {
    it('should count assignments', async () => {
      mockPrismaClient.userBranchAccess.count.mockResolvedValue(3);

      const result = await repository.countByBranchId('branch-1');

      expect(result).toBe(3);
    });
  });

  describe('replaceForUser', () => {
    it('should delete and recreate assignments in a transaction', async () => {
      await repository.replaceForUser('user-1', ['branch-a', 'branch-b']);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockPrismaClient.userBranchAccess.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrismaClient.userBranchAccess.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-1', branchId: 'branch-a' },
          { userId: 'user-1', branchId: 'branch-b' },
        ],
      });
    });

    it('should only delete when branch list is empty', async () => {
      await repository.replaceForUser('user-1', []);

      expect(mockPrismaClient.userBranchAccess.createMany).not.toHaveBeenCalled();
    });
  });
});
