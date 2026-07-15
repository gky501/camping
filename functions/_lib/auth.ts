export interface AuthEnv {
  DB: D1Database;
  AUTH_MASTER_KEY_HASH?: string;
  PHOTOS?: R2Bucket;
}

export type AuthRole = 'admin' | 'member';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
}

interface AuthUserRow extends Record<string, unknown> {
  id: string;
  username: string;
  display_name: string;
  role: AuthRole;
  password_hash: string;
  password_salt: string;
  recovery_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

const encoder = new TextEncoder();
const SESSION_COOKIE = 'camp_ledger_session';
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 310_000;

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

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return different === 0;
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

function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(24);
  let raw = '';
  for (let index = 0; index < 24; index += 1) raw += alphabet[bytes[index] % alphabet.length];
  return raw.match(/.{1,4}/g)?.join('-') ?? raw;
}

function userFromRow(row: AuthUserRow): AuthUser {
  return { id: String(row.id), username: String(row.username), displayName: String(row.display_name), role: row.role === 'admin' ? 'admin' : 'member' };
}

export function authError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function validateUsername(value: string): string | undefined {
  const normalized = normalizeUsername(value);
  if (!/^[a-z0-9._-]{3,50}$/.test(normalized)) return undefined;
  return normalized;
}

export function validatePassword(value: string): string | undefined {
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 200) return 'Password is too long.';
  return undefined;
}

export async function ensureAuthSchema(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at)').run();
}

export async function authInitialized(db: D1Database): Promise<boolean> {
  await ensureAuthSchema(db);
  const row = await db.prepare('SELECT COUNT(*) AS count FROM auth_users').first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

function cookieValue(request: Request): string | undefined {
  const cookie = request.headers.get('Cookie') ?? '';
  for (const piece of cookie.split(';')) {
    const [name, ...rest] = piece.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function currentUser(request: Request, db: D1Database): Promise<AuthUser | undefined> {
  await ensureAuthSchema(db);
  const token = cookieValue(request);
  if (!token) return undefined;
  const tokenHash = await sha256(token);
  const row = await db.prepare(`SELECT u.id,u.username,u.display_name,u.role,u.password_hash,u.password_salt,u.recovery_hash,u.failed_attempts,u.locked_until
    FROM auth_sessions s INNER JOIN auth_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP`).bind(tokenHash).first<AuthUserRow>();
  return row ? userFromRow(row) : undefined;
}

export async function requireUser(request: Request, db: D1Database): Promise<AuthUser | Response> {
  const user = await currentUser(request, db);
  return user ?? authError('Sign in to continue.', 401);
}

export async function requireAdmin(request: Request, db: D1Database): Promise<AuthUser | Response> {
  const user = await requireUser(request, db);
  if (user instanceof Response) return user;
  return user.role === 'admin' ? user : authError('Administrator access is required.', 403);
}

async function createSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = toBase64Url(randomBytes(32));
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const expiresAt = expires.toISOString();
  await db.prepare('DELETE FROM auth_sessions WHERE expires_at<=CURRENT_TIMESTAMP').run();
  await db.prepare('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(tokenHash, userId, expiresAt).run();
  return { token, expiresAt };
}

export function sessionCookie(token: string, maxAge = SESSION_DAYS * 86_400): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function destroyCurrentSession(request: Request, db: D1Database): Promise<void> {
  const token = cookieValue(request);
  if (!token) return;
  await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(token)).run();
}

export async function createUser(db: D1Database, input: {
  username: string;
  displayName: string;
  password: string;
  role: AuthRole;
}): Promise<{ user: AuthUser; recoveryCode: string }> {
  await ensureAuthSchema(db);
  const username = validateUsername(input.username);
  if (!username) throw new Error('Username must be 3–50 characters using letters, numbers, dots, dashes, or underscores.');
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error('Display name is required.');
  const passwordMessage = validatePassword(input.password);
  if (passwordMessage) throw new Error(passwordMessage);
  const duplicate = await db.prepare('SELECT id FROM auth_users WHERE username=? COLLATE NOCASE').bind(username).first();
  if (duplicate) throw new Error('That username is already in use.');
  const id = crypto.randomUUID();
  const salt = randomHex(16);
  const generatedRecoveryCode = recoveryCode();
  await db.prepare(`INSERT INTO auth_users
    (id,username,display_name,role,password_hash,password_salt,recovery_hash)
    VALUES (?,?,?,?,?,?,?)`).bind(
      id,
      username,
      displayName,
      input.role,
      await passwordHash(input.password, salt),
      salt,
      await sha256(normalizeRecoveryCode(generatedRecoveryCode)),
    ).run();
  return { user: { id, username, displayName, role: input.role }, recoveryCode: generatedRecoveryCode };
}

export async function createFirstAdmin(db: D1Database, input: { username: string; displayName: string; password: string }): Promise<{ user: AuthUser; recoveryCode: string; token: string }> {
  if (await authInitialized(db)) throw new Error('Camp Ledger has already been secured.');
  const created = await createUser(db, { ...input, role: 'admin' });
  const session = await createSession(db, created.user.id);
  return { ...created, token: session.token };
}

export async function login(db: D1Database, usernameInput: string, password: string): Promise<{ user: AuthUser; token: string }> {
  await ensureAuthSchema(db);
  const username = normalizeUsername(usernameInput);
  const row = await db.prepare(`SELECT id,username,display_name,role,password_hash,password_salt,recovery_hash,failed_attempts,locked_until
    FROM auth_users WHERE username=? COLLATE NOCASE`).bind(username).first<AuthUserRow>();
  if (!row) throw new Error('Username or password is incorrect.');
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) throw new Error('Too many attempts. Try again in about 15 minutes.');
  const verified = timingSafeEqual(await passwordHash(password, String(row.password_salt)), String(row.password_hash));
  if (!verified) {
    const attempts = Number(row.failed_attempts ?? 0) + 1;
    if (attempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
      await db.prepare('UPDATE auth_users SET failed_attempts=0,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(lockedUntil, row.id).run();
      throw new Error('Too many attempts. Try again in about 15 minutes.');
    }
    await db.prepare('UPDATE auth_users SET failed_attempts=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(attempts, row.id).run();
    throw new Error('Username or password is incorrect.');
  }
  await db.prepare('UPDATE auth_users SET failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(row.id).run();
  const session = await createSession(db, String(row.id));
  return { user: userFromRow(row), token: session.token };
}

async function replaceCredentials(db: D1Database, row: AuthUserRow, newPassword: string): Promise<{ user: AuthUser; recoveryCode: string; token: string }> {
  const passwordMessage = validatePassword(newPassword);
  if (passwordMessage) throw new Error(passwordMessage);
  const salt = randomHex(16);
  const generatedRecoveryCode = recoveryCode();
  await db.batch([
    db.prepare(`UPDATE auth_users SET password_hash=?,password_salt=?,recovery_hash=?,failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(await passwordHash(newPassword, salt), salt, await sha256(normalizeRecoveryCode(generatedRecoveryCode)), row.id),
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(row.id),
  ]);
  const session = await createSession(db, String(row.id));
  return { user: userFromRow(row), recoveryCode: generatedRecoveryCode, token: session.token };
}

export async function resetPassword(db: D1Database, input: { username: string; newPassword: string; recoveryCode?: string; masterKey?: string; masterKeyHash?: string }): Promise<{ user: AuthUser; recoveryCode: string; token: string }> {
  await ensureAuthSchema(db);
  const row = await db.prepare(`SELECT id,username,display_name,role,password_hash,password_salt,recovery_hash,failed_attempts,locked_until
    FROM auth_users WHERE username=? COLLATE NOCASE`).bind(normalizeUsername(input.username)).first<AuthUserRow>();
  if (!row) throw new Error('Account not found.');
  let verified = false;
  if (input.recoveryCode) verified = timingSafeEqual(await sha256(normalizeRecoveryCode(input.recoveryCode)), String(row.recovery_hash));
  if (!verified && input.masterKey && input.masterKeyHash) verified = timingSafeEqual(await sha256(input.masterKey.trim()), input.masterKeyHash.trim().toLowerCase());
  if (!verified) throw new Error('The recovery code or emergency master key is not valid.');
  return replaceCredentials(db, row, input.newPassword);
}

export async function changePassword(db: D1Database, user: AuthUser, currentPassword: string, newPassword: string): Promise<{ token: string }> {
  const row = await db.prepare(`SELECT id,username,display_name,role,password_hash,password_salt,recovery_hash,failed_attempts,locked_until FROM auth_users WHERE id=?`).bind(user.id).first<AuthUserRow>();
  if (!row) throw new Error('Account not found.');
  const verified = timingSafeEqual(await passwordHash(currentPassword, String(row.password_salt)), String(row.password_hash));
  if (!verified) throw new Error('Current password is incorrect.');
  const passwordMessage = validatePassword(newPassword);
  if (passwordMessage) throw new Error(passwordMessage);
  const salt = randomHex(16);
  await db.batch([
    db.prepare('UPDATE auth_users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(await passwordHash(newPassword, salt), salt, user.id),
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id),
  ]);
  return createSession(db, user.id);
}

export async function rotateRecoveryCode(db: D1Database, userId: string): Promise<string> {
  const generated = recoveryCode();
  await db.prepare('UPDATE auth_users SET recovery_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(await sha256(normalizeRecoveryCode(generated)), userId).run();
  return generated;
}

export async function listUsers(db: D1Database): Promise<AuthUser[]> {
  await ensureAuthSchema(db);
  const rows = await db.prepare('SELECT id,username,display_name,role FROM auth_users ORDER BY created_at').all();
  return (rows.results as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    role: row.role === 'admin' ? 'admin' : 'member',
  }));
}
