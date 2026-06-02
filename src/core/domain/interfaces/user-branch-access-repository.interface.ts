import { UserBranchAccess } from '../entities/user-branch-access.entity';

export interface IUserBranchAccessRepository {
  findByUserId(userId: string): Promise<UserBranchAccess[]>;
  findBranchIdsByUserId(userId: string): Promise<string[]>;
  countByBranchId(branchId: string): Promise<number>;
  replaceForUser(userId: string, branchIds: string[]): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
