import { authError, requireUser, saveThemePreference, type AuthEnv, type AuthTheme } from '../../_lib/auth';

export const onRequestPatch: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.DB) return authError('D1 binding DB is not configured.', 503);
  const user = await requireUser(request, env.DB);
  if (user instanceof Response) return user;
  try {
    const body = await request.json<{ theme?: AuthTheme }>();
    const theme = body.theme === 'dark' ? 'dark' : body.theme === 'light' ? 'light' : undefined;
    if (!theme) return authError('Choose light or dark mode.', 400);
    return Response.json({ user: await saveThemePreference(env.DB, user, theme) });
  } catch (cause) {
    return authError(cause instanceof Error ? cause.message : 'Unable to save appearance preference.', 400);
  }
};
