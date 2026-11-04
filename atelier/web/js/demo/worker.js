// Versione di prova: esegue i processi condivisi in un thread del browser.
import { runProcess } from '../../shared/processes/index.js';

self.onmessage = ({ data: { job, id, inputs, params, seed } }) => {
  try {
    const { image, params: used } = runProcess(id, inputs, params, seed);
    self.postMessage({ job, ok: true, image, params: used }, [image.data.buffer]);
  } catch (e) {
    self.postMessage({ job, ok: false, error: e.message });
  }
};
