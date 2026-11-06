// Esportazione per la post-produzione (Lightroom).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DIRS } from './store.js';
import { rawAsset, assetPath } from './library.js';
import { findLineageForAsset } from './experiments.js';

export const FORMATS = [
  { id: 'tiff16', name: 'TIFF 16 bit', ext: 'tif', note: 'Consigliato per Lightroom: senza perdita, più margine sulle curve.' },
  { id: 'tiff8', name: 'TIFF 8 bit', ext: 'tif', note: 'Senza perdita, file più leggero.' },
  { id: 'png', name: 'PNG', ext: 'png', note: 'Senza perdita.' },
  { id: 'jpeg', name: 'JPEG qualità 100', ext: 'jpg', note: 'Per anteprime e condivisione.' },
  { id: 'original', name: 'File originale', ext: null, note: 'I byte esatti del file, senza alcuna ricompressione.' },
];

const slug = (s) => String(s || 'immagine').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'immagine';

export async function exportAsset(id, format = 'tiff16') {
  const a = rawAsset(id);
  if (!a) throw new Error('Immagine non trovata.');
  const fmt = FORMATS.find((f) => f.id === format);
  if (!fmt) throw new Error('Formato sconosciuto.');
  const src = assetPath(a);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const base = `${stamp}_${slug(a.title)}_${a.id.slice(-6)}`;
  let out;
  if (fmt.id === 'original') {
    out = path.join(DIRS.export, `${base}${path.extname(a.file)}`);
    fs.copyFileSync(src, out);
  } else {
    out = path.join(DIRS.export, `${base}.${fmt.ext}`);
    let pipe = sharp(src, { limitInputPixels: false, failOn: 'none' }).rotate();
    // Conserva il profilo colore della sorgente se c'è, altrimenti incorpora sRGB.
    pipe = a.hasProfile ? pipe.keepIccProfile() : pipe.withIccProfile('srgb');
    // Lightroom lavora meglio senza canale alfa: le trasparenze diventano bianco.
    if (fmt.id !== 'png') pipe = pipe.flatten({ background: '#ffffff' });
    if (fmt.id === 'tiff16') pipe = pipe.toColourspace('rgb16').tiff({ compression: 'deflate', predictor: 'horizontal' });
    else if (fmt.id === 'tiff8') pipe = pipe.tiff({ compression: 'deflate', predictor: 'horizontal' });
    else if (fmt.id === 'png') pipe = pipe.png({ compressionLevel: 6 });
    else pipe = pipe.jpeg({ quality: 100, chromaSubsampling: '4:4:4', mozjpeg: false });
    const ifd0 = { ImageDescription: a.title.slice(0, 200) || 'ATELIER', Software: 'ATELIER 0.1' };
    if (a.origin.author) ifd0.Artist = String(a.origin.author).slice(0, 200);
    pipe = pipe.withMetadata({ exif: { IFD0: ifd0 } });
    await pipe.toFile(out);
  }
  // Scheda con provenienza, diritti e cronologia completa delle trasformazioni.
  const lin = findLineageForAsset(id);
  const sheet = {
    titolo: a.title, file: path.basename(out), formato: fmt.name, esportato: new Date().toISOString(),
    dimensioni: `${a.width} × ${a.height}`, provenienza: a.origin, diritti: a.rights, tag: a.tags, note: a.notes, scelta: a.choice,
    esperimento: lin ? { titolo: lin.experiment.title, ipotesi: lin.experiment.hypothesis } : null,
    cronologia: lin ? lin.steps.map((n) => {
      const sa = rawAsset(n.assetId);
      return { passo: n.op.label, motore: n.op.engine, processo: n.op.process, parametri: n.op.params, seme: n.op.seed, modello: n.op.model, prompt: n.op.prompt, crediti: n.op.credits, immagine: sa?.title, data: n.createdAt, nota: n.note };
    }) : [],
  };
  const sheetFile = out.replace(/\.[^.]+$/, '') + '.atelier.json';
  fs.writeFileSync(sheetFile, JSON.stringify(sheet, null, 2));
  return {
    file: path.basename(out), path: out, bytes: fs.statSync(out).size,
    url: `/files/export/${encodeURIComponent(path.basename(out))}`,
    sheetUrl: `/files/export/${encodeURIComponent(path.basename(sheetFile))}`,
    dir: DIRS.export,
  };
}
