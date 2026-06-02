import { PrismaClient } from '@prisma/client';
import { IUserBranchAccessRepository } from '../../../domain/interfaces/user-branch-access-repository.interface';
import { UserBranchAccess } from '../../../domain/entities/user-branch-access.entity';

export class UserBranchAccessRepository implements IUserBranchAccessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserBranchAccess[]> {
    const rows = await this.prisma.userBranchAccess.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findBranchIdsByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.userBranchAccess.findMany({
      where: { userId },
      select: { branchId: true },
    });
    return rows.map((row) => row.branchId);
  }

  async countByBranchId(branchId: string): Promise<number> {
    return this.prisma.userBranchAccess.count({ where: { branchId } });
  }

  async replaceForUser(userId: string, branchIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userBranchAccess.deleteMany({ where: { userId } }),
      ...(branchIds.length > 0
        ? [
            this.prisma.userBranchAccess.createMany({
              data: branchIds.map((branchId) => ({ userId, branchId })),
            }),
          ]
        : []),
    ]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.userBranchAccess.deleteMany({ where: { userId } });
  }

  private toEntity(row: { userId: string; branchId: string; createdAt: Date }): UserBranchAccess {
    return new UserBranchAccess(row.userId, row.branchId, row.createdAt);
  }
}
