import { authError, createUser, listUsers, requireAdmin, type AuthEnv } from '../../_lib/auth';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const admin = await requireAdmin(request, env.DB);
  if (admin instanceof Response) return admin;
  try {
    return Response.json({ users: await listUsers(env.DB) });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to load accounts.', 500);
  }
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const admin = await requireAdmin(request, env.DB);
  if (admin instanceof Response) return admin;
  try {
    const body = await request.json<{ username?: string; displayName?: string; password?: string; role?: string }>();
    const created = await createUser(env.DB, {
      username: String(body.username ?? ''),
      displayName: String(body.displayName ?? ''),
      password: String(body.password ?? ''),
      role: body.role === 'admin' ? 'admin' : 'member',
    });
    return Response.json(created, { status: 201 });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to create the account.', 400);
  }
};
