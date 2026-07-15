import { authError, requireUser, rotateRecoveryCode, type AuthEnv } from '../../_lib/auth';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const user = await requireUser(request, env.DB);
  if (user instanceof Response) return user;
  try {
    const recoveryCode = await rotateRecoveryCode(env.DB, user.id);
    return Response.json({ recoveryCode });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to create a new recovery code.', 500);
  }
};
