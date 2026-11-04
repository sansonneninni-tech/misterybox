// Esegue un processo in un thread separato, così il server resta reattivo
// (anche per l'iPhone) mentre lavora su immagini grandi.
import { parentPort, workerData } from 'node:worker_threads';
import { runProcess } from '../shared/processes/index.js';

try {
  const { id, inputs, params, seed } = workerData;
  const { image, params: used } = runProcess(id, inputs, params, seed);
  parentPort.postMessage({ ok: true, image, params: used }, [image.data.buffer]);
} catch (e) {
  parentPort.postMessage({ ok: false, error: e.message });
}
