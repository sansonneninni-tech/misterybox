// Preferenze minute (fondo, risoluzione, mappature): se il browser non
// concede localStorage si va avanti senza ricordarle.
export const pref = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
