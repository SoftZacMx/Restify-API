import { OrganizationPlan } from '@prisma/client';

export interface OrganizationRecord {
  id: string;
  name: string;
  plan: OrganizationPlan;
  status: string;
  deletedAt: Date | null;
}

export interface IOrganizationRepository {
  findById(id: string): Promise<OrganizationRecord | null>;
  findFirstActive(): Promise<OrganizationRecord | null>;
  /**
   * Busca una organización por id incluyendo las cerradas (`deletedAt != null`).
   * Necesario para el flujo de reactivación, donde la org está marcada como borrada.
   */
  findByIdIncludingDeleted(id: string): Promise<OrganizationRecord | null>;
  /**
   * Cierra la organización (4.1.G): marca `deletedAt = now()` + `status = CANCELLED`
   * e incrementa el `tokenVersion` de todos sus usuarios (invalida sus sesiones).
   * Atómico vía transacción. Devuelve el registro actualizado.
   */
  close(id: string): Promise<OrganizationRecord>;
  /**
   * Reactiva una organización cerrada: limpia `deletedAt` + `status = ACTIVE`.
   */
  reactivate(id: string): Promise<OrganizationRecord>;
  /**
   * Cuentas fantasma (4.1.F): orgs aún activas (`deletedAt = null`) cuyo owner nunca
   * verificó su email (`emailVerifiedAt = null`) y que se crearon antes de `threshold`.
   * Cross-tenant: debe llamarse dentro de `withoutTenant`.
   */
  findUnverifiedOwnerOrgIdsOlderThan(threshold: Date): Promise<string[]>;
}
