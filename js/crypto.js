// Kryptografi: PBKDF2 (SHA-256) for nøkkelavledning, AES-GCM for kryptering av lokale data.
window.PLCrypto = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const hexToBytes = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
  const bytesToHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const bytesToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function deriveRawKey(password, saltHex, iterations) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
      base,
      256
    );
  }

  async function verifierOf(rawKey) {
    return bytesToHex(await crypto.subtle.digest('SHA-256', rawKey));
  }

  function importAesKey(rawKey) {
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encrypt(aesKey, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(text));
    const out = new Uint8Array(iv.length + ct.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(ct), iv.length);
    return bytesToB64(out);
  }

  async function decrypt(aesKey, b64) {
    const data = b64ToBytes(b64);
    const iv = data.slice(0, 12);
    const ct = data.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
    return dec.decode(pt);
  }

  function randomHex(bytes) {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
  }

  return { deriveRawKey, verifierOf, importAesKey, encrypt, decrypt, bytesToB64, b64ToBytes, randomHex };
})();
