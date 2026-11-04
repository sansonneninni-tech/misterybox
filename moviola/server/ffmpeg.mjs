// Scrittura dei file per DaVinci con ffmpeg.
// Il browser manda fotogrammi RGB a 16 bit (rgb48le, righe dall'alto);
// qui diventano ProRes, sequenze 16 bit o una prova H.264.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CODECS = {
  prores422hq: {
    label: 'ProRes 422 HQ', ext: '.mov', bits: 10, kind: 'video',
    note: '10 bit 4:2:2, il formato di lavoro consigliato per DaVinci',
    args: ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le'],
    yuv: 'yuv422p10le',
  },
  prores4444xq: {
    label: 'ProRes 4444 XQ', ext: '.mov', bits: 12, kind: 'video',
    note: '4:4:4 senza sottocampionamento del colore, il massimo del ProRes',
    args: ['-c:v', 'prores_ks', '-profile:v', '5', '-vendor', 'apl0', '-pix_fmt', 'yuv444p10le'],
    yuv: 'yuv444p10le',
  },
  png16: {
    label: 'Sequenza PNG 16 bit', ext: '', bits: 16, kind: 'sequence', pattern: '%05d.png',
    note: 'RGB 16 bit senza perdita, un file per fotogramma',
    args: ['-c:v', 'png', '-pix_fmt', 'rgb48be'],
  },
  tiff16: {
    label: 'Sequenza TIFF 16 bit', ext: '', bits: 16, kind: 'sequence', pattern: '%05d.tif',
    note: 'RGB 16 bit compressione LZW, un file per fotogramma',
    args: ['-c:v', 'tiff', '-pix_fmt', 'rgb48le', '-compression_algo', 'lzw'],
  },
  h264: {
    label: 'H.264 (prova)', ext: '.mp4', bits: 8, kind: 'video',
    note: 'solo per guardare o mandare una prova: 8 bit 4:2:0, compresso',
    args: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
    yuv: 'yuv420p',
  },
};

let cache;
export function probe() {
  if (cache) return cache;
  const bin = process.env.FFMPEG || 'ffmpeg';
  const r = spawnSync(bin, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) { cache = { ok: false, bin, encoders: [] }; return cache; }
  const has = (n) => new RegExp(`\\s${n}\\s`).test(r.stdout);
  const encoders = [];
  if (has('prores_ks')) encoders.push('prores422hq', 'prores4444xq');
  if (has('png')) encoders.push('png16');
  if (has('tiff')) encoders.push('tiff16');
  if (has('libx264')) encoders.push('h264');
  const v = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  cache = { ok: true, bin, encoders, version: (v.stdout || '').split('\n')[0] };
  return cache;
}

/**
 * Avvia ffmpeg in attesa di fotogrammi su stdin.
 * Restituisce { proc, output, done: Promise }.
 */
export function startEncoder({ codec, w, h, fps, outBase }) {
  const c = CODECS[codec];
  if (!c) throw new Error('Formato sconosciuto: ' + codec);
  const { bin } = probe();
  let output;
  if (c.kind === 'sequence') {
    fs.mkdirSync(outBase, { recursive: true });
    output = path.join(outBase, path.basename(outBase) + '_' + c.pattern);
  } else {
    output = outBase + c.ext;
  }
  const filters = [];
  if (c.yuv) {
    // conversione RGB -> YUV con matrice Rec.709 e gamma 709, livelli video:
    // DaVinci legge il file senza spostamenti di colore
    filters.push(`scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+bitexact,format=${c.yuv}`);
  }
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb48le', '-s', `${w}x${h}`, '-framerate', String(fps),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'rgb',
    '-i', 'pipe:0',
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    ...c.args,
    '-r', String(fps),
    '-color_primaries', 'bt709', '-color_trc', 'bt709',
    ...(c.yuv ? ['-colorspace', 'bt709', '-color_range', 'tv'] : []),
    '-an',
    '-metadata', 'comment=MOVIOLA',
    output,
  ];
  const proc = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  proc.stderr.on('data', (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
  const done = new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || 'ffmpeg uscito con codice ' + code))));
  });
  return { proc, output, done, args };
}

/** Copia leggera di un video non leggibile dal browser (es. ProRes in Chrome). */
export function makeProxy(input, output) {
  const { bin } = probe();
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-vf', "scale='min(3840,iw)':-2", '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p',
      '-an', '-movflags', '+faststart', output]);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err || 'proxy fallito'))));
  });
}
