// WebSocket minimo (RFC 6455), solo quel che serve al render: il browser manda
// un fotogramma per messaggio binario, il server risponde «ok» o con l'errore.
// Con un canale continuo Chrome libera ogni fotogramma appena spedito; con una
// richiesta HTTP per fotogramma ne tiene una copia fino alla pulizia della
// memoria, che durante un render lungo non arriva, e la pagina si chiude.

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(opcode, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n])
    : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255])
      : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([head, payload]);
}

/**
 * Accetta l'upgrade e chiama onMessage(buffer) per ogni messaggio binario;
 * ciò che onMessage restituisce (o l'errore che lancia) torna al browser come testo.
 * maxSize: dimensione massima di un messaggio.
 */
export function acceptSocket(req, socket, { maxSize, onMessage, onClose }) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);

  let pending = []; let pendingLen = 0;   // byte ricevuti e non ancora letti
  let msg = null; let msgLen = 0;         // messaggio in costruzione (anche su più frame)
  let busy = Promise.resolve();
  let closed = false;
  const close = (code = 1000) => {
    if (closed) return; closed = true;
    try { socket.end(frame(8, Buffer.from([code >> 8, code & 255]))); } catch {}
    onClose && onClose();
  };
  const sendText = (s) => { if (!closed) socket.write(frame(1, Buffer.from(String(s)))); };

  const take = (n) => {
    // toglie n byte dalla testa di pending, copiandoli in un solo Buffer
    const out = Buffer.allocUnsafe(n); let o = 0;
    while (o < n) {
      const c = pending[0]; const k = Math.min(c.length, n - o);
      c.copy(out, o, 0, k); o += k;
      if (k === c.length) pending.shift(); else pending[0] = c.subarray(k);
    }
    pendingLen -= n;
    return out;
  };
  // primi n byte senza consumarli
  const peek = (n) => {
    if (pending[0].length >= n) return pending[0].subarray(0, n);
    const out = Buffer.allocUnsafe(n); let o = 0;
    for (const c of pending) { const k = Math.min(c.length, n - o); c.copy(out, o, 0, k); o += k; if (o === n) break; }
    return out;
  };

  function parse() {
    for (;;) {
      if (pendingLen < 2) return;
      const h = peek(Math.min(pendingLen, 14));
      const fin = h[0] & 0x80, op = h[0] & 0x0f, masked = h[1] & 0x80;
      let len = h[1] & 0x7f, off = 2;
      if (len === 126) { if (h.length < 4) return; len = h.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (h.length < 10) return; len = Number(h.readBigUInt64BE(2)); off = 10; }
      if (!masked) return close(1002);
      if (pendingLen < off + 4 + len) return;
      const head = take(off + 4);
      const mask = head.subarray(off, off + 4);
      if (op === 8) { take(len); return close(); }
      if (op === 9) { const p = take(len); socket.write(frame(10, p)); continue; }
      if (op === 10) { take(len); continue; }
      if (op === 2 || op === 0) {
        // Chrome spezza i messaggi grandi in più frame: se non è l'ultimo si prepara posto per il massimo
        if (op === 2) { msg = Buffer.allocUnsafe(fin ? Math.max(len, 1) : maxSize); msgLen = 0; }
        if (!msg || msgLen + len > msg.length) return close(1009);
        // copia e smaschera direttamente nel messaggio
        let left = len;
        while (left > 0) {
          const c = pending[0]; const k = Math.min(c.length, left);
          for (let i = 0; i < k; i++) msg[msgLen + i] = c[i] ^ mask[(len - left + i) & 3];
          msgLen += k; left -= k; pendingLen -= k;
          if (k === c.length) pending.shift(); else pending[0] = c.subarray(k);
        }
        if (fin) {
          const m = msg.subarray(0, msgLen); msg = null;
          busy = busy.then(() => onMessage(m)).then((r) => sendText(r ?? 'ok'), (e) => sendText('errore: ' + (e.message || e)));
        }
        continue;
      }
      take(len); // testo o altro: ignorato
    }
  }
  socket.on('data', (c) => { pending.push(c); pendingLen += c.length; try { parse(); } catch (e) { console.error('ws', e); socket.destroy(); } });
  socket.on('close', () => { if (!closed) { closed = true; onClose && onClose(); } });
  socket.on('error', () => {});
}
