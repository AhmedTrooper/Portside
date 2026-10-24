/** Migrate a unique old preference key without discarding the user's saved value. */
export function readPreference(storage: Storage, key: string, legacySuffix: string): string | null {
  const current = storage.getItem(key);
  if (current !== null) return current;
  const candidates: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const existing = storage.key(index);
    if (existing && existing !== key && existing.endsWith(legacySuffix)) candidates.push(existing);
  }
  if (candidates.length !== 1) return null;
  const value = storage.getItem(candidates[0]);
  if (value !== null) {
    storage.setItem(key, value);
    storage.removeItem(candidates[0]);
  }
  return value;
}
