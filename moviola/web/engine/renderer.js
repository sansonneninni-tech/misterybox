// Il motore: esegue la catena di processi su WebGL2, un fotogramma alla volta.
// Buffer a 16 bit in virgola mobile quando il browser lo consente, così i
// gradienti arrivano al ProRes senza bande.

import { VERT, PRELUDE, POSTLUDE, COPY_FRAG, BASE_FRAG } from './glsl.js';
import { byId, fragmentFor, simFragmentFor, BLENDS } from './processes.js';
import { passValues } from './motion.js';
import { updateTerritori, bindTerritorio, pruneTerritori, destroyTerritori } from './territorio.js';
import { Corpo } from './corpo/index.js';
import { tempoOf, ageFactor, materialTime, materialDuration, stepsBefore } from './tempo.js';
import { forzeOf, forceUse, forceValue, gravityAt, packLocals, FORZE_FRAG, FIELD_LONG, SCALA, MAX_LOCALI, MAX_SEGMENTI } from './forze.js';
import { breathUniform } from './respiro.js';

const BLEND_INDEX = Object.fromEntries(BLENDS.map((b, i) => [b.id, i]));

export class Renderer {
  constructor(canvas, { histLong = 1280, simFull = false } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 non disponibile in questo browser');
    this.gl = gl;
    this.histLong = histLong;
    // simFull: lo stato delle simulazioni resta alla sua misura piena anche se
    // l'uscita è piccola (provini della Deriva): la materia cresce come nel 4K
    this.simFull = simFull;
    this.float = this._probeFloat();
    // le simulazioni hanno bisogno di valori fini anche se l'uscita è a 8 bit
    this.simFloat = this.float;
    this.programs = new Map();
    this.errors = new Map();
    this.passState = new Map(); // id pass -> { fb: [tex, tex], fbo, hist }
    this.sources = [];          // [{ tex, aspect, el, kind }]
    this.w = 0; this.h = 0;
    this.frame = 0;
    // Tempo geologico: tetto di lavoro dell'anteprima (milioni di pixel per
    // fotogramma) ed «esatto» per il render, che fa sempre tutti i passi
    this.budget = 90;
    this.exact = false;
    this.stats = null;
    this._initQuad();
    this.copyProg = this._program(VERT, COPY_FRAG);
    this.baseProg = this._program(VERT, BASE_FRAG);
    this._empty = this._tex(1, 1, false);
    this._emptyArr = this._texArray(1, 1, 1);
    this.corpo = new Corpo(this); // Scolpire con le dita e Macro
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
  }

  _probeFloat() {
    const gl = this.gl;
    if (!gl.getExtension('EXT_color_buffer_float')) return false;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(f); gl.deleteTexture(t);
    return ok;
  }

  _initQuad() {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  _program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(log);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, loc };
  }

  simProgram(id) {
    const key = id + '#sim';
    if (this.programs.has(key)) return this.programs.get(key);
    try {
      const prog = this._program(VERT, simFragmentFor(byId[id], PRELUDE));
      this.programs.set(key, prog);
      return prog;
    } catch (e) {
      this.errors.set(id, String(e.message || e));
      console.error('Simulazione', id, e);
      this.programs.set(key, null);
      return null;
    }
  }

  procProgram(id) {
    if (this.programs.has(id)) return this.programs.get(id);
    const proc = byId[id];
    if (!proc) return null;
    try {
      const prog = this._program(VERT, fragmentFor(proc, PRELUDE, POSTLUDE));
      this.programs.set(id, prog);
      return prog;
    } catch (e) {
      this.errors.set(id, String(e.message || e));
      console.error('Processo', id, e);
      this.programs.set(id, null);
      return null;
    }
  }

  _tex(w, h, float = this.float, f32 = false) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (float && f32) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    else if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // a 32 bit il filtro lineare non è garantito (e senza, la texture sarebbe incompleta)
    const filt = float && f32 ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  _texArray(w, h, layers) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, w, h, layers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  _fbo(tex) {
    const gl = this.gl;
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }

  _target(tex) { return { tex, fbo: this._fbo(tex) }; }

  _freeTarget(t) { if (!t) return; this.gl.deleteFramebuffer(t.fbo); this.gl.deleteTexture(t.tex); }

  /** Dimensioni di lavoro (interne) e del canvas. */
  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this._freeAll();
    this.scratch = [this._target(this._tex(w, h)), this._target(this._tex(w, h))];
    this.base = this._target(this._tex(w, h));
    this.reset();
  }

  _freeAll() {
    (this.scratch || []).forEach((t) => this._freeTarget(t));
    this._freeTarget(this.base);
    if (this.field) { this._freeTarget(this.field); this.field = null; }
    for (const st of this.passState.values()) this._freePass(st);
    this.passState.clear();
    this.corpo.free();
  }

  _freePass(st) {
    const gl = this.gl;
    if (st.fb) st.fb.forEach((t) => this._freeTarget(t));
    if (st.hist) { gl.deleteTexture(st.hist.tex); gl.deleteFramebuffer(st.hist.fbo); }
    if (st.sim) st.sim.t.forEach((t) => this._freeTarget(t));
  }

  /** Azzera retroazioni e memoria: il prossimo fotogramma riparte da zero. */
  reset() {
    const gl = this.gl;
    this.frame = 0;
    for (const st of this.passState.values()) {
      if (st.fb) st.fb.forEach((t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); });
      if (st.hist) { st.hist.n = 0; st.hist.head = 0; }
      if (st.sim) st.sim.init = true;
      st.fbDone = undefined; st.fbFresh = undefined;
    }
    this.corpo.reset();
  }

  _ensurePass(pass, proc) {
    let st = this.passState.get(pass.id);
    const histCap = proc.history ? Math.min(33, proc.history + 1) : 0;
    if (st && st.proc === proc.id && st.histCap === histCap) return st;
    if (st) this._freePass(st);
    st = { proc: proc.id, histCap };
    if (proc.feedback) {
      st.fb = [this._target(this._tex(this.w, this.h)), this._target(this._tex(this.w, this.h))];
      const gl = this.gl;
      st.fb.forEach((t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); });
    }
    if (histCap) {
      const s = Math.min(1, this.histLong / Math.max(this.w, this.h));
      const hw = Math.max(2, Math.round(this.w * s)), hh = Math.max(2, Math.round(this.h * s));
      const tex = this._texArray(hw, hh, histCap);
      st.hist = { tex, fbo: this.gl.createFramebuffer(), w: hw, h: hh, cap: histCap, n: 0, head: 0 };
    }
    if (proc.sim) {
      // lo stato ha la stessa misura in anteprima e nel render 4K: la materia
      // cresce allo stesso modo, il 4K aggiunge solo nitidezza al disegno
      const s = Math.min(this.simFull ? 16 : 1, (proc.simLong || 1024) / Math.max(this.w, this.h));
      const sw = Math.max(2, Math.round(this.w * s)), sh = Math.max(2, Math.round(this.h * s));
      // simF32: stato a 32 bit (posizioni, quote), letto con texelFetch
      const f32 = !!proc.simF32;
      st.sim = { t: [this._target(this._tex(sw, sh, this.simFloat, f32)), this._target(this._tex(sw, sh, this.simFloat, f32))], w: sw, h: sh, init: true };
    }
    this.passState.set(pass.id, st);
    return st;
  }

  /** Elimina lo stato dei passaggi che non esistono più nella catena. */
  prune(chain) {
    const ids = new Set(chain.map((p) => p.id));
    for (const [id, st] of this.passState) if (!ids.has(id)) { this._freePass(st); this.passState.delete(id); }
    pruneTerritori(this, chain);
  }

  // ------------------------------------------------------------- sorgenti
  /** items: [{ el (img|video|ImageBitmap|canvas), w, h, kind }] */
  setSources(items) {
    const gl = this.gl;
    this.sources.forEach((s) => gl.deleteTexture(s.tex));
    this.sources = items.slice(0, 4).map((it) => {
      const tex = this._tex(1, 1, false);
      const s = { tex, el: it.el, kind: it.kind, w: it.w || 1, h: it.h || 1, uploaded: false };
      this._upload(s);
      return s;
    });
  }

  _upload(s) {
    const gl = this.gl;
    if (!s.el) return;
    if (s.kind === 'video' && (s.el.readyState < 2)) return;
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, s.el);
      s.uploaded = true;
      if (s.kind === 'video') { s.w = s.el.videoWidth || s.w; s.h = s.el.videoHeight || s.h; }
    } catch (e) { console.warn('sorgente non caricata', e); }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  // --------------------------------------------------------------- render
  _draw(prog, target, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _bind(unit, tex, kind = 'TEXTURE_2D') {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl[kind], tex);
  }

  /**
   * Calcola un fotogramma. `t` in secondi, `frame` indice intero.
   * `live` sovrascrive valori di parametri (modalità dal vivo).
   */
  render(clip, t, frame, live, { display = true } = {}) {
    const gl = this.gl;
    if (this.lost) return;
    this.frame = frame;
    for (const s of this.sources) if (s.kind === 'video') this._upload(s);
    const outAsp = this.w / this.h;

    // corpo: campo scolpito, rilievo e camera macro (spento non fa nulla)
    const corpo = this.corpo.pre(clip, t);
    const zoom = this.corpo.zoom;

    // base: la prima sorgente adattata al quadro, oppure il nero
    const s0 = this.sources[0];
    if (!corpo || !this.corpo.base(this.base)) {
      const bp = this.baseProg;
      gl.useProgram(bp.p);
      this._bind(0, s0?.uploaded ? s0.tex : this._empty);
      gl.uniform1i(bp.loc.u_tex, 0);
      gl.uniform1f(bp.loc.u_r, s0 ? (s0.w / s0.h) / outAsp : 1);
      gl.uniform1f(bp.loc.u_has, s0?.uploaded ? 1 : 0);
      this._draw(bp, this.base, this.w, this.h);
    }
    let stream = this.base;

    const sAsp = [0, 1, 2, 3].map((i) => (this.sources[i] ? (this.sources[i].w / this.sources[i].h) / outAsp : 1));
    const ns = this.sources.filter((s) => s.uploaded).length;

    // dove sta ogni materia e come si muovono i confini (territorio.js)
    updateTerritori(this, clip, frame);

    // Tempo geologico e Gravità e vento: valgono per tutte le materie insieme
    const total = Math.max(1, Math.round(clip.format.duration * clip.format.fps));
    const fl = ((frame % total) + total) % total, lap = Math.floor(frame / total);
    const tempo = tempoOf(clip);
    const plan = tempo ? this._tempoPlan(clip, fl, lap) : null;
    if (!plan) this.stats = null;
    const forze = forzeOf(clip);
    const grav = forze ? gravityAt(forze, t) : null;
    const wind = forze ? this._forceField(clip, forze, t) : null;

    for (const pass of clip.chain) {
      if (!pass.on) continue;
      const proc = byId[pass.proc];
      if (!proc) continue;
      const prog = this.procProgram(pass.proc);
      if (!prog) continue;
      const st = this._ensurePass(pass, proc);

      // memoria: scrive il flusso attuale nello strato successivo
      if (st.hist) {
        const H = st.hist;
        H.head = (H.head + 1) % H.cap;
        gl.bindFramebuffer(gl.FRAMEBUFFER, H.fbo);
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, H.tex, 0, H.head);
        gl.viewport(0, 0, H.w, H.h);
        const cp = this.copyProg;
        gl.useProgram(cp.p);
        this._bind(0, stream.tex);
        gl.uniform1i(cp.loc.u_tex, 0);
        gl.uniform2f(cp.loc.u_scale, 1, 1);
        gl.uniform1f(cp.loc.u_flip, 0);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        H.n = Math.min(H.n + 1, H.cap);
      }

      let out;
      if (st.fb) out = st.fb[0];
      else out = this.scratch[0] === stream ? this.scratch[1] : this.scratch[0];

      const vals = passValues(clip, pass, t, live);
      const arr = new Float32Array(12); vals.forEach((v, i) => { arr[i] = v; });
      // il tempo della materia: con Tempo geologico il suo orologio corre
      // secondo la curva (e il suo fattore); la durata diventa la sua durata,
      // così il loop delle materie senza stato resta chiuso
      const tp = plan && proc.materia ? plan.get(pass.id) : null;
      const tMat = tp ? tp.k * materialTime(clip, t) : t;
      const TMat = tp ? tp.k * materialDuration(clip) : clip.format.duration;
      const fu = forze && proc.materia ? forceUse(clip, pass, proc) : null;
      const breath = proc.materia ? breathUniform(clip, pass, t) : 0;
      const common = (L, w, h, tt = tMat, ff = frame, z = zoom) => {
        this._bind(0, stream.tex); gl.uniform1i(L.u_in, 0);
        for (let i = 0; i < 4; i++) {
          const s = this.sources[i];
          this._bind(2 + i, s?.uploaded ? s.tex : this._empty);
          if (L['u_s' + i]) gl.uniform1i(L['u_s' + i], 2 + i);
        }
        gl.uniform4f(L.u_sAsp, sAsp[0], sAsp[1], sAsp[2], sAsp[3]);
        gl.uniform1i(L.u_ns, ns);
        gl.uniform1f(L.u_t, tt);
        gl.uniform1f(L.u_T, TMat);
        gl.uniform1f(L.u_loop, clip.format.loop ? 1 : 0);
        gl.uniform1f(L.u_frame, ff);
        gl.uniform1f(L.u_fps, clip.format.fps);
        gl.uniform1f(L.u_seed, clip.seed || 1);
        // con la Macro i passaggi vedono un mondo più grande della finestra
        gl.uniform2f(L.u_res, w * z, h * z);
        gl.uniform1fv(L.u_p, arr);
        this.corpo.bind(L);
        gl.uniform1f(L.u_respiro, breath);
        this._bind(13, wind ? this.field.tex : this._empty); gl.uniform1i(L.u_forze, 13); // 8 e 9 sono del corpo
        gl.uniform1f(L.u_forzeOn, fu ? 1 : 0);
        if (fu) {
          gl.uniform1f(L.u_presa, fu.presa);
          gl.uniform1f(L.u_peso, fu.peso);
          gl.uniform2f(L.u_g, grav.v[0], grav.v[1]);
          gl.uniform2f(L.u_giu, grav.dir[0], grav.dir[1]);
          gl.uniform1f(L.u_gforza, grav.g / 0.5);
          gl.uniform2f(L.u_wv, wind.v[0], wind.v[1]);
          gl.uniform1f(L.u_vf, wind.f / 0.5);
        }
        gl.uniform1f(L.u_trST, 0); gl.uniform1f(L.u_trFB, 0); gl.uniform1f(L.u_mappa, 0);
      };
      const moves = fu && (fu.modo === 'trasporto' || fu.modo === 'mappa');

      // simulazione: alcuni passi sullo stato, prima di disegnare
      if (st.sim) {
        const sp = this.simProgram(pass.proc);
        if (sp) {
          const S = st.sim;
          const base = proc.steps || 4;
          const step = (tt, ff, k) => {
            gl.useProgram(sp.p);
            common(sp.loc, S.w, S.h, tt, ff, 1);
            this._bind(7, S.t[1].tex); gl.uniform1i(sp.loc.u_st, 7);
            gl.uniform2f(sp.loc.u_stRes, S.w, S.h);
            gl.uniform1f(sp.loc.u_init, S.init ? 1 : 0);
            gl.uniform1f(sp.loc.u_step, k);
            if (moves) {
              gl.uniform1f(sp.loc.u_trST, 1 / (clip.format.fps * base));
              gl.uniform1f(sp.loc.u_mappa, fu.modo === 'mappa' ? 1 : 0);
            }
            this._bind(6, this._emptyArr, 'TEXTURE_2D_ARRAY'); if (sp.loc.u_hist) gl.uniform1i(sp.loc.u_hist, 6);
            this._bind(1, this._empty); if (sp.loc.u_fb) gl.uniform1i(sp.loc.u_fb, 1);
            this._draw(sp, S.t[0], S.w, S.h);
            S.t.reverse(); // t[1] è lo stato appena scritto
            S.init = false;
          };
          // a ogni giro della clip la materia riparte, come nel file salvato
          if (S.lap !== undefined && lap !== S.lap) S.init = true;
          S.lap = lap;
          if (tp) {
            // passi contati dal fotogramma 0: ogni passo ha il suo indice s, e
            // da lì il suo istante di materia. Gli stessi in anteprima e nel 4K.
            if (S.init) S.done = 0;
            const n = Math.max(S.init ? 1 : 0, tp.n);
            for (let j = 0; j < n; j++) {
              const s = S.done + j, vf = Math.floor(s / base);
              step(vf / clip.format.fps, vf, s - vf * base);
            }
            S.done = Math.max(S.done + n, tp.target);
          } else {
            // se l'anteprima salta fotogrammi, la materia recupera i passi persi
            const dF = S.last === undefined || S.init ? 1 : Math.min(3, Math.max(1, frame - S.last));
            const steps = Math.max(1, Math.round(base * dF));
            for (let k = 0; k < steps; k++) step(t, frame, k);
          }
          S.last = frame;
        }
      }

      const draw = (tt, ff) => {
        gl.useProgram(prog.p);
        const L = prog.loc;
        common(L, this.w, this.h, tt, ff);
        if (st.sim) { this._bind(7, st.sim.t[1].tex); gl.uniform1i(L.u_st, 7); gl.uniform2f(L.u_stRes, st.sim.w, st.sim.h); }
        else { this._bind(7, this._empty); gl.uniform1i(L.u_st, 7); gl.uniform2f(L.u_stRes, 1, 1); }
        this._bind(1, st.fb ? st.fb[1].tex : this._empty); gl.uniform1i(L.u_fb, 1);
        if (st.fb && moves) gl.uniform1f(L.u_trFB, 1 / clip.format.fps);
        this._bind(6, st.hist ? st.hist.tex : this._emptyArr, 'TEXTURE_2D_ARRAY');
        if (L.u_hist) gl.uniform1i(L.u_hist, 6);
        gl.uniform1f(L.u_histN, st.hist ? st.hist.n : 0);
        gl.uniform1f(L.u_histHead, st.hist ? st.hist.head : 0);
        gl.uniform1f(L.u_histCap, st.hist ? st.hist.cap : 1);
        gl.uniform1f(L.u_mix, pass.mix ?? 1);
        gl.uniform1i(L.u_blend, BLEND_INDEX[pass.blend] ?? 0);
        bindTerritorio(this, L, pass);
        this._draw(prog, out, this.w, this.h);
        if (st.fb) { st.fb.reverse(); out = st.fb[0]; } // ora fb[1] è l'uscita appena scritta
      };
      if (st.fb && tp) {
        // retroazione nel tempo della materia: tanti giri quanti fotogrammi di
        // materia sono passati; nessuno nei quasi arresti (resta com'era)
        if (st.fbDone === undefined) st.fbDone = tp.fbFrom;
        const n = Math.max(st.fbFresh === false ? 0 : 1, tp.fbN);
        for (let j = 0; j < n; j++) { const s = st.fbDone + j; draw(s / clip.format.fps, s); }
        st.fbDone = Math.max(st.fbDone + n, tp.fbTarget);
        st.fbFresh = false;
      } else draw(tMat, frame);
      stream = st.fb ? st.fb[1] : out;
    }

    stream = this.corpo.post(stream, clip, t);

    this.final = stream;
    if (display) this.present();
  }

  /**
   * Tempo geologico: quanti passi fa ogni materia in questo fotogramma.
   * Il conto è esatto (dal fotogramma 0); l'anteprima, se non è «esatta»,
   * tiene un tetto di lavoro per fotogramma e salta il resto, e lo segna in
   * `this.stats` perché l'interfaccia lo dica.
   */
  _tempoPlan(clip, fl, lap) {
    const plan = new Map();
    let want = 0;
    for (const pass of clip.chain) {
      const proc = byId[pass.proc];
      if (!pass.on || !proc?.materia) continue;
      const k = ageFactor(clip, pass);
      const e = { k, n: 0, target: 0, fbN: 0, fbFrom: 0, fbTarget: 0, cost: 0, want: 0 };
      if (proc.sim) {
        const base = proc.steps || 4;
        const st = this.passState.get(pass.id);
        const S = st?.sim;
        const fresh = !S || S.init || (S.lap !== undefined && S.lap !== lap);
        const done = fresh ? 0 : S.done ?? 0;
        e.target = stepsBefore(clip, fl + 1, base, k);
        let n = Math.max(0, e.target - done);
        // senza «anteprima esatta» si recuperano al massimo tre fotogrammi persi
        if (!this.exact) n = Math.min(n, 3 * Math.max(1, e.target - stepsBefore(clip, fl, base, k)));
        e.n = Math.min(n, 20000); // anche nel render: mai un fotogramma senza fine
        e.cost = (S ? S.w * S.h : 1024 * 576) / 1e6;
        e.want = n * e.cost;
      } else if (proc.feedback) {
        const tau = (f) => Math.floor(k * clip.format.fps * (lap * materialDuration(clip) + materialTime(clip, f / clip.format.fps)) + 1e-6);
        e.fbTarget = tau(fl + 1);
        e.fbFrom = tau(fl);
        const st = this.passState.get(pass.id);
        const done = st?.fbDone ?? e.fbFrom;
        let n = Math.max(0, e.fbTarget - done);
        if (!this.exact) n = Math.min(n, 3 * Math.max(1, e.fbTarget - e.fbFrom));
        e.fbN = Math.min(n, 600);
        e.cost = (this.w * this.h) / 1e6;
        e.want = n * e.cost;
      }
      want += e.want;
      plan.set(pass.id, e);
    }
    // tetto dell'anteprima, in milioni di pixel per fotogramma
    const budget = this.exact ? Infinity : this.budget;
    const scale = want > budget ? budget / want : 1;
    let done = 0;
    if (scale < 1) for (const e of plan.values()) { e.n = Math.floor(e.n * scale); e.fbN = Math.floor(e.fbN * scale); }
    for (const e of plan.values()) done += (e.n + e.fbN) * e.cost;
    this.stats = { want, done: Math.min(want, done), scale };
    return plan;
  }

  /** Il campo di forze di questo fotogramma, in una texture piccola condivisa. */
  _forceField(clip, F, t) {
    const gl = this.gl;
    const asp = this.w / this.h;
    const fw = Math.max(2, Math.round(asp >= 1 ? FIELD_LONG : FIELD_LONG * asp)), fh = Math.max(2, Math.round(asp >= 1 ? FIELD_LONG / asp : FIELD_LONG));
    if (!this.field || this.field.w !== fw || this.field.h !== fh) {
      if (this.field) this._freeTarget(this.field);
      this.field = this._target(this._tex(fw, fh));
      this.field.w = fw; this.field.h = fh;
    }
    if (!this.fieldProg) this.fieldProg = this._program(VERT, PRELUDE + FORZE_FRAG);
    const P = this.fieldProg, L = P.loc;
    const wf = Math.max(0, forceValue(F, 'vento.forza', t));
    const wa = (forceValue(F, 'vento.direzione', t) * Math.PI) / 180;
    const wv = [Math.cos(wa) * wf * SCALA.vento, Math.sin(wa) * wf * SCALA.vento];
    const pk = packLocals(F, t, asp);
    gl.useProgram(P.p);
    gl.uniform1f(L.u_t, t);
    gl.uniform1f(L.u_T, clip.format.duration);
    gl.uniform1f(L.u_loop, clip.format.loop ? 1 : 0);
    gl.uniform1f(L.u_seed, clip.seed || 1);
    gl.uniform2f(L.u_res, fw, fh);
    gl.uniform2f(L.u_w, wv[0], wv[1]);
    gl.uniform1f(L.u_raff, Math.max(0, forceValue(F, 'vento.raffiche', t)));
    gl.uniform1f(L.u_rmis, F.vento?.misura ?? 0.5);
    const pt = new Float32Array(MAX_LOCALI * 4), ptk = new Float32Array(MAX_LOCALI);
    pk.pts.forEach((p, i) => { pt.set(p.slice(0, 4), i * 4); ptk[i] = p[4]; });
    const sg = new Float32Array(MAX_SEGMENTI * 4), sgf = new Float32Array(MAX_SEGMENTI * 2);
    pk.seg.forEach((s, i) => { sg.set(s.slice(0, 4), i * 4); sgf[i * 2] = s[4]; sgf[i * 2 + 1] = s[5]; });
    gl.uniform4fv(L.u_pt, pt); gl.uniform1fv(L.u_ptk, ptk); gl.uniform1i(L.u_npt, pk.pts.length);
    gl.uniform4fv(L.u_sg, sg); gl.uniform2fv(L.u_sgf, sgf); gl.uniform1i(L.u_nsg, pk.seg.length);
    this._draw(P, this.field, fw, fh);
    return { v: wv, f: wf };
  }

  present() {
    const gl = this.gl;
    const cp = this.copyProg;
    gl.useProgram(cp.p);
    this._bind(0, (this.final || this.base).tex);
    gl.uniform1i(cp.loc.u_tex, 0);
    gl.uniform2f(cp.loc.u_scale, 1, 1);
    gl.uniform1f(cp.loc.u_flip, 0);
    this._draw(cp, null, this.w, this.h);
  }

  /**
   * Legge l'ultimo fotogramma come RGB a 16 bit, righe dall'alto in basso.
   * Con i buffer a virgola mobile i valori sono veri 16 bit; altrimenti 8 bit
   * allargati (e lo dichiariamo nel .json).
   */
  readRGB16(out) {
    const gl = this.gl;
    const { w, h } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, (this.final || this.base).fbo);
    const n = w * h;
    const dst = out && out.length === n * 3 ? out : new Uint16Array(n * 3);
    if (this.float) {
      // a strisce di 128 righe: a 4K un'unica lettura in float occuperebbe 133 MB
      const STRIP = 128;
      if (!this._f32 || this._f32.length !== w * STRIP * 4) this._f32 = new Float32Array(w * STRIP * 4);
      const src = this._f32;
      for (let y0 = 0; y0 < h; y0 += STRIP) {
        const sh = Math.min(STRIP, h - y0);
        gl.readPixels(0, y0, w, sh, gl.RGBA, gl.FLOAT, src.subarray(0, w * sh * 4));
        for (let sy = 0; sy < sh; sy++) {
        const y = h - 1 - (y0 + sy); // riga dall'alto
        let si = sy * w * 4, di = y * w * 3;
        for (let x = 0; x < w; x++, si += 4, di += 3) {
          let r = src[si], g = src[si + 1], b = src[si + 2];
          // dithering leggerissimo: spezza le bande residue del mezzo float
          const d = ((x * 7 + y * 13) % 16) / 16 - 0.5;
          r = r * 65535 + d; g = g * 65535 + d; b = b * 65535 + d;
          dst[di] = r < 0 ? 0 : r > 65535 ? 65535 : r;
          dst[di + 1] = g < 0 ? 0 : g > 65535 ? 65535 : g;
          dst[di + 2] = b < 0 ? 0 : b > 65535 ? 65535 : b;
        }
        }
      }
    } else {
      if (!this._u8 || this._u8.length !== n * 4) this._u8 = new Uint8Array(n * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this._u8);
      const src = this._u8;
      for (let y = 0; y < h; y++) {
        let si = (h - 1 - y) * w * 4, di = y * w * 3;
        for (let x = 0; x < w; x++, si += 4, di += 3) {
          dst[di] = src[si] * 257; dst[di + 1] = src[si + 1] * 257; dst[di + 2] = src[si + 2] * 257;
        }
      }
    }
    return dst;
  }

  /** RGBA 8 bit dall'alto in basso (per analisi e miniature). */
  readRGBA8() {
    const gl = this.gl;
    const { w, h } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, (this.final || this.base).fbo);
    const n = w * h;
    let buf;
    if (this.float) {
      const f = new Float32Array(n * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, f);
      buf = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n * 4; i++) buf[i] = f[i] * 255;
    } else {
      buf = new Uint8ClampedArray(n * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    }
    const out = new Uint8ClampedArray(n * 4);
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    for (let i = 3; i < out.length; i += 4) out[i] = 255;
    return out;
  }

  destroy() {
    this._freeAll();
    destroyTerritori(this);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
