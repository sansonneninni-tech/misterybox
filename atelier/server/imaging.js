// Ponte tra file su disco (sharp) e buffer RGBA dei processi condivisi.
import sharp from 'sharp';

// Limite di lavoro: oltre questa area si lavora su una copia ridotta
// (l'originale resta intatto e si esporta sempre a piena qualità).
export const MAX_WORK_PIXELS = 40_000_000;

sharp.cache(false);

export async function decode(file, maxSide) {
  let pipe = sharp(file, { limitInputPixels: false, failOn: 'none' }).rotate();
  const meta = await sharp(file, { limitInputPixels: false, failOn: 'none' }).metadata();
  let w = meta.autoOrient?.width ?? meta.width, h = meta.autoOrient?.height ?? meta.height;
  let scale = 1;
  if (maxSide && Math.max(w, h) > maxSide) scale = maxSide / Math.max(w, h);
  if (w * h * scale * scale > MAX_WORK_PIXELS) scale = Math.sqrt(MAX_WORK_PIXELS / (w * h));
  if (scale < 1) pipe = pipe.resize(Math.round(w * scale), Math.round(h * scale), { fit: 'fill' });
  const { data, info } = await pipe.toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data), reduced: scale < 1 };
}

export function encodeRaw(img) {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), {
    raw: { width: img.width, height: img.height, channels: 4 },
    limitInputPixels: false,
  });
}

export async function writePng(img, file) {
  await encodeRaw(img).removeAlpha().withIccProfile('srgb').png({ compressionLevel: 6 }).toFile(file);
}

export async function thumbnail(file, out) {
  await sharp(file, { limitInputPixels: false, failOn: 'none' }).rotate()
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#808080' }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
}

export async function metadata(file) {
  const m = await sharp(file, { limitInputPixels: false, failOn: 'none' }).metadata();
  const w = m.autoOrient?.width ?? m.width, h = m.autoOrient?.height ?? m.height;
  return { width: w, height: h, format: m.format, space: m.space, depth: m.depth, hasProfile: !!m.icc, density: m.density };
}
