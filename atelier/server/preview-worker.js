// Thread fisso per le anteprime: resta acceso e risponde ai messaggi,
// così ogni movimento di un cursore costa solo il calcolo, non l'avvio.
import { parentPort } from 'node:worker_threads';
import { runProcess } from '../shared/processes/index.js';

parentPort.on('message', ({ job, id, inputs, params, seed }) => {
  try {
    const { image } = runProcess(id, inputs, params, seed);
    parentPort.postMessage({ job, ok: true, image }, [image.data.buffer]);
  } catch (e) {
    parentPort.postMessage({ job, ok: false, error: e.message });
  }
});
