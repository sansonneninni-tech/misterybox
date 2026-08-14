/**
 * Audio: musiche e effetti generati con WebAudio (nessun file esterno).
 * Le tracce usano onde quadre/triangolari e un sequencer con lookahead,
 * lo stesso approccio timbrico dei chip sonori a 4 canali.
 */

type NoteSpec = [string | null, number];

interface Track {
  bpm: number;
  lead: NoteSpec[];
  bass: NoteSpec[];
  /** Onda del canale melodico. */
  leadWave?: OscillatorType;
  volume?: number;
}

const NOTE_BASE: Record<string, number> = {
  C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4,
  'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2,
};

function noteFreq(name: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const semis = NOTE_BASE[m[1]] + (Number(m[2]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 96, leadWave: 'triangle', volume: 0.9,
    lead: [
      ['E4', 2], ['G4', 1], ['A4', 1], ['B4', 2], ['A4', 1], ['G4', 1],
      ['E4', 2], ['D4', 2], ['E4', 4],
      ['G4', 2], ['B4', 1], ['C5', 1], ['D5', 2], ['C5', 1], ['B4', 1],
      ['A4', 4], [null, 4],
    ],
    bass: [
      ['E2', 2], ['E2', 2], ['C2', 2], ['C2', 2],
      ['G2', 2], ['G2', 2], ['D2', 2], ['D2', 2],
      ['E2', 2], ['E2', 2], ['A2', 2], ['A2', 2],
      ['B2', 2], ['B2', 2], ['E2', 4],
    ],
  },
  town: {
    bpm: 128, leadWave: 'square', volume: 0.55,
    lead: [
      ['C5', 1], ['E5', 1], ['G5', 1], ['E5', 1], ['F5', 1], ['E5', 1], ['D5', 2],
      ['B4', 1], ['D5', 1], ['G5', 1], ['D5', 1], ['E5', 2], ['C5', 2],
      ['A4', 1], ['C5', 1], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 1], ['B4', 2],
      ['G4', 1], ['B4', 1], ['D5', 1], ['G5', 1], ['C5', 4],
    ],
    bass: [
      ['C3', 2], ['G2', 2], ['A2', 2], ['E2', 2],
      ['F2', 2], ['C3', 2], ['G2', 2], ['G2', 2],
      ['A2', 2], ['E2', 2], ['F2', 2], ['C3', 2],
      ['G2', 2], ['G2', 2], ['C3', 4],
    ],
  },
  route: {
    bpm: 144, leadWave: 'square', volume: 0.5,
    lead: [
      ['D5', 1], ['D5', 1], ['F5', 1], ['A5', 1], ['G5', 2], ['E5', 2],
      ['C5', 1], ['C5', 1], ['E5', 1], ['G5', 1], ['F5', 2], ['D5', 2],
      ['A4', 1], ['C5', 1], ['D5', 1], ['F5', 1], ['E5', 2], ['C5', 2],
      ['D5', 1], ['F5', 1], ['A5', 1], ['C6', 1], ['A5', 4],
    ],
    bass: [
      ['D3', 1], ['A2', 1], ['D3', 1], ['A2', 1], ['C3', 1], ['G2', 1], ['C3', 1], ['G2', 1],
      ['B2', 1], ['F2', 1], ['B2', 1], ['F2', 1], ['A2', 1], ['E2', 1], ['A2', 1], ['E2', 1],
      ['D3', 1], ['A2', 1], ['D3', 1], ['A2', 1], ['F2', 2], ['A2', 2],
      ['D3', 4],
    ],
  },
  forest: {
    bpm: 108, leadWave: 'triangle', volume: 0.55,
    lead: [
      ['A4', 2], ['C5', 1], ['D5', 1], ['E5', 2], ['D5', 2],
      ['C5', 2], ['A4', 2], ['G4', 4],
      ['A4', 2], ['E5', 1], ['D5', 1], ['C5', 2], ['B4', 2],
      ['A4', 4], [null, 4],
    ],
    bass: [
      ['A2', 2], ['A2', 2], ['F2', 2], ['F2', 2],
      ['C3', 2], ['C3', 2], ['G2', 2], ['G2', 2],
      ['A2', 2], ['A2', 2], ['D3', 2], ['D3', 2],
      ['E2', 4], ['A2', 4],
    ],
  },
  battle: {
    bpm: 168, leadWave: 'square', volume: 0.6,
    lead: [
      ['E5', 1], ['E5', 1], ['E5', 1], ['G5', 1], ['B5', 2], ['A5', 1], ['G5', 1],
      ['E5', 1], ['E5', 1], ['D5', 1], ['E5', 1], ['G5', 2], ['E5', 2],
      ['C5', 1], ['C5', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['F5', 1], ['E5', 1],
      ['D5', 1], ['D5', 1], ['F5', 1], ['A5', 1], ['B5', 4],
    ],
    bass: [
      ['E2', 1], ['E2', 1], ['E2', 1], ['E2', 1], ['E2', 1], ['E2', 1], ['B2', 1], ['B2', 1],
      ['C3', 1], ['C3', 1], ['C3', 1], ['C3', 1], ['G2', 1], ['G2', 1], ['G2', 1], ['G2', 1],
      ['A2', 1], ['A2', 1], ['A2', 1], ['A2', 1], ['F2', 1], ['F2', 1], ['F2', 1], ['F2', 1],
      ['B2', 2], ['B2', 2], ['E2', 4],
    ],
  },
  center: {
    bpm: 100, leadWave: 'triangle', volume: 0.5,
    lead: [
      ['G4', 1], ['A4', 1], ['B4', 2], ['D5', 2], ['B4', 2],
      ['C5', 1], ['B4', 1], ['A4', 2], ['G4', 4],
      [null, 2], ['D5', 2], ['C5', 2], ['B4', 2], ['A4', 4], [null, 2],
    ],
    bass: [
      ['G2', 2], ['D3', 2], ['G2', 2], ['D3', 2],
      ['C3', 2], ['G2', 2], ['C3', 2], ['G2', 2],
      ['A2', 2], ['E3', 2], ['D3', 2], ['A2', 2],
      ['G2', 4],
    ],
  },
  victory: {
    bpm: 150, leadWave: 'square', volume: 0.65,
    lead: [
      ['C5', 1], ['C5', 1], ['C5', 1], ['C5', 2], ['G4', 2], ['A4', 2], ['C5', 2],
      ['B4', 1], ['C5', 3], [null, 4],
    ],
    bass: [
      ['C3', 1], ['C3', 1], ['C3', 1], ['C3', 2], ['C3', 2], ['F2', 2], ['G2', 2],
      ['G2', 1], ['C3', 3], [null, 4],
    ],
  },
};

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private current: string | null = null;
  private nextTime = 0;
  private step = 0;
  enabled = true;
  private started = false;

  /** Va chiamato da un gesto dell'utente. */
  init(): void {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 1;
      this.musicGain.connect(this.master);
      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
    else if (this.current) this.playMusic(this.current, true);
    return this.enabled;
  }

  playMusic(name: string, force = false): void {
    if (!this.started || !this.enabled) {
      this.current = name;
      return;
    }
    if (this.current === name && this.timer !== null && !force) return;
    this.stopMusic();
    if (!TRACKS[name]) return;
    this.current = name;
    this.step = 0;
    this.nextTime = this.ctx!.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(name), 60);
  }

  stopMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(name: string): void {
    const ctx = this.ctx;
    const track = TRACKS[name];
    if (!ctx || !track) return;
    const beat = 60 / track.bpm / 2; // ottavi
    const horizon = ctx.currentTime + 0.4;
    let guard = 0;
    while (this.nextTime < horizon && guard++ < 40) {
      const leadTotal = track.lead.reduce((n, x) => n + x[1], 0);
      const bassTotal = track.bass.reduce((n, x) => n + x[1], 0);
      const t = this.step;

      const lead = pickNote(track.lead, t % leadTotal);
      if (lead) this.tone(lead, this.nextTime, beat * lead.len * 0.92, track.leadWave ?? 'square', 0.16 * (track.volume ?? 1));
      const bass = pickNote(track.bass, t % bassTotal);
      if (bass) this.tone(bass, this.nextTime, beat * bass.len * 0.9, 'triangle', 0.2 * (track.volume ?? 1));
      // Percussione leggera a ogni battuta.
      if (t % 4 === 0) this.noise(this.nextTime, 0.035, 0.05);
      else if (t % 2 === 1) this.noise(this.nextTime, 0.02, 0.022);

      this.nextTime += beat;
      this.step++;
    }
  }

  private tone(
    note: { name: string; len: number; start: number },
    when: number,
    dur: number,
    wave: OscillatorType,
    gain: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    // Suona solo all'inizio della nota.
    if (note.start !== 0) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = noteFreq(note.name);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0008, when + Math.max(0.06, dur));
    osc.connect(env);
    env.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + Math.max(0.08, dur) + 0.02);
  }

  private noise(when: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.musicGain);
    src.start(when);
  }

  // --- effetti ------------------------------------------------------------

  sfx(name: string): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime;
    const beep = (freq: number, dur: number, wave: OscillatorType = 'square', gain = 0.18, slide = 0) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + dur);
      env.gain.setValueAtTime(gain, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(env);
      env.connect(this.master!);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };
    const seq = (notes: Array<[number, number]>, wave: OscillatorType = 'square', gain = 0.16) => {
      let t = 0;
      for (const [f, d] of notes) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = f;
        env.gain.setValueAtTime(0, now + t);
        env.gain.linearRampToValueAtTime(gain, now + t + 0.008);
        env.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.connect(env);
        env.connect(this.master!);
        osc.start(now + t);
        osc.stop(now + t + d + 0.02);
        t += d;
      }
    };

    switch (name) {
      case 'select': beep(880, 0.06, 'square', 0.12); break;
      case 'cancel': beep(300, 0.08, 'square', 0.12, -120); break;
      case 'step': beep(180, 0.03, 'triangle', 0.05); break;
      case 'grass': this.noise(now, 0.09, 0.06); break;
      case 'jump': beep(420, 0.18, 'square', 0.12, 320); break;
      case 'door': seq([[440, 0.05], [660, 0.07]]); break;
      case 'item': seq([[660, 0.07], [880, 0.07], [1320, 0.12]]); break;
      case 'heal': seq([[784, 0.1], [988, 0.1], [1175, 0.16]], 'triangle', 0.14); break;
      case 'alert': seq([[988, 0.09], [988, 0.09], [1319, 0.16]]); break;
      case 'hit': this.noise(now, 0.12, 0.16); beep(220, 0.1, 'square', 0.1, -140); break;
      case 'supereffective': this.noise(now, 0.2, 0.2); beep(340, 0.18, 'sawtooth', 0.14, -220); break;
      case 'faint': beep(500, 0.5, 'square', 0.14, -420); break;
      case 'levelup': seq([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.22]], 'square', 0.15); break;
      case 'ball': beep(700, 0.12, 'sine', 0.14, -300); break;
      case 'catch': seq([[659, 0.1], [784, 0.1], [988, 0.1], [1319, 0.3]], 'square', 0.16); break;
      case 'escape': seq([[400, 0.08], [300, 0.1]], 'square', 0.12); break;
      case 'buy': seq([[880, 0.06], [1175, 0.1]], 'square', 0.13); break;
      case 'save': seq([[784, 0.09], [1047, 0.16]], 'triangle', 0.14); break;
      default: beep(660, 0.05, 'square', 0.1); break;
    }
  }
}

/** Trova la nota attiva a un dato passo e indica se e' il suo attacco. */
function pickNote(seq: NoteSpec[], step: number): { name: string; len: number; start: number } | null {
  let acc = 0;
  for (const [name, len] of seq) {
    if (step < acc + len) {
      if (!name) return null;
      return { name, len, start: step - acc };
    }
    acc += len;
  }
  return null;
}

export const audio = new AudioSystem();
