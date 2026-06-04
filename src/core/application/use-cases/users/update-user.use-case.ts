import { inject, injectable } from 'tsyringe';
import { UserRole } from '@prisma/client';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../domain/interfaces/user-branch-access-repository.interface';
import { UpdateUserInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { ORG_WIDE_ROLES, OrganizationRole } from '../../../../shared/constants/roles.constants';

export interface UpdateUserResult {
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
export class UpdateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IUserBranchAccessRepository')
    private readonly userBranchAccessRepository: IUserBranchAccessRepository
  ) {}

  async execute(userId: string, input: UpdateUserInput): Promise<UpdateUserResult> {
    // Check if user exists
    const existingUser = await this.userRepository.findById(userId);
    if (!existingUser) {
      throw new AppError('USER_NOT_FOUND');
    }

    // If email is being updated, check if new email already exists
    if (input.email && input.email !== existingUser.email) {
      const emailUser = await this.userRepository.findByEmail(input.email);
      if (emailUser) {
        throw new AppError('VALIDATION_ERROR', 'User with this email already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.second_last_name !== undefined) updateData.second_last_name = input.second_last_name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.rol !== undefined) updateData.rol = input.rol;

    // Hash password if provided
    if (input.password) {
      updateData.password = await BcryptUtil.hash(input.password);
    }

    // Update user
    const user = await this.userRepository.update(userId, updateData);

    // Rol efectivo tras la actualización (el del input si cambió, si no el existente).
    const effectiveRole = (input.rol ?? existingUser.rol) as UserRole;

    // Si se envió branchIds, reemplazar el set de accesos.
    if (input.branchIds !== undefined) {
      await this.applyBranchIds(user.id, effectiveRole, input.branchIds);
    }

    const branchIds = await this.userBranchAccessRepository.findBranchIdsByUserId(user.id);

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
   * Reemplaza el set de sucursales del usuario. Roles org-wide (OWNER/ADMIN) acceden
   * a todas → se limpia cualquier acceso explícito. Para el resto, valida pertenencia
   * a la org antes de asignar.
   */
  private async applyBranchIds(userId: string, rol: UserRole, requested: string[]): Promise<void> {
    if (ORG_WIDE_ROLES.has(rol as unknown as OrganizationRole)) {
      await this.userBranchAccessRepository.replaceForUser(userId, []);
      return;
    }

    const unique = [...new Set(requested)];
    if (unique.length > 0) {
      const organizationId = getOrganizationId();
      const orgBranchIds = new Set(
        await this.branchRepository.findAllIdsByOrganizationId(organizationId)
      );
      for (const branchId of unique) {
        if (!orgBranchIds.has(branchId)) {
          throw new AppError('BRANCH_NOT_FOUND', `Branch ${branchId} not found`);
        }
      }
    }
    await this.userBranchAccessRepository.replaceForUser(userId, unique);
  }
}
