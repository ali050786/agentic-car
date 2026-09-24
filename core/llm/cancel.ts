/** A stopped job (user cancel, or the pipeline already decided): never retried or swallowed. */
export const isCancel = (err: unknown): boolean => /cancel/i.test(String((err as any)?.message || err || ''));
