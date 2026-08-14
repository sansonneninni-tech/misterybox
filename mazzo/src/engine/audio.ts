/**
 * Audio interamente sintetizzato con la Web Audio API: nessun file, nessun
 * campione esterno. Serve un tappeto ambientale per ogni livello piu' pochi
 * effetti secchi. Se il browser non concede l'audio, il gioco continua muto.
 */

type Ambience = 'none' | 'room' | 'bar' | 'street';

/** Rumore rosa-ish: base di ventilatore, cicale, frigorifero e strada. */
function noiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099;
    b1 = 0.963 * b1 + w * 0.2965;
    b2 = 0.57 * b2 + w * 1.0526;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }
  return buf;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private layers: AudioNode[] = [];
  private stops: Array<() => void> = [];
  private current: Ambience = 'none';
  private timers: number[] = [];
  muted = false;

  /** Da chiamare dopo un gesto dell'utente (i browser lo pretendono). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      this.noise = noiseBuffer(this.ctx);
    } catch {
      this.ctx = null;
    }
  }

  get enabled(): boolean {
    return this.ctx !== null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  // --- ambienti ---------------------------------------------------------

  private noiseSource(gainValue: number, type: BiquadFilterType, freq: number, q = 1): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return null;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filt).connect(gain).connect(this.master);
    src.start();
    gain.gain.setTargetAtTime(gainValue, ctx.currentTime, 1.2);
    this.stops.push(() => {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* gia' fermo */
        }
      }, 1400);
    });
    this.layers.push(gain);
    return gain;
  }

  /** Ronzio continuo (ventilatore, frigorifero, lampione). */
  private hum(freq: number, gainValue: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.master);
    osc.start();
    gain.gain.setTargetAtTime(gainValue, ctx.currentTime, 1.5);
    this.stops.push(() => {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* gia' fermo */
        }
      }, 1400);
    });
  }

  setAmbience(kind: Ambience): void {
    if (kind === this.current) return;
    this.current = kind;
    for (const s of this.stops) s();
    this.stops = [];
    this.layers = [];
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (!this.ctx) return;

    if (kind === 'room') {
      // Ventilatore: soffio filtrato + lieve oscillazione delle pale.
      const fan = this.noiseSource(0.1, 'lowpass', 620, 0.7);
      if (fan && this.ctx) {
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 5.2;
        const depth = this.ctx.createGain();
        depth.gain.value = 0.022;
        lfo.connect(depth).connect(fan.gain);
        lfo.start();
        this.stops.push(() => {
          try {
            lfo.stop();
          } catch {
            /* gia' fermo */
          }
        });
      }
      this.hum(58, 0.012);
      this.noiseSource(0.012, 'bandpass', 4600, 6); // cicale lontane, oltre la finestra
    } else if (kind === 'bar') {
      this.noiseSource(0.03, 'lowpass', 900, 0.7); // sala e strada oltre la vetrina
      this.hum(96, 0.014, 'triangle'); // frigorifero
      this.noiseSource(0.02, 'lowpass', 520, 0.6); // ventola
      this.every(2600, 4200, () => this.clink());
    } else if (kind === 'street') {
      this.noiseSource(0.026, 'bandpass', 4200, 4.5); // cicale
      this.noiseSource(0.02, 'lowpass', 380, 0.6); // fondo di citta'
      this.hum(100, 0.01, 'sawtooth'); // ronzio del lampione
      this.every(6000, 11000, () => this.scooterPass());
    }
  }

  /** Esegue una funzione a intervalli casuali dentro una finestra. */
  private every(minMs: number, maxMs: number, fn: () => void): void {
    const tick = () => {
      fn();
      const t = window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
      this.timers.push(t as unknown as number);
    };
    const t = window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
    this.timers.push(t as unknown as number);
  }

  // --- effetti ----------------------------------------------------------

  private blip(freq: number, dur: number, gainValue: number, type: OscillatorType = 'square'): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(gainValue, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  /** Battito del testo nei dialoghi: appena percepibile. */
  type(): void {
    this.blip(760 + Math.random() * 90, 0.02, 0.035, 'square');
  }

  /** Conferma di interazione. */
  select(): void {
    this.blip(520, 0.07, 0.06, 'square');
  }

  /** Oggetto raccolto. */
  pickup(): void {
    this.blip(620, 0.06, 0.05);
    setTimeout(() => this.blip(830, 0.09, 0.05), 70);
  }

  /** Mansione completata. */
  taskDone(): void {
    this.blip(660, 0.08, 0.055, 'triangle');
    setTimeout(() => this.blip(880, 0.08, 0.055, 'triangle'), 90);
    setTimeout(() => this.blip(1170, 0.16, 0.05, 'triangle'), 180);
  }

  /** Suono della busta: due note basse, nessuna festa. */
  envelope(): void {
    this.blip(392, 0.5, 0.06, 'sine');
    setTimeout(() => this.blip(294, 0.9, 0.055, 'sine'), 300);
  }

  /** Telefono sul bancone. */
  phone(): void {
    this.blip(1200, 0.05, 0.05);
    setTimeout(() => this.blip(1500, 0.07, 0.05), 80);
  }

  /** Bicchieri e posate nel locale. */
  clink(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const f = 1400 + Math.random() * 1600;
    this.blip(f, 0.05, 0.018, 'triangle');
  }

  /** Motorino che passa lontano: rumore filtrato che sale e scende. */
  scooterPass(): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 240;
    filt.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filt).connect(g).connect(this.master);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.05, t + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 3.6);
    filt.frequency.linearRampToValueAtTime(420, t + 1.4);
    filt.frequency.linearRampToValueAtTime(180, t + 3.6);
    src.start();
    src.stop(t + 3.7);
  }
}
