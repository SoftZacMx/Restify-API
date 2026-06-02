import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../domain/interfaces/user-branch-access-repository.interface';
import { JwtUtil, JwtPayload } from '../../../../shared/utils/jwt.util';
import { AppError } from '../../../../shared/errors';

export interface SwitchBranchInput {
  branchId: string;
  currentUser: JwtPayload; // From authenticated request
}

export interface SwitchBranchResult {
  token: string;
  branch: {
    id: string;
    name: string;
  };
}

@injectable()
export class SwitchBranchUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IUserBranchAccessRepository') private readonly userBranchAccessRepository: IUserBranchAccessRepository
  ) {}

  async execute(input: SwitchBranchInput): Promise<SwitchBranchResult> {
    const { branchId, currentUser } = input;

    // Get full user details
    const user = await this.userRepository.findById(currentUser.sub);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found');
    }

    if (!user.isAccountActive()) {
      throw new AppError('ACCOUNT_DISABLED', 'Account has been disabled');
    }

    // Validate branch exists and belongs to user's organization
    const branch = await this.branchRepository.findByIdAndOrganizationId(branchId, user.organizationId);
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found or does not belong to your organization');
    }

    if (!branch.isActive()) {
      throw new AppError('BRANCH_DISABLED', 'Branch is disabled');
    }

    // Validate user has access to this branch
    const hasAccess = await this.validateBranchAccess(user.id, user.rol, branchId);
    if (!hasAccess) {
      throw new AppError('BRANCH_FORBIDDEN', 'You do not have access to this branch');
    }

    // Generate new token with updated branchId
    const token = JwtUtil.generateToken(
      {
        sub: user.id,
        email: user.email,
        rol: user.rol,
        org: user.organizationId,
        branch: branchId,
        tokenVersion: user.tokenVersion,
        emailVerified: user.isEmailVerified(),
        mustChangePassword: user.mustChangePassword,
      },
      '8h'
    );

    return {
      token,
      branch: {
        id: branch.id,
        name: branch.name,
      },
    };
  }

  /**
   * Validate if user has access to the branch
   */
  private async validateBranchAccess(userId: string, userRole: string, branchId: string): Promise<boolean> {
    // Owner and Admin have access to all branches
    if (userRole === 'OWNER' || userRole === 'ADMIN') {
      return true;
    }

    // Other roles: check user_branch_access
    const assignedBranchIds = await this.userBranchAccessRepository.findBranchIdsByUserId(userId);
    return assignedBranchIds.includes(branchId);
  }
}
