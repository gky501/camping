import { authError, changePassword, requireUser, sessionCookie, type AuthEnv } from '../../_lib/auth';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const user = await requireUser(request, env.DB);
  if (user instanceof Response) return user;
  try {
    const body = await request.json<{ oldValue?: string; newValue?: string }>();
    const result = await changePassword(env.DB, user, String(body.oldValue ?? ''), String(body.newValue ?? ''));
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(result.token) } });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to update the account.', 400);
  }
};
