import { z } from 'zod';

/**
 * DTOs del módulo Organization (4.1.G — close / reactivate).
 */

// POST /api/organization/close — owner autenticado.
// `confirmationName` debe coincidir con `organization.name` (confirmación tipo "type to confirm").
export const closeOrganizationSchema = z.object({
  confirmationName: z.string().min(1, 'El nombre de confirmación es requerido').max(200),
});

// POST /api/organization/request-reactivation — ruta pública.
// El owner (sin sesión, la org está cerrada) pide el correo con el link de reactivación.
// Solo necesita el email; la verificación es fuera de banda (control del buzón).
export const requestReactivationSchema = z.object({
  email: z.string().email('Email inválido'),
});

// POST /api/organization/reactivate — ruta pública.
// Confirma la reactivación con el token firmado que llegó por correo (purpose:
// organization_reactivation). La identidad se prueba con el token, no con contraseña.
export const reactivateOrganizationSchema = z.object({
  token: z.string().min(1, 'El token es requerido'),
});

export type CloseOrganizationInput = z.infer<typeof closeOrganizationSchema>;
export type RequestReactivationInput = z.infer<typeof requestReactivationSchema>;
export type ReactivateOrganizationInput = z.infer<typeof reactivateOrganizationSchema>;
