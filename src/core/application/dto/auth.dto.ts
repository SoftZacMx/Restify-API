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

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyUserInput = z.infer<typeof verifyUserSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

