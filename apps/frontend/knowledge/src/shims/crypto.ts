type RandomValueArray = Uint8Array | Uint16Array | Uint32Array;

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);

  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
};

const randomHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

const fallbackRandomUUID = (): string => {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = randomHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const randomUUID = (): string => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return fallbackRandomUUID();
};

export const getRandomValues = <T extends RandomValueArray>(array: T): T => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(array);
  }

  for (let i = 0; i < array.length; i += 1) {
    array[i] = randomBytes(1)[0] as T[number];
  }
  return array;
};

export default { randomUUID, getRandomValues };
