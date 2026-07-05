import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../domain/interfaces/user-branch-access-repository.interface';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { LoginInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';
import { UserRole } from '@prisma/client';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    last_name: string;
    second_last_name: string | null;
    email: string;
    rol: string;
    organizationId: string;
    organizationName: string;
    mustChangePassword: boolean;
    emailVerified: boolean;
  };
  branches?: Array<{
    id: string;
    name: string;
  }>;
}

@injectable()
export class LoginUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('IOrganizationRepository') private readonly organizationRepository: IOrganizationRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IUserBranchAccessRepository') private readonly userBranchAccessRepository: IUserBranchAccessRepository
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const { email, password } = input;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Validate user status (legacy field)
    if (!user.isActive()) {
      throw new AppError('USER_DISABLED', 'User account is disabled');
    }

    // Validate account status (multi-tenant field)
    if (!user.isAccountActive()) {
      throw new AppError('ACCOUNT_DISABLED', 'Account has been disabled');
    }

    // Validate organization is active
    const organization = await this.organizationRepository.findById(user.organizationId);
    if (!organization) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found');
    }

    if (organization.status !== 'ACTIVE') {
      throw new AppError('ORGANIZATION_INACTIVE', 'Organization is not active');
    }

    // Verify password
    const isPasswordValid = await BcryptUtil.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Get initial branch
    let initialBranchId: string | null = null;
    let branches: Array<{ id: string; name: string }> = [];

    if (user.hasAccessToAllBranches()) {
      // Owner/Admin: get first active branch
      const allBranches = await this.branchRepository.findAllIdsByOrganizationId(user.organizationId);

      if (allBranches.length > 0) {
        initialBranchId = allBranches[0];

        // Get branch details for response
        const branchDetails = await this.branchRepository.findManyForList(
          user.organizationId,
          null,
          { includeDisabled: false }
        );
        branches = branchDetails.map(b => ({ id: b.id, name: b.name }));
      }
    } else {
      // Manager/Waiter/Chef: get assigned branches
      const assignedBranchIds = await this.userBranchAccessRepository.findBranchIdsByUserId(user.id);

      if (assignedBranchIds.length > 0) {
        initialBranchId = assignedBranchIds[0];

        // Get branch details
        const branchDetails = await this.branchRepository.findManyForList(
          user.organizationId,
          assignedBranchIds,
          { includeDisabled: false }
        );
        branches = branchDetails.map(b => ({ id: b.id, name: b.name }));
      }
    }

    // Generate token with multi-tenant payload
    const token = JwtUtil.generateToken(
      {
        sub: user.id,
        email: user.email,
        rol: user.rol,
        org: user.organizationId,
        branch: initialBranchId ?? undefined,
        tokenVersion: user.tokenVersion,
        emailVerified: user.isEmailVerified(),
        mustChangePassword: user.mustChangePassword,
      },
      '8h'
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        last_name: user.last_name,
        second_last_name: user.second_last_name,
        email: user.email,
        rol: user.rol,
        organizationId: user.organizationId,
        organizationName: organization.name,
        mustChangePassword: user.mustChangePassword,
        emailVerified: user.isEmailVerified(),
      },
      branches: branches.length > 0 ? branches : undefined,
    };
  }
}

