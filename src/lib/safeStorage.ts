/**
 * localStorage writes that fail closed instead of throwing. In private mode or
 * on quota-exceeded, `setItem`/`removeItem` throw; left unguarded those bubble
 * to the top-level ErrorBoundary, whose only recovery is `localStorage.clear()`
 * — i.e. it destroys the user's saved work. These helpers degrade to "not
 * persisted" and warn once, so a failed save is a lost edit, never lost data.
 */

let warned = false;

function warnOnce(action: string, error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`Alchemist could not ${action} to localStorage; changes this session may not persist.`, error);
}

/** Returns true if the value was stored, false if storage was unavailable. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    warnOnce("save", error);
    return false;
  }
}

/** Returns true if the key was removed (or already absent), false on failure. */
export function safeRemoveItem(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    warnOnce("update", error);
    return false;
  }
}
