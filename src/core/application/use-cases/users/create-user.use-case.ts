import { inject, injectable } from 'tsyringe';
import { UserRole } from '@prisma/client';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../domain/interfaces/user-branch-access-repository.interface';
import { AppError } from '../../../../shared/errors';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { ORG_WIDE_ROLES, OrganizationRole } from '../../../../shared/constants/roles.constants';

/** Input tipado explícitamente para evitar inferencia unknown con z.infer en ts-node */
export interface CreateUserInput {
  name: string;
  last_name: string;
  second_last_name?: string | null;
  email: string;
  password: string;
  phone?: string | null;
  status?: boolean;
  rol: UserRole;
  /** Sucursales asignadas (roles no org-wide). OWNER/ADMIN las ignoran. */
  branchIds?: string[];
}

export interface CreateUserResult {
  id: string;
  name: string;
  last_name: string;
  second_last_name: string | null;
  email: string;
  phone: string | null;
  status: boolean;
  rol: string;
  branchIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class CreateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IUserBranchAccessRepository')
    private readonly userBranchAccessRepository: IUserBranchAccessRepository
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserResult> {
    // Check if user with email already exists
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }

    // Resolver las sucursales a asignar según el rol.
    const branchIds = await this.resolveBranchIds(input.rol, input.branchIds);

    // Hash password
    const hashedPassword = await BcryptUtil.hash(input.password);

    // Create user
    const user = await this.userRepository.create({
      name: input.name,
      last_name: input.last_name,
      second_last_name: input.second_last_name || null,
      email: input.email,
      password: hashedPassword,
      phone: input.phone || null,
      status: input.status ?? true,
      rol: input.rol,
    });

    // Asignar accesos a sucursales (solo roles no org-wide).
    if (branchIds.length > 0) {
      await this.userBranchAccessRepository.replaceForUser(user.id, branchIds);
    }

    // Return user without password
    return {
      id: user.id,
      name: user.name,
      last_name: user.last_name,
      second_last_name: user.second_last_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      rol: user.rol,
      branchIds,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Roles org-wide (OWNER/ADMIN) acceden a todas las sucursales → no se persiste
   * acceso explícito. Para el resto, valida que cada branchId pertenezca a la org
   * del contexto antes de asignarlo.
   */
  private async resolveBranchIds(rol: UserRole, requested?: string[]): Promise<string[]> {
    if (ORG_WIDE_ROLES.has(rol as unknown as OrganizationRole)) {
      return [];
    }
    if (!requested || requested.length === 0) {
      return [];
    }

    const organizationId = getOrganizationId();
    const orgBranchIds = new Set(
      await this.branchRepository.findAllIdsByOrganizationId(organizationId)
    );

    const unique = [...new Set(requested)];
    for (const branchId of unique) {
      if (!orgBranchIds.has(branchId)) {
        // No revelar existencia de sucursales de otra org.
        throw new AppError('BRANCH_NOT_FOUND', `Branch ${branchId} not found`);
      }
    }
    return unique;
  }
}
