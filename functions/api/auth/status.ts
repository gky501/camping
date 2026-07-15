import { authError, authInitialized, currentUser, type AuthEnv } from '../../_lib/auth';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  try {
    const [initialized, user] = await Promise.all([authInitialized(env.DB), currentUser(request, env.DB)]);
    return Response.json({ initialized, authenticated: Boolean(user), user });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to check sign-in status.', 500);
  }
};
