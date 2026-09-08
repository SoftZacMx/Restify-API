import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { ReactivateOrganizationInput } from '../../dto/organization.dto';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { AppError } from '../../../../shared/errors';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';

/** Ventana (días) durante la cual el owner puede reactivar antes del hard-delete (C.3). */
const REACTIVATION_WINDOW_DAYS = 30;

export interface ReactivateOrganizationResult {
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
  branches?: Array<{ id: string; name: string }>;
}

/**
 * Sub-fase 4.1.G — Reactivación de organización (owner, ruta pública).
 *
 * Confirma la reactivación con el token firmado que llegó por correo
 * (`RequestOrganizationReactivationUseCase`). La identidad se prueba con el control
 * del buzón (token fuera de banda), no con contraseña. Reactiva la org y emite un JWT
 * de sesión, de modo que el owner entra directo sin recordar su contraseña. Corre sin
 * contexto de tenant (la org está marcada como borrada).
 *
 * Unicidad de uso por ESTADO (no por token): reactivar exige que la org siga cerrada.
 * Un token reusado sobre una org ya ACTIVE lanza `ORGANIZATION_ALREADY_ACTIVE`, que el
 * frontend traduce a "ya está activa, inicia sesión". Así el token es de un solo uso
 * efectivo sin persistir nada.
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
    // Verifica firma + expiry + purpose. Token inválido/expirado → INVALID_TOKEN.
    let payload;
    try {
      payload = JwtUtil.verifyOrganizationReactivationToken(input.token);
    } catch {
      throw new AppError('INVALID_TOKEN');
    }

    const user = await withoutTenant(() => this.userRepository.findById(payload.sub));
    // El token porta el owner; si el usuario ya no existe o dejó de ser owner, se rechaza.
    if (!user || !user.isOwner() || user.organizationId !== payload.org) {
      throw new AppError('INVALID_TOKEN');
    }

    const org = await this.organizationRepository.findByIdIncludingDeleted(payload.org);
    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND');
    }

    // Unicidad de uso por estado: si la org ya está activa, el token ya "se gastó".
    if (org.deletedAt === null) {
      throw new AppError('ORGANIZATION_ALREADY_ACTIVE');
    }

    // Ventana de reactivación: vencida → ya pudo ser hard-deleteada por el cron (C.3).
    const deadline = new Date(
      org.deletedAt.getTime() + REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    if (new Date() > deadline) {
      throw new AppError('ORGANIZATION_REACTIVATION_EXPIRED');
    }

    await this.organizationRepository.reactivate(org.id);

    // El owner accede a todas las sucursales: la primera queda como branch inicial y
    // devolvemos el listado (id + name) para poblar la sesión igual que en login.
    const allBranchIds = await this.branchRepository.findAllIdsByOrganizationId(org.id);
    const initialBranchId = allBranchIds[0];
    const branchDetails = await this.branchRepository.findManyForList(org.id, null, {
      includeDisabled: false,
    });
    const branches = branchDetails.map((b) => ({ id: b.id, name: b.name }));

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
        organizationName: org.name,
        mustChangePassword: user.mustChangePassword,
        emailVerified: user.isEmailVerified(),
      },
      branches: branches.length > 0 ? branches : undefined,
    };
  }
}
