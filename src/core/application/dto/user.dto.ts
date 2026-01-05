import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Create User Schema
export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
  second_last_name: z.string().max(100, 'Second last name is too long').optional().nullable(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().max(20, 'Phone number is too long').optional().nullable(),
  status: z.boolean().default(true),
  rol: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid role. Must be ADMIN, MANAGER, WAITER, or CHEF' }),
  }),
});

// Update User Schema (all fields optional except those that shouldn't change)
export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name is too long').optional(),
  second_last_name: z.string().max(100, 'Second last name is too long').optional().nullable(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phone: z.string().max(20, 'Phone number is too long').optional().nullable(),
  status: z.boolean().optional(),
  rol: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid role. Must be ADMIN, MANAGER, WAITER, or CHEF' }),
  }).optional(),
});

// Get User Schema (path parameter)
export const getUserSchema = z.object({
  user_id: z.string().uuid('Invalid user ID format'),
});

// List Users Schema (query parameters)
export const listUsersSchema = z.object({
  rol: z.nativeEnum(UserRole).optional(),
  status: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'all') return 'all'; // Special value to show all users
    return undefined;
  }).optional(),
  email: z.string().optional(),
});

// Delete User Schema (path parameter)
export const deleteUserSchema = z.object({
  user_id: z.string().uuid('Invalid user ID format'),
});

// Reactivate User Schema (path parameter)
export const reactivateUserSchema = z.object({
  user_id: z.string().uuid('Invalid user ID format'),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUserInput = z.infer<typeof getUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ReactivateUserInput = z.infer<typeof reactivateUserSchema>;

