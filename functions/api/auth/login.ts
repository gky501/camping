import { authError, login, sessionCookie, type AuthEnv } from '../../_lib/auth';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  try {
    const body = await request.json<{ username?: string; password?: string }>();
    const result = await login(env.DB, String(body.username ?? ''), String(body.password ?? ''));
    return Response.json({ user: result.user }, { headers: { 'Set-Cookie': sessionCookie(result.token) } });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to sign in.', 401);
  }
};
