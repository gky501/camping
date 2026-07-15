import { authError, createFirstAdmin, sessionCookie, type AuthEnv } from '../../_lib/auth';

interface SetupBody {
  username?: string;
  displayName?: string;
  password?: string;
  masterKey?: string;
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  if (!env.AUTH_MASTER_KEY_HASH) return authError('Emergency master key is not configured.', 503);
  try {
    const body = await request.json<SetupBody>();
    const providedHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(body.masterKey ?? '').trim()));
    const providedHex = [...new Uint8Array(providedHash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (providedHex !== env.AUTH_MASTER_KEY_HASH.trim().toLowerCase()) return authError('Emergency master key is not valid.', 403);
    const created = await createFirstAdmin(env.DB, {
      username: String(body.username ?? ''),
      displayName: String(body.displayName ?? ''),
      password: String(body.password ?? ''),
    });
    return Response.json(
      { user: created.user, recoveryCode: created.recoveryCode },
      { status: 201, headers: { 'Set-Cookie': sessionCookie(created.token) } },
    );
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to secure Camp Ledger.', 400);
  }
};
