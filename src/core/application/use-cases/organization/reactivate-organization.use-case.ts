import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { ReactivateOrganizationInput } from '../../dto/organization.dto';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { AppError } from '../../../../shared/errors';

/** Ventana (días) durante la cual el owner puede reactivar antes del hard-delete (C.3). */
const REACTIVATION_WINDOW_DAYS = 30;

export interface ReactivateOrganizationResult {
  token: string;
  organization: { id: string; name: string; status: string };
}

/**
 * Sub-fase 4.1.G — Reactivación de organización (owner, ruta pública).
 *
 * Tras `close`, el JWT del owner queda invalidado y el login bloquea orgs cerradas,
 * así que este endpoint NO depende de la sesión: re-valida email+password como un login,
 * pero permitiendo orgs cerradas dentro de la ventana de 30 días. Reactiva la org y emite
 * un JWT nuevo. Corre sin contexto de tenant (la org está marcada como borrada).
 */
@injectable()
export class ReactivateOrganizationUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('IOrganizationRepository')
    private readonly organizationRepository: IOrganizationRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository
  ) {}

  async execute(input: ReactivateOrganizationInput): Promise<ReactivateOrganizationResult> {
    const { email, password } = input;

    // Credenciales inválidas → respuesta uniforme (anti-enumeración).
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isPasswordValid = await BcryptUtil.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Solo el owner puede reactivar.
    if (!user.isOwner()) {
      throw new AppError('FORBIDDEN', 'Solo el owner puede reactivar la organización');
    }

    const org = await this.organizationRepository.findByIdIncludingDeleted(user.organizationId);
    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND');
    }

    // La org debe estar cerrada para poder reactivarse.
    if (org.deletedAt === null) {
      throw new AppError('ORGANIZATION_NOT_CLOSED');
    }

    // Ventana de reactivación: vencida → ya pudo ser hard-deleteada por el cron (C.3).
    const deadline = new Date(
      org.deletedAt.getTime() + REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    if (new Date() > deadline) {
      throw new AppError('ORGANIZATION_REACTIVATION_EXPIRED');
    }

    await this.organizationRepository.reactivate(org.id);

    // El owner accede a todas las sucursales: tomamos la primera como branch inicial.
    const allBranchIds = await this.branchRepository.findAllIdsByOrganizationId(org.id);
    const initialBranchId = allBranchIds[0];

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
      organization: { id: org.id, name: org.name, status: 'ACTIVE' },
    };
  }
}
