import { importBackup } from '../../_lib/importData';
import type { Env } from '../../_lib/diary';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    return await importBackup(env, await request.json<unknown>());
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : 'Unable to import the backup.' },
      { status: 500 },
    );
  }
};
