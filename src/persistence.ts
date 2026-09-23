interface PlanStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  readonly length?: number;
  key?(index: number): string | null;
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
  const prefix = `${key}-recovery-`;
  let backupSaved = false;
  if (hasBackup(storage, prefix, raw)) {
    // Reopening the same broken autosave must not pile up identical backups.
    backupSaved = true;
  } else {
    try {
      storage.setItem(`${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, raw);
      backupSaved = true;
    } catch {
      // The caller must not overwrite the original when the backup cannot be saved.
    }
  }
  let plan: T | null = null;
  try {
    plan = normalize(JSON.parse(raw), true);
  } catch {
    // Malformed JSON can still be downloaded from the recovery notice.
  }
  return { plan, recovery: { raw, backupSaved } };
}

function hasBackup(storage: PlanStorage, prefix: string, raw: string): boolean {
  if (typeof storage.key !== "function" || typeof storage.length !== "number") return false;
  for (let index = 0; index < storage.length; index += 1) {
    const name = storage.key(index);
    if (name?.startsWith(prefix) && storage.getItem(name) === raw) return true;
  }
  return false;
}
