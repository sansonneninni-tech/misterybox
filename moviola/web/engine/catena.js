// Aiuti comuni a Respiro, Tempo geologico e Gravità e vento: le tre funzioni
// che agiscono su tutta la catena di materie insieme.
//
// Le impostazioni «per materia» non usano l'id del passaggio (cambia ogni
// volta che il passo 2 ricostruisce la catena) ma il processo, più un numero
// se lo stesso processo compare due volte: così sopravvivono a un cambio di
// stile, all'aggiunta di una materia, a un riordino.

/** Chiave stabile di un passaggio: "miele", "campo", "campo#2"… */
export function passKey(clip, pass) {
  let n = 0;
  for (const p of clip.chain || []) {
    if (p === pass || p.id === pass.id) break;
    if (p.proc === pass.proc) n++;
  }
  return n ? `${pass.proc}#${n + 1}` : pass.proc;
}

/** Posizione del passaggio tra quelli accesi (per l'onda del respiro). */
export function passOrder(clip, pass) {
  let i = 0;
  for (const p of clip.chain || []) {
    if (p === pass || p.id === pass.id) return i;
    if (p.on) i++;
  }
  return i;
}

const smooth = (x) => x * x * (3 - 2 * x);

/** Valore di una traccia di chiavi [[t, v], …] al tempo t (come la timeline). */
export function trackValue(track, t, base) {
  if (!track || !track.length) return base;
  if (t <= track[0][0]) return track[0][1];
  const last = track[track.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, v0] = track[i], [t1, v1] = track[i + 1];
    if (t >= t0 && t <= t1) return v0 + (v1 - v0) * smooth(t1 > t0 ? (t - t0) / (t1 - t0) : 0);
  }
  return last[1];
}

/** Numero pseudocasuale in [0, 1) da un intero e un seme: sempre lo stesso. */
export function hash(n, seed = 0) {
  const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453;
  return x - Math.floor(x);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
