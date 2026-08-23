import { describe, expect, it } from 'vitest'
import {
  decryptMetadataText,
  encryptMetadataText,
  isEncryptedMetadataEnvelope,
} from './metadata-crypto'

describe('metadata encryption', () => {
  it('encrypts and decrypts metadata text with a passphrase', async () => {
    const plaintext = JSON.stringify({ secret: 'bookmark metadata' })
    const envelope = await encryptMetadataText({
      plaintext,
      passphrase: 'correct horse battery staple',
      updatedAt: 1,
      deviceId: 'device-a',
    })

    expect(isEncryptedMetadataEnvelope(envelope)).toBe(true)
    expect(envelope.data).not.toContain('bookmark metadata')
    await expect(decryptMetadataText(envelope, 'correct horse battery staple'))
      .resolves
      .toBe(plaintext)
    await expect(decryptMetadataText(envelope, 'wrong passphrase'))
      .rejects
      .toThrow()
  })
})
