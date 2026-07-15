import { clearSessionCookie, destroyCurrentSession, type AuthEnv } from '../../_lib/auth';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (env.DB) await destroyCurrentSession(request, env.DB).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
