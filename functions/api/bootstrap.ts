import { error, json, loadBootstrap, type Env } from '../_lib/diary';
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) return error('D1 binding DB is not configured.', 503);
  try { return json(await loadBootstrap(env.DB)); } catch (cause) { return error(cause instanceof Error ? cause.message : 'Unexpected error', 500); }
};
