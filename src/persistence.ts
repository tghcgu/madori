interface PlanStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Recovery {
  raw: string;
  backupSaved: boolean;
}

export function readStoredPlan<T>(storage: PlanStorage, key: string, normalize: (data: unknown, recover?: boolean) => T | null): { plan: T | null; recovery: Recovery | null } {
  const raw = storage.getItem(key);
  if (raw === null) return { plan: null, recovery: null };
  try {
    const plan = normalize(JSON.parse(raw));
    if (plan) return { plan, recovery: null };
  } catch {
    // Keep the original bytes even if only one entity is unreadable.
  }
  let backupSaved = false;
  try {
    storage.setItem(`${key}-recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, raw);
    backupSaved = true;
  } catch {
    // The caller must not overwrite the original when the backup cannot be saved.
  }
  let plan: T | null = null;
  try {
    plan = normalize(JSON.parse(raw), true);
  } catch {
    // Malformed JSON can still be downloaded from the recovery notice.
  }
  return { plan, recovery: { raw, backupSaved } };
}
