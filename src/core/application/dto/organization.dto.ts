import { z } from 'zod';

/**
 * DTOs del módulo Organization (4.1.G — close / reactivate).
 */

// POST /api/organization/close — owner autenticado.
// `confirmationName` debe coincidir con `organization.name` (confirmación tipo "type to confirm").
export const closeOrganizationSchema = z.object({
  confirmationName: z.string().min(1, 'El nombre de confirmación es requerido').max(200),
});

// POST /api/organization/reactivate — ruta pública (la org está cerrada, el JWT viejo ya no sirve).
// Re-valida credenciales como un login.
export const reactivateOrganizationSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type CloseOrganizationInput = z.infer<typeof closeOrganizationSchema>;
export type ReactivateOrganizationInput = z.infer<typeof reactivateOrganizationSchema>;
