const ENCRYPTION_ALGORITHM = 'AES-GCM'
const KEY_DERIVATION_ALGORITHM = 'PBKDF2'
const HASH_ALGORITHM = 'SHA-256'
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt']
const KEY_LENGTH = 256
const ITERATIONS = 150_000

export interface EncryptedMetadataEnvelope {
  schemaVersion: 3
  encrypted: true
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  iv: string
  data: string
  updatedAt: number
  deviceId: string
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    KEY_DERIVATION_ALGORITHM,
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: KEY_DERIVATION_ALGORITHM,
      salt: toArrayBuffer(salt),
      iterations,
      hash: HASH_ALGORITHM,
    },
    material,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    KEY_USAGE,
  )
}

export function isEncryptedMetadataEnvelope(value: unknown): value is EncryptedMetadataEnvelope {
  return typeof value === 'object'
    && value !== null
    && (value as Partial<EncryptedMetadataEnvelope>).schemaVersion === 3
    && (value as Partial<EncryptedMetadataEnvelope>).encrypted === true
    && (value as Partial<EncryptedMetadataEnvelope>).algorithm === ENCRYPTION_ALGORITHM
    && (value as Partial<EncryptedMetadataEnvelope>).kdf === 'PBKDF2-SHA-256'
    && typeof (value as Partial<EncryptedMetadataEnvelope>).salt === 'string'
    && typeof (value as Partial<EncryptedMetadataEnvelope>).iv === 'string'
    && typeof (value as Partial<EncryptedMetadataEnvelope>).data === 'string'
}

export async function encryptMetadataText(input: {
  plaintext: string
  passphrase: string
  updatedAt: number
  deviceId: string
}): Promise<EncryptedMetadataEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(input.passphrase, salt, ITERATIONS)
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(input.plaintext),
  )
  return {
    schemaVersion: 3,
    encrypted: true,
    algorithm: ENCRYPTION_ALGORITHM,
    kdf: 'PBKDF2-SHA-256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
    updatedAt: input.updatedAt,
    deviceId: input.deviceId,
  }
}

export async function decryptMetadataText(
  envelope: EncryptedMetadataEnvelope,
  passphrase: string,
): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iterations)
  const encrypted = fromBase64(envelope.data)
  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(fromBase64(envelope.iv)) },
    key,
    toArrayBuffer(encrypted),
  )
  return new TextDecoder().decode(decrypted)
}
