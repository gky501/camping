import { authError, currentUser, ensureAuthSchema, type AuthEnv } from '../_lib/auth';

const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/status',
  '/api/auth/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset',
]);

export const onRequest: PagesFunction<AuthEnv> = async (context) => {
  if (context.request.method === 'OPTIONS') return context.next();
  const pathname = new URL(context.request.url).pathname;
  if (PUBLIC_AUTH_PATHS.has(pathname)) return context.next();
  if (!context.env.DB) return authError('D1 binding DB is not configured.', 503);
  await ensureAuthSchema(context.env.DB);
  const user = await currentUser(context.request, context.env.DB);
  if (!user) return authError('Sign in to continue.', 401);
  return context.next();
};
