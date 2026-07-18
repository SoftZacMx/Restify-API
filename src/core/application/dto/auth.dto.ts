import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rol: z.string().optional(),
});

export const verifyUserSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const setPasswordSchema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/\d/, 'Debe incluir al menos un número')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'Debe incluir al menos un carácter especial'),
  user_id: z.string().uuid('Invalid user ID format'),
});

/**
 * Cambio de la propia contraseña (flujo forzado por mustChangePassword).
 * No pide la contraseña actual: el caso de uso es un reset del owner donde el
 * usuario no la conoce. El userId sale del token, no del body.
 */
export const changeMyPasswordSchema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/\d/, 'Debe incluir al menos un número')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'Debe incluir al menos un carácter especial'),
});

export type ChangeMyPasswordInput = z.infer<typeof changeMyPasswordSchema>;

export const switchBranchSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Solicitud de restablecimiento de contraseña (forgot-password). Solo el email;
 * la respuesta es uniforme (anti-enumeración) exista o no la cuenta.
 */
export const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Confirmación del restablecimiento: token del correo + nueva contraseña.
 * Reusa el mismo criterio de complejidad que setPasswordSchema.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/\d/, 'Debe incluir al menos un número')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'Debe incluir al menos un carácter especial'),
});

export const signupSchema = z.object({
  user: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/\d/, 'Debe incluir al menos un número'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  }),
  organization: z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters'),
  }),
  branch: z.object({
    name: z.string().min(2, 'Branch name must be at least 2 characters'),
    state: z.string().min(1),
    city: z.string().min(1),
    street: z.string().min(1),
    exteriorNumber: z.string().min(1),
    phone: z.string().min(7),
    rfc: z.string().nullish(),
    startOperations: z.string().nullish(),
    endOperations: z.string().nullish(),
    timezone: z.string().default('America/Mexico_City'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyUserInput = z.infer<typeof verifyUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type SwitchBranchInput = z.infer<typeof switchBranchSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

