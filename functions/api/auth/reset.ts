import { authError, resetPassword, sessionCookie, type AuthEnv } from '../../_lib/auth';

interface ResetBody {
  username?: string;
  newPassword?: string;
  recoveryCode?: string;
  masterKey?: string;
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  try {
    const body = await request.json<ResetBody>();
    const result = await resetPassword(env.DB, {
      username: String(body.username ?? ''),
      newPassword: String(body.newPassword ?? ''),
      recoveryCode: body.recoveryCode ? String(body.recoveryCode) : undefined,
      masterKey: body.masterKey ? String(body.masterKey) : undefined,
      masterKeyHash: env.AUTH_MASTER_KEY_HASH,
    });
    return Response.json(
      { user: result.user, recoveryCode: result.recoveryCode },
      { headers: { 'Set-Cookie': sessionCookie(result.token) } },
    );
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to reset the password.', 400);
  }
};
