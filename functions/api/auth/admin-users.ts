import { authError, listUsers, requireAdmin, type AuthEnv } from '../../_lib/auth';

const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
  const pairs = value.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomHex(length: number): string {
  return bytesToHex(randomBytes(length));
}

function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(24);
  let raw = '';
  for (let index = 0; index < 24; index += 1) raw += alphabet[bytes[index] % alphabet.length];
  return raw.match(/.{1,4}/g)?.join('-') ?? raw;
}

function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function passwordError(value: string): string | undefined {
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 200) return 'Password is too long.';
  return undefined;
}

export const onRequestPut: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const admin = await requireAdmin(request, env.DB);
  if (admin instanceof Response) return admin;
  try {
    const body = await request.json<{ userId?: string; password?: string }>();
    const userId = String(body.userId ?? '').trim();
    const password = String(body.password ?? '');
    if (!userId) return authError('Choose an account to reset.');
    const validation = passwordError(password);
    if (validation) return authError(validation);
    const account = await env.DB.prepare('SELECT id,display_name FROM auth_users WHERE id=?').bind(userId).first<Record<string, unknown>>();
    if (!account) return authError('Account not found.', 404);

    const salt = randomHex(16);
    const generatedRecoveryCode = recoveryCode();
    await env.DB.batch([
      env.DB.prepare(`UPDATE auth_users SET password_hash=?,password_salt=?,recovery_hash=?,failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(await passwordHash(password, salt), salt, await sha256(normalizeRecoveryCode(generatedRecoveryCode)), userId),
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(userId),
    ]);
    return Response.json({ recoveryCode: generatedRecoveryCode, displayName: String(account.display_name ?? 'Account') });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to reset the account password.', 400);
  }
};

export const onRequestDelete: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const admin = await requireAdmin(request, env.DB);
  if (admin instanceof Response) return admin;
  try {
    const body = await request.json<{ userId?: string }>();
    const userId = String(body.userId ?? '').trim();
    if (!userId) return authError('Choose an account to delete.');
    if (userId === admin.id) return authError('You cannot delete the account you are currently using.');

    const account = await env.DB.prepare('SELECT id,role FROM auth_users WHERE id=?').bind(userId).first<Record<string, unknown>>();
    if (!account) return authError('Account not found.', 404);
    if (String(account.role) === 'admin') {
      const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_users WHERE role='admin'").first<{ count: number }>();
      if (Number(count?.count ?? 0) <= 1) return authError('Camp Ledger must keep at least one administrator account.');
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(userId),
      env.DB.prepare('DELETE FROM auth_users WHERE id=?').bind(userId),
    ]);
    return Response.json({ users: await listUsers(env.DB) });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to delete the account.', 400);
  }
};
