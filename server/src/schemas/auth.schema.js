import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name cannot exceed 60 characters'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters long')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
  }).strict()
};

export const loginSchema = {
  body: z
    .object({
      email: z
        .string({ required_error: 'Email is required' })
        .trim()
        .toLowerCase()
        .email('Please provide a valid email address'),
      password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password is required')
    })
    .strict()
};

export default {
  registerSchema,
  loginSchema
};
