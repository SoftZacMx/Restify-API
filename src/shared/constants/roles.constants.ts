export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  WAITER = 'WAITER',
  CHEF = 'CHEF',
}

// Roles con permisos críticos: branches, billing, settings de pagos
export const OWNER_ADMIN: readonly OrganizationRole[] = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
];

// Roles con permisos de gestión: usuarios, reportes, órdenes, gastos
export const MANAGER_AND_UP: readonly OrganizationRole[] = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.MANAGER,
];

// Set para validaciones de acceso a branches (derivado de OWNER_ADMIN)
export const ORG_WIDE_ROLES: ReadonlySet<OrganizationRole> = new Set(OWNER_ADMIN);
