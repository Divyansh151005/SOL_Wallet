import bs58 from 'bs58'

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode(...Array.from(sub))
  }
  return Buffer.from(binary, 'binary').toString('base64')
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

export function parseSecret(inputRaw: string): Uint8Array | null {
  const input = (inputRaw || '').trim()
  if (!input) return null
  if (input.startsWith('[') && input.endsWith(']')) {
    try {
      const arr = JSON.parse(input)
      if (!Array.isArray(arr)) return null
      const nums = arr.map((n: any) => Number(n))
      if (nums.some((n: any) => !Number.isFinite(n) || n < 0 || n > 255)) return null
      return new Uint8Array(nums)
    } catch {
      return null
    }
  }
  // try base64
  try {
    const b = base64ToBytes(input)
    if (b.length === 32 || b.length === 64) return b
  } catch {}
  // try base58 seed
  try {
    const b = bs58.decode(input)
    if (b.length === 32 || b.length === 64) return new Uint8Array(b)
  } catch {}
  return null
}


