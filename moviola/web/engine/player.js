// Lettore: tiene insieme un Renderer, una clip e le sue sorgenti; riproduce
// a fotogrammi interi (24 o 30 al secondo), come la pellicola.

import { Renderer } from './renderer.js';
import { dims } from './clip.js';
import { byId } from './processes.js';
import { loadMedia, seekVideo, videoTime } from '../media.js';

export class Player {
  constructor(canvas, { previewLong = 960, onFrame } = {}) {
    this.canvas = canvas;
    this.r = new Renderer(canvas);
    this.previewLong = previewLong;
    this.onFrame = onFrame;
    this.clip = null;
    this.frame = 0;
    this.playing = false;
    this.live = null;
    this.exact = false;   // anteprima esatta: nessun fotogramma saltato, tutti i passi della materia
    this.srcs = [];
    this._srcKey = '';
    this._raf = 0;
    this._tick = this._tick.bind(this);
  }

  get fps() { return this.clip?.format.fps || 24; }
  get total() { return Math.max(1, Math.round((this.clip?.format.duration || 1) * this.fps)); }
  get t() { return (this.frame % this.total) / this.fps; }
  get float() { return this.r.float; }

  size() {
    const f = this.clip.format;
    const d = dims(f.aspect, this.previewLong);
    return d;
  }

  needsHistory() { return (this.clip?.chain || []).some((p) => p.on && (byId[p.proc]?.feedback || byId[p.proc]?.history || byId[p.proc]?.sim)); }

  /** sources: record dell'archivio nell'ordine della clip; urlOf: record -> url */
  async setClip(clip, sources = [], urlOf = (s) => s.url) {
    this.clip = clip;
    const key = clip.sources.map((s) => s.id).join(',') + '|' + sources.map((s) => s && urlOf(s)).join(',');
    if (key !== this._srcKey) {
      this._srcKey = key;
      const loaded = [];
      for (let i = 0; i < clip.sources.length && i < 4; i++) {
        const rec = sources[i];
        if (!rec) continue;
        try {
          const m = await loadMedia(urlOf(rec), rec.kind);
          loaded.push({ ...m, speed: clip.sources[i].speed ?? 1, start: clip.sources[i].start || 0, rec });
        } catch (e) { console.warn(e); }
      }
      this.srcs = loaded;
      this.r.setSources(loaded);
      this._syncVideos(true);
    } else {
      this.srcs.forEach((s, i) => { s.speed = clip.sources[i]?.speed ?? 1; s.start = clip.sources[i]?.start || 0; });
    }
    const { w, h } = this.size();
    this.r.setSize(w, h);
    this.r.prune(clip.chain);
    if (!this.playing) this.draw();
  }

  setPreview(long) {
    this.previewLong = long;
    if (!this.clip) return;
    const { w, h } = this.size();
    this.r.setSize(w, h);
    if (!this.playing) this.seek(this.frame);
  }

  /** Ridisegna il fotogramma corrente (dopo un cambio di parametro). */
  draw() {
    if (!this.clip) return;
    this.r.render(this.clip, this.t, this.frame, this.live);
    this.onFrame && this.onFrame(this);
  }

  _syncVideos(force) {
    for (const s of this.srcs) {
      if (s.kind !== 'video') continue;
      const v = s.el;
      const want = videoTime(s, this.t);
      if (this.playing) {
        v.playbackRate = Math.max(0.0625, Math.min(16, Math.abs(s.speed || 1)));
        if (v.paused) v.play().catch(() => {});
        if (force || Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
      } else {
        if (!v.paused) v.pause();
        if (force || Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
      }
    }
  }

  play() {
    if (this.playing || !this.clip) return;
    this.playing = true;
    this._wall = performance.now() - (this.frame / this.fps) * 1000;
    this._syncVideos(true);
    this._raf = requestAnimationFrame(this._tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this._raf);
    this._syncVideos(false);
    this.onFrame && this.onFrame(this);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  setExact(on) { this.exact = !!on; this.r.exact = this.exact; this.restart(); if (!this.playing) this.play(); }

  _tick(now) {
    if (!this.playing) return;
    let target = Math.floor(((now - this._wall) / 1000) * this.fps);
    // anteprima esatta: un fotogramma alla volta, anche se il Mac resta indietro
    if (this.exact && target > this.frame + 1) { target = this.frame + 1; this._wall = now - (target / this.fps) * 1000; }
    if (target > this.frame) {
      // se il computer resta indietro salta fotogrammi invece di rallentare
      const prevLoop = Math.floor(this.frame / this.total);
      this.frame = target;
      if (Math.floor(this.frame / this.total) !== prevLoop) this._syncVideos(true);
      else if (this.frame % 12 === 0) this._syncVideos(false);
      this.r.render(this.clip, this.t, this.frame, this.live);
      this.onFrame && this.onFrame(this);
    }
    this._raf = requestAnimationFrame(this._tick);
  }

  /**
   * Va al fotogramma f. Con retroazione o memoria ricalcola fino a 36
   * fotogrammi prima, per non mostrare un quadro senza passato.
   */
  async seek(f) {
    f = Math.max(0, Math.round(f));
    const wasPlaying = this.playing;
    if (wasPlaying) { this.frame = f; this._wall = performance.now() - (f / this.fps) * 1000; this._syncVideos(true); return; }
    this.frame = f;
    const videos = this.srcs.filter((s) => s.kind === 'video');
    await Promise.all(videos.map((s) => seekVideo(s.el, videoTime(s, this.t))));
    if (this.needsHistory()) {
      this.r.reset();
      const from = Math.max(0, f - 36);
      for (let i = from; i < f; i++) this.r.render(this.clip, (i % this.total) / this.fps, i, this.live, { display: false });
    }
    this.draw();
  }

  restart() { this.r.reset(); this.seek(0); }

  destroy() { this.pause(); this.r.destroy(); }
}
