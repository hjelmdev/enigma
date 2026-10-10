/** A fresh unsigned seed, using browser crypto when available. */
export function randomSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(values);
  else values[0] = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return values[0] >>> 0 || 0x9e3779b9;
}
