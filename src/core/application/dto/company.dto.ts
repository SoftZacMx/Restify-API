import { z } from 'zod';

export const upsertCompanySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  state: z.string().min(1, 'El estado es requerido').max(100),
  city: z.string().min(1, 'La ciudad es requerida').max(100),
  street: z.string().min(1, 'La calle es requerida').max(200),
  exteriorNumber: z.string().min(1, 'El número exterior es requerido').max(20),
  phone: z.string().min(1, 'El teléfono es requerido').max(30),
  rfc: z.string().max(20).optional().nullable(),
  logoUrl: z
    .string()
    .url('Logo debe ser una URL válida')
    .max(500)
    .optional()
    .nullable(),
  // Horario de operaciones en formato "HH:mm" (ej. "08:00", "22:00")
  startOperations: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato inválido. Use HH:mm (ej. 08:00)')
    .optional()
    .nullable(),
  endOperations: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato inválido. Use HH:mm (ej. 22:00)')
    .optional()
    .nullable(),
  /** Config tickets térmicos (JSON parcial; se fusiona con valores por defecto en servidor) */
  ticketConfig: z.any().optional().nullable(),
});

export type UpsertCompanyInput = z.infer<typeof upsertCompanySchema>;
