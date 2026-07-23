import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../domain/interfaces/branch-repository.interface';
import { IOrganizationRepository } from '../../domain/interfaces/organization-repository.interface';
import { Branch } from '../../domain/entities/branch.entity';

/** Tenant resuelto: siempre con branchId concreto (el resolver parte de un branchId). */
export interface ResolvedTenant {
  organizationId: string;
  branchId: string;
}

/**
 * Resultado de resolver el tenant a partir de un branchId.
 *
 * Se devuelve como valor (no se lanza excepción) para que cada llamador decida cómo
 * reaccionar al fallo: un request de usuario mapea el `reason` a un AppError; un webhook
 * lo ignora en silencio (devuelve null). El caso OK incluye el `branch` ya cargado para
 * evitar una segunda búsqueda aguas abajo.
 */
export type TenantResolution =
  | { ok: true; tenant: ResolvedTenant; branch: Branch }
  | { ok: false; reason: 'BRANCH_NOT_FOUND' }
  | { ok: false; reason: 'ORGANIZATION_INACTIVE'; organizationId: string; orgStatus?: string };

export interface ResolveTenantOptions {
  /**
   * Exige que el branch esté activo (status 'active'). Lo usan las rutas de cara al
   * usuario (menú/checkout público): un branch deshabilitado no debe operar. El webhook
   * de pagos lo deja en false: un pago que ya ocurrió debe confirmarse aunque el branch
   * se haya deshabilitado después.
   */
  requireActiveBranch?: boolean;
}

/**
 * Resuelve y valida a qué tenant (organización + sucursal) pertenece un branchId.
 *
 * Centraliza la regla "el branch existe y su organización está ACTIVE" que antes vivía
 * duplicada en PublicTenantMiddleware y en ConfirmMercadoPagoPaymentUseCase.
 */
@injectable()
export class TenantResolverService {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IOrganizationRepository') private readonly organizationRepository: IOrganizationRepository
  ) {}

  async resolve(branchId: string, options?: ResolveTenantOptions): Promise<TenantResolution> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) {
      return { ok: false, reason: 'BRANCH_NOT_FOUND' };
    }

    // Chequeo de branch activo antes que el de la organización, para preservar el orden
    // (y por ende el código de error) del middleware público original.
    if (options?.requireActiveBranch && !branch.isActive()) {
      return { ok: false, reason: 'BRANCH_NOT_FOUND' };
    }

    const org = await this.organizationRepository.findById(branch.organizationId);
    if (!org || org.status !== 'ACTIVE') {
      return {
        ok: false,
        reason: 'ORGANIZATION_INACTIVE',
        organizationId: branch.organizationId,
        orgStatus: org?.status,
      };
    }

    return {
      ok: true,
      tenant: { organizationId: branch.organizationId, branchId: branch.id },
      branch,
    };
  }
}
