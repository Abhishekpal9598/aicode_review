import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env, with fallback to root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export function calculateEntropy(str) {
  if (!str || typeof str !== 'string') return 0;
  const charMap = {};
  for (let i = 0; i < str.length; i++) {
    charMap[str[i]] = (charMap[str[i]] || 0) + 1;
  }
  let entropy = 0;
  for (const char in charMap) {
    const p = charMap[char] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export const INSECURE_DEFAULT_JWT_SECRETS = new Set([
  'dev_jwt_secret_entropy_key_must_be_at_least_32_chars_long_12345',
  'your_super_secret_jwt_entropy_key_at_least_32_characters_long',
  'super-secret-jwt-key-replace-in-production',
  'super_secret_jwt_entropy_key_at_least_32_chars_long_12345',
  'default_secret_please_change_in_production'
]);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'], {
        errorMap: () => ({ message: "NODE_ENV must be 'development', 'test', or 'production'" })
      })
      .default('development'),
    PORT: z
      .string()
      .regex(/^\d+$/, { message: 'PORT must be a numeric integer string' })
      .transform((val) => parseInt(val, 10))
      .or(z.number().int().positive())
      .default(5001),
    CLIENT_URL: z
      .string()
      .url({ message: 'CLIENT_URL must be a valid URL (e.g. http://localhost:5173)' })
      .default('http://localhost:5173'),
    MONGODB_URI: z
      .string()
      .refine(
        (val) => !val || val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'),
        { message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://' }
      )
      .optional(),
    JWT_SECRET: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          return trimmed.length > 0 ? trimmed : undefined;
        }
        return val;
      },
      z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters long' }).optional()
    ),
    JWT_EXPIRES_IN: z
      .string()
      .default('15m'),
    REFRESH_TOKEN_SECRET: z
      .string()
      .min(32)
      .optional(),
    REFRESH_TOKEN_EXPIRES_IN: z
      .string()
      .default('7d'),
    TRUST_PROXY: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim().toLowerCase();
          if (trimmed === 'true') return true;
          if (trimmed === 'false') return false;
          if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
          return trimmed;
        }
        return val;
      },
      z.union([z.boolean(), z.number().int().min(0), z.string()]).default(1)
    ),
    GEMINI_API_KEY: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          return trimmed.length > 0 ? trimmed : undefined;
        }
        return val;
      },
      z.string().min(1, { message: 'GEMINI_API_KEY cannot be empty when provided' }).optional()
    ),
    GEMINI_MODEL: z
      .string()
      .trim()
      .min(1, { message: 'GEMINI_MODEL cannot be empty' })
      .default('gemini-3.5-flash'),
    GEMINI_TIMEOUT_MS: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10);
          }
        }
        return val;
      },
      z
        .number({
          invalid_type_error: 'GEMINI_TIMEOUT_MS must be a positive integer between 1 and 30000'
        })
        .int({ message: 'GEMINI_TIMEOUT_MS must be an integer' })
        .min(1, { message: 'GEMINI_TIMEOUT_MS must be at least 1 millisecond' })
        .max(30000, { message: 'GEMINI_TIMEOUT_MS cannot exceed 30000 milliseconds (30 seconds)' })
        .default(30000)
    ),
    HEALTH_RATE_LIMIT_MAX: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10);
          }
        }
        return val;
      },
      z
        .number({
          invalid_type_error: 'HEALTH_RATE_LIMIT_MAX must be a positive integer'
        })
        .int({ message: 'HEALTH_RATE_LIMIT_MAX must be an integer' })
        .positive({ message: 'HEALTH_RATE_LIMIT_MAX must be greater than 0' })
        .default(60)
    )
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.JWT_SECRET || typeof data.JWT_SECRET !== 'string' || data.JWT_SECRET.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET is strictly required in production mode and cannot be omitted'
        });
      } else {
        const secret = data.JWT_SECRET.trim();
        const lower = secret.toLowerCase();

        if (secret.length < 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be at least 32 characters long'
          });
        }

        if (
          INSECURE_DEFAULT_JWT_SECRETS.has(secret) ||
          lower.includes('replace-in-production') ||
          lower.includes('dev_jwt_secret') ||
          lower.includes('your_super_secret')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET cannot use default or placeholder secret in production'
          });
        }

        const uniqueChars = new Set(secret).size;
        const entropy = calculateEntropy(secret);
        if (uniqueChars < 10 || entropy < 3.0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must possess strong entropy with sufficient character diversity'
          });
        }
      }
    } else {
      if (!data.JWT_SECRET || data.JWT_SECRET.trim().length === 0) {
        data.JWT_SECRET = 'dev_jwt_secret_entropy_key_must_be_at_least_32_chars_long_12345';
      }
    }
  });

let parsedEnv;

try {
  parsedEnv = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CLIENT_URL: process.env.CLIENT_URL,
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS,
    TRUST_PROXY: process.env.TRUST_PROXY,
    HEALTH_RATE_LIMIT_MAX: process.env.HEALTH_RATE_LIMIT_MAX
  });
} catch (error) {
  if (error instanceof z.ZodError) {
    const errorDetails = error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    logger.error(`Environment variable validation failed:\n${errorDetails}`);
    process.exit(1);
  }
  throw error;
}

export const env = parsedEnv;
export { envSchema };
export default env;
