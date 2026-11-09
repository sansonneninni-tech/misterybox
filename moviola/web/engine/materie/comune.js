// Aiuti comuni alle materie: la stessa forma dei parametri dei processi.
export const P = (id, label, min, max, def, mod = 0.5, extra = {}) => ({ id, label, min, max, def, mod, ...extra });
