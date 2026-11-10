// Il corpo della materia: Scolpire con le dita e Macro, per qualunque materia.
//
// Il Renderer lo chiama in tre punti: prima della base (avanza il campo
// scolpito, calcola il rilievo e la camera), dentro ogni passaggio (gli
// uniform della camera e del campo) e dopo la catena (impronta,
// microdettaglio, messa a fuoco). Spento, non aggiunge nulla: stessi
// fotogrammi di prima, bit per bit.

import { ASPECTS } from '../clip.js';
import { byId } from '../processes.js';
import { VERT, PRELUDE } from '../glsl.js';
import { FIELD_FRAG, RELIEF_FRAG, BASE_CORPO, IMPRONTA, MICRO, FUOCO, MAXSEG } from './glsl.js';
import { PASSI, passoDi, tratti, firma } from './gesti.js';
import { carattere, conMemoria, MICRO_INDEX } from './tatto.js';
import { macroCamera } from './macro.js';

const FIELD_LONG = 512;   // il campo ha la stessa misura in anteprima e in 4K
const RELIEF_LONG = 320;

const sizeFor = (aspect, long) => {
  const [a, b] = ASPECTS[aspect] || ASPECTS['16:9'];
  return a >= b ? { w: long, h: Math.max(2, Math.round(long * b / a)) } : { w: Math.max(2, Math.round(long * a / b)), h: long };
};

export const hasGesti = (clip) => !!clip?.scolpire?.gesti?.length;

// ----------------------------------------------------------------- campo
class Campo {
  constructor(r) {
    this.r = r;
    this.gl = r.gl;
    this.prog = r._program(VERT, FIELD_FRAG);
    this.t = null;
    this.snaps = new Map();
    this.J = -1;
    this.sig = null;
    this.segs = [];
    this.hint = null;
    this.key = '';
  }

  _ensure(aspect) {
    const { w, h } = sizeFor(aspect, FIELD_LONG);
    const key = `${w}x${h}`;
    if (this.key === key) return;
    this.free();
    this.key = key; this.w = w; this.h = h;
    this.t = [this.r._target(this.r._tex(w, h, true)), this.r._target(this.r._tex(w, h, true))];
    this.J = -1;
  }

  free() {
    if (this.t) this.t.forEach((x) => this.r._freeTarget(x));
    for (const s of this.snaps.values()) this.r._freeTarget(s);
    this.snaps.clear();
    this.t = null; this.key = ''; this.J = -1;
  }

  reset() { this.J = -1; }

  get tex() { return this.t ? this.t[1].tex : null; }

  _clear(target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  }

  _blit(from, to) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.fbo);
    gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /** Un disegno del passo: legge t[1], scrive t[0], poi si scambiano. */
  _draw(list, relax, ch, seed) {
    const gl = this.gl, P = this.prog, L = P.loc;
    gl.useProgram(P.p);
    this.r._bind(0, this.t[1].tex);
    gl.uniform1i(L.u_prev, 0);
    gl.uniform2f(L.u_res, this.w, this.h);
    gl.uniform1f(L.u_relax, relax ? 1 : 0);
    gl.uniform4f(L.u_char, ch.tenuta, ch.ritorno, ch.fluido, 1 / PASSI);
    gl.uniform1f(L.u_seed, seed % 97);
    gl.uniform1i(L.u_n, list.length);
    const A = new Float32Array(MAXSEG * 4), B = new Float32Array(MAXSEG * 4);
    list.forEach((s, i) => {
      A.set([s.ax, s.ay, s.bx, s.by], i * 4);
      B.set([s.r, s.k, s.tool, s.dur], i * 4);
    });
    gl.uniform4fv(L.u_a, A); gl.uniform4fv(L.u_b, B);
    this.r._draw(P, this.t[0], this.w, this.h);
    this.t.reverse();
  }

  _step(j, ch, seed, from) {
    // tratti di questo passo, a gruppi
    const list = [];
    while (from.i < this.segs.length && this.segs[from.i].j < j) from.i++;
    while (from.i < this.segs.length && this.segs[from.i].j === j) list.push(this.segs[from.i++]);
    if (j === 0) {
      this._clear(this.t[1]);
      for (let k = 0; k < list.length; k += MAXSEG) this._draw(list.slice(k, k + MAXSEG), false, ch, seed);
    } else {
      this._draw(list.slice(0, MAXSEG), true, ch, seed);
      for (let k = MAXSEG; k < list.length; k += MAXSEG) this._draw(list.slice(k, k + MAXSEG), false, ch, seed);
    }
    this.J = j;
    if (j % PASSI === 0) this._snap(j);
  }

  _snap(j) {
    let s = this.snaps.get(j);
    if (!s) { s = this.r._target(this.r._tex(this.w, this.h, true)); this.snaps.set(j, s); }
    this._blit(this.t[1], s);
  }

  _dropFrom(j) {
    for (const [k, s] of this.snaps) if (k >= j) { this.r._freeTarget(s); this.snaps.delete(k); }
  }

  _restore(maxJ) {
    let best = -1;
    for (const k of this.snaps.keys()) if (k <= maxJ && k > best) best = k;
    if (best >= 0) { this._blit(this.snaps.get(best), this.t[1]); this.J = best; }
    else this.J = -1;
  }

  /** Porta il campo al tempo t della clip. */
  advance(clip, t) {
    const sc = clip.scolpire;
    this._ensure(clip.format.aspect);
    const ch = conMemoria(carattere(clip, byId), sc.memoria);
    const sig = firma(sc, `|${ch.tenuta}|${ch.ritorno}|${ch.fluido}|${clip.format.aspect}|${clip.seed}`);
    if (sig !== this.sig) {
      // un avviso vale solo per il cambiamento appena fatto
      const hint = this.hint && performance.now() - this.hint.at < 1500 ? this.hint : null;
      this.hint = null;
      this.segs = tratti(sc);
      if (this.sig !== null && hint && (hint.mode === 'append' || hint.mode === 'stamped')) {
        // il gesto continua dopo il punto a cui il campo è arrivato: niente da rifare
        this._dropFrom(passoDi(hint.from));
      } else if (hint && hint.mode === 'edit') {
        // cambiato qualcosa da quell'istante in poi: si riparte da prima
        const jf = passoDi(hint.from);
        this._dropFrom(jf);
        if (this.J >= jf) this._restore(jf - 1);
      } else {
        this._dropFrom(0);
        this.J = -1;
      }
      this.sig = sig;
    }
    const target = passoDi(t);
    // indietro: dal fotogramma salvato più vicino, o da zero
    if (target < this.J) this._restore(target);
    if (this.J < target) {
      const from = { i: 0 };
      const seed = clip.seed || 1;
      for (let j = this.J + 1; j <= target; j++) this._step(j, ch, seed, from);
    }
    return ch;
  }

  /** Impronta immediata mentre il quadro è fermo: senza aspettare il passo. */
  stampNow(clip, segs) {
    if (!this.t || this.J < 0) return;
    const ch = conMemoria(carattere(clip, byId), clip.scolpire.memoria);
    for (let k = 0; k < segs.length; k += MAXSEG) this._draw(segs.slice(k, k + MAXSEG), false, ch, clip.seed || 1);
  }

  /** Legge il campo (per le verifiche): Float32Array RGBA. */
  read() {
    const gl = this.gl;
    const out = new Float32Array(this.w * this.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.t[1].fbo);
    gl.readPixels(0, 0, this.w, this.h, gl.RGBA, gl.FLOAT, out);
    return out;
  }
}

// ------------------------------------------------------------------ corpo
export class Corpo {
  constructor(r) {
    this.r = r;
    this.gl = r.gl;
    this.campo = null;
    this.relief = null;
    this.on = false;      // qualcosa da fare in questo fotogramma
    this.cam = null;      // stato della camera (o null)
    this.sculpt = false;
    this.ch = null;
    this.progs = {};
    this.mostraTutto = false;
  }

  _prog(name, src) {
    if (!this.progs[name]) {
      try { this.progs[name] = this.r._program(VERT, src); }
      catch (e) { console.error('Corpo', name, e); this.r.errors.set('corpo:' + name, String(e.message || e)); this.progs[name] = null; }
    }
    return this.progs[name];
  }

  reset() { if (this.campo) this.campo.reset(); }

  free() {
    if (this.campo) this.campo.free();
    if (this.relief) this.r._freeTarget(this.relief.t);
    this.relief = null;
  }

  /** Avvisa che i gesti sono cambiati: 'append' (si registra in avanti), 'stamped', 'edit'. */
  hint(mode, from) { if (this.campo) this.campo.hint = { mode, from, at: performance.now() }; }

  /** Prima della base: campo, camera, rilievo. Restituisce true se il corpo lavora. */
  pre(clip, t) {
    this.sculpt = hasGesti(clip) && this.r.float;
    const aspect = this.r.w / this.r.h;
    // «scegli il punto»: per un momento si vede tutto il quadro
    this.cam = this.mostraTutto ? null : macroCamera(clip, t, aspect);
    this.on = this.sculpt || !!this.cam;
    if (!this.on) return false;
    if (this.sculpt) {
      if (!this.campo) this.campo = new Campo(this.r);
      this.ch = this.campo.advance(clip, t);
    } else this.ch = null;
    this._relief(clip);
    return true;
  }

  _relief(clip) {
    const gl = this.gl, r = this.r;
    const { w, h } = sizeFor(clip.format.aspect, RELIEF_LONG);
    if (!this.relief || this.relief.w !== w || this.relief.h !== h) {
      if (this.relief) r._freeTarget(this.relief.t);
      this.relief = { w, h, t: r._target(r._tex(w, h)) };
    }
    const P = this._prog('relief', RELIEF_FRAG);
    if (!P) return;
    const s0 = r.sources[0];
    gl.useProgram(P.p);
    r._bind(0, s0?.uploaded ? s0.tex : r._empty); gl.uniform1i(P.loc.u_tex, 0);
    gl.uniform1f(P.loc.u_r, s0 ? (s0.w / s0.h) / (r.w / r.h) : 1);
    gl.uniform1f(P.loc.u_has, s0?.uploaded ? 1 : 0);
    r._bind(9, this.sculpt ? this.campo.tex : r._empty); gl.uniform1i(P.loc.u_sc, 9);
    gl.uniform1f(P.loc.u_scOn, this.sculpt ? 1 : 0);
    gl.uniform1f(P.loc.u_scK, clip.scolpire?.rilievo ?? 1);
    gl.uniform2f(P.loc.u_res, w, h);
    r._draw(P, this.relief.t, w, h);
  }

  /** Ingrandimento con cui i passaggi vedono il mondo. */
  get zoom() { return this.on && this.cam ? this.cam.z : 1; }

  /** Uniform comuni a tutti i passaggi: camera e campo. */
  bind(L) {
    const gl = this.gl, r = this.r;
    if (!L.u_camP) return;
    const c = this.on ? this.cam : null;
    if (c) { gl.uniform4f(L.u_cam, c.cam[0], c.cam[1], c.cam[2], c.cam[3]); gl.uniform4f(L.u_camP, c.camP[0], c.camP[1], c.camP[2], 1); }
    else { gl.uniform4f(L.u_cam, 0.5, 0.5, 1, 0); gl.uniform4f(L.u_camP, 0, 0, 0, 0); }
    r._bind(8, this.on && this.relief ? this.relief.t.tex : r._empty); if (L.u_rl) gl.uniform1i(L.u_rl, 8);
    r._bind(9, this.on && this.sculpt ? this.campo.tex : r._empty); if (L.u_sc) gl.uniform1i(L.u_sc, 9);
    gl.uniform1f(L.u_scOn, this.on && this.sculpt ? 1 : 0);
  }

  /** La base vista dalla camera e spinta dalle dita. */
  base(target) {
    const gl = this.gl, r = this.r;
    const P = this._prog('base', PRELUDE + BASE_CORPO);
    if (!P) return false;
    const s0 = r.sources[0];
    gl.useProgram(P.p);
    this._stageUniforms(P.loc, null);
    r._bind(0, s0?.uploaded ? s0.tex : r._empty); gl.uniform1i(P.loc.u_tex, 0);
    gl.uniform1f(P.loc.u_r, s0 ? (s0.w / s0.h) / (r.w / r.h) : 1);
    gl.uniform1f(P.loc.u_has, s0?.uploaded ? 1 : 0);
    r._draw(P, target, r.w, r.h);
    return true;
  }

  _stageUniforms(L, input) {
    const gl = this.gl, r = this.r;
    // ogni campionatore su un'unità sua: tipi diversi sulla stessa unità bloccano il disegno
    for (let i = 2; i <= 7; i++) r._bind(i, r._empty);
    r._bind(6, r._emptyArr, 'TEXTURE_2D_ARRAY');
    r._bind(10, r._empty);
    const set = (n, u) => { if (L[n]) gl.uniform1i(L[n], u); };
    set('u_s0', 2); set('u_s1', 3); set('u_s2', 4); set('u_s3', 5); set('u_hist', 6); set('u_st', 7); set('u_fb', 10);
    if (input) { r._bind(1, input.tex); set('u_in', 1); } else { r._bind(1, r._empty); set('u_in', 1); }
    gl.uniform2f(L.u_res, r.w, r.h);
    gl.uniform1f(L.u_seed, this._seed || 1);
    gl.uniform1f(L.u_t, this._t || 0);
    this.bind(L);
  }

  /** Dopo la catena: impronta, microdettaglio e messa a fuoco. */
  post(stream, clip, t) {
    if (!this.on) return stream;
    const r = this.r, gl = this.gl;
    this._seed = clip.seed || 1; this._t = t;
    const free = (not) => (r.scratch[0] === not ? r.scratch[1] : r.scratch[0]);
    if (this.sculpt) {
      const P = this._prog('impronta', PRELUDE + IMPRONTA);
      if (P) {
        const out = free(stream);
        gl.useProgram(P.p);
        this._stageUniforms(P.loc, stream);
        const sc = clip.scolpire;
        gl.uniform4f(P.loc.u_imp, sc.rilievo ?? 1, ((sc.luce ?? 315) * Math.PI) / 180, this.ch?.fluido ?? 0, 0);
        r._draw(P, out, r.w, r.h);
        stream = out;
      }
    }
    const c = this.cam;
    if (c) {
      const Pm = this._prog('micro', PRELUDE + MICRO);
      const Pf = this._prog('fuoco', PRELUDE + FUOCO);
      if (Pm && Pf) {
        const ch = this.ch || carattere(clip, byId);
        const tipo = clip.macro.micro && clip.macro.micro !== 'auto' ? clip.macro.micro : ch.micro;
        const luce = ((clip.scolpire?.luce ?? 315) * Math.PI) / 180;
        let out = free(stream);
        gl.useProgram(Pm.p);
        this._stageUniforms(Pm.loc, stream);
        gl.uniform4f(Pm.loc.u_mic, c.micro, MICRO_INDEX[tipo] || 1, c.z, luce);
        gl.uniform4f(Pm.loc.u_dof, c.focus, c.coc, c.incl, Math.max(0.05, c.ril));
        gl.uniform2f(Pm.loc.u_dofDir, c.dir[0], c.dir[1]);
        r._draw(Pm, out, r.w, r.h);
        stream = out;
        out = free(stream);
        gl.useProgram(Pf.p);
        this._stageUniforms(Pf.loc, stream);
        gl.uniform1f(Pf.loc.u_cocMax, c.coc);
        r._draw(Pf, out, r.w, r.h);
        stream = out;
      }
    }
    return stream;
  }
}
