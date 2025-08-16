import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js'
import QRCode from 'qrcode'

function formatPubkeyStr(s?: string) {
  if (!s) return ''
  return `${s.slice(0, 4)}...${s.slice(-4)}`
}
function formatPubkey(key?: PublicKey | null) {
  return key ? formatPubkeyStr(key.toBase58()) : ''
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode(...Array.from(sub))
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function parseSecret(inputRaw: string): Uint8Array | null {
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
  try {
    return base64ToBytes(input)
  } catch {
    return null
  }
}

function App() {
  const [secret, setSecret] = useState<string>('')
  const [keypair, setKeypair] = useState<Keypair | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [toAddress, setToAddress] = useState<string>('')
  const [amount, setAmount] = useState<string>('0.1')
  const [sig, setSig] = useState<string>('')
  const [explorerUrl, setExplorerUrl] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [copySearch, setCopySearch] = useState<string>('')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [receiveQr, setReceiveQr] = useState<string>('')

  const connection = useMemo(() => new Connection(clusterApiUrl('devnet'), 'confirmed'), [])

  const address = useMemo(() => keypair?.publicKey?.toBase58() || '', [keypair])

  async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) throw new Error((data && (data.error || data.message)) || res.statusText)
    return data as T
  }

  const refreshBalance = useCallback(async () => {
    if (!keypair) return
    try {
      const resp = await jsonFetch<{ balanceSOL?: number; lamports?: number }>(`/api/balance/${keypair.publicKey.toBase58()}`)
      if (typeof resp.balanceSOL === 'number') setBalance(resp.balanceSOL)
      else if (typeof resp.lamports === 'number') setBalance(resp.lamports / LAMPORTS_PER_SOL)
      else throw new Error('bad-response')
    } catch {
      const lamports = await connection.getBalance(keypair.publicKey)
      setBalance(lamports / LAMPORTS_PER_SOL)
    }
  }, [connection, keypair])

  useEffect(() => {
    if (keypair) refreshBalance(); else setBalance(null)
  }, [keypair, refreshBalance])

  // Live balance updates: subscribe to account changes
  useEffect(() => {
    if (!keypair) return
    const publicKey = keypair.publicKey
    let subscriptionId: number | null = null
    ;(async () => {
      try {
        subscriptionId = await connection.onAccountChange(publicKey, (accountInfo) => {
          try {
            setBalance(accountInfo.lamports / LAMPORTS_PER_SOL)
          } catch {
            // no-op
          }
        }, 'confirmed')
      } catch {
        // best-effort: ignore subscription errors
      }
    })()
    return () => {
      if (subscriptionId !== null) {
        // ignore any errors on teardown
        connection.removeAccountChangeListener(subscriptionId).catch(() => {})
      }
    }
  }, [connection, keypair])

  const handleCreate = async () => {
    try {
      const resp = await jsonFetch<{ secretBase64?: string; pubkey?: string }>(`/api/wallet/create`, { method: 'POST', body: JSON.stringify({}) })
      if (resp.secretBase64) {
        const kp = Keypair.fromSecretKey(base64ToBytes(resp.secretBase64))
        setKeypair(kp)
        setSecret(resp.secretBase64)
      } else {
        const kp = Keypair.generate()
        setKeypair(kp)
        setSecret(bytesToBase64(kp.secretKey))
      }
    } catch {
      const kp = Keypair.generate()
      setKeypair(kp)
      setSecret(bytesToBase64(kp.secretKey))
    }
    setSig('')
    setExplorerUrl('')
    setStatus('')
  }

  const handleImport = async () => {
    try {
      const bytes = parseSecret(secret)
      if (!bytes) throw new Error('parse')
      let kp: Keypair
      if (bytes.length === 64) kp = Keypair.fromSecretKey(bytes)
      else if (bytes.length === 32) kp = Keypair.fromSeed(bytes)
      else throw new Error('len')
      setKeypair(kp)
      setSig('')
      setExplorerUrl('')
      setStatus('')
      try {
        await jsonFetch(`/api/wallet/import`, { method: 'POST', body: JSON.stringify({ input: secret }) })
      } catch { /* ignore backend import failure */ }
    } catch (e) {
      setStatus('Invalid key. Paste base64 64-byte secretKey or JSON array of 64 numbers (Solana CLI). 32-byte seed accepted.')
      setTimeout(() => setStatus(''), 5000)
    }
  }

  async function pollSignature(signature: string, maxMs = 30000, intervalMs = 1500) {
    const started = Date.now()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value } = await connection.getSignatureStatuses([signature])
      const s = value[0]
      if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') return true
      if (s?.err) throw new Error('Transaction failed')
      if (Date.now() - started > maxMs) return false
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }

  const handleAirdrop = async () => {
    if (!keypair) return
    try {
      setStatus('airdrop-pending')
      const resp = await jsonFetch<{ signature?: string; explorerUrl?: string; status?: string }>(`/api/airdrop`, {
        method: 'POST',
        body: JSON.stringify({ pubkey: keypair.publicKey.toBase58() }),
      })
      if (resp.status) setStatus(resp.status)
      if (resp.signature) setSig(resp.signature)
      if (resp.explorerUrl) setExplorerUrl(resp.explorerUrl)
      await refreshBalance()
    } catch {
      try {
        setStatus('Requesting airdrop...')
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')
        const lamports = 1 * LAMPORTS_PER_SOL
        const signature = await connection.requestAirdrop(keypair.publicKey, lamports)
        const fastConfirm = connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
        const timed = Promise.race([
          fastConfirm,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ])
        try {
          await timed
          setStatus('Airdrop confirmed')
        } catch {
          setStatus('Taking longer than usual... waiting for confirmation')
          const ok = await pollSignature(signature, 45000, 1500)
          if (!ok) setStatus('Airdrop may be delayed. It should appear shortly; try Refresh in a few seconds.')
          else setStatus('Airdrop confirmed')
        }
        await refreshBalance()
        setSig(signature)
        setExplorerUrl(`https://explorer.solana.com/tx/${signature}?cluster=devnet`)
      } catch (e: any) {
        if (String(e?.message || e).toLowerCase().includes('airdrop') || String(e).includes('429')) {
          try {
            setStatus('Retrying airdrop with smaller amount (0.25 SOL)...')
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')
            const signature = await connection.requestAirdrop(keypair.publicKey, 0.25 * LAMPORTS_PER_SOL)
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
            setStatus('Airdrop confirmed (0.25 SOL)')
            await refreshBalance()
            setSig(signature)
            setExplorerUrl(`https://explorer.solana.com/tx/${signature}?cluster=devnet`)
            return
          } catch {
            setStatus('Airdrop failed. Devnet faucet may be rate-limited. Try again later or use smaller amount.')
            return
          }
        }
        setStatus(`Airdrop failed: ${e?.message ?? e}`)
      }
    }
  }

  const handleSend = async () => {
    try {
      if (!keypair) return
      const payload = {
        fromSecretBase64: secret,
        toPubkey: toAddress,
        amountSOL: parseFloat(amount || '0'),
      }
      const resp = await jsonFetch<{ signature?: string; explorerUrl?: string }>(`/api/send`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (resp.signature) setSig(resp.signature)
      if (resp.explorerUrl) setExplorerUrl(resp.explorerUrl)
      setStatus('Transfer submitted')
      await refreshBalance()
    } catch {
      try {
        if (!keypair) return
        const sender = keypair as Keypair
        const to = new PublicKey(toAddress)
        const lamports = Math.floor(parseFloat(amount || '0') * LAMPORTS_PER_SOL)
        const ix = SystemProgram.transfer({ fromPubkey: sender.publicKey, toPubkey: to, lamports })
        const tx = new Transaction().add(ix)
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash
        tx.feePayer = sender.publicKey
        tx.sign(sender)
        const signature = await connection.sendRawTransaction(tx.serialize())
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
        setSig(signature)
        setExplorerUrl(`https://explorer.solana.com/tx/${signature}?cluster=devnet`)
        await refreshBalance()
        setStatus('Transfer confirmed')
      } catch (e: any) {
        setStatus(`Transfer failed: ${e?.message ?? e}`)
      }
    }
  }

  const handleAddWatch = async () => {
    try {
      const addr = copySearch.trim()
      const pk = new PublicKey(addr)
      const base58 = pk.toBase58()
      try {
        await jsonFetch(`/api/watchlist`, { method: 'POST', body: JSON.stringify({ address: base58 }) })
      } catch { /* ignore backend errors */ }
      if (!watchlist.includes(base58)) setWatchlist((w) => [...w, base58])
      setCopySearch('')
      setStatus('')
    } catch {
      setStatus('Invalid address. Paste a valid Solana public key (base58).')
      setTimeout(() => setStatus(''), 4000)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text)
      setStatus('Copied to clipboard')
      setTimeout(() => setStatus(''), 1500)
    } catch {}
  }

  const removeWatch = async (addr: string) => {
    try { await jsonFetch(`/api/watchlist?address=${encodeURIComponent(addr)}`, { method: 'DELETE' }) } catch { /* ignore */ }
    setWatchlist((w) => w.filter((a) => a !== addr))
  }

  useEffect(() => {
    (async () => {
      try {
        const resp = await jsonFetch<{ watchlist?: string[] }>(`/api/watchlist`)
        if (Array.isArray(resp.watchlist)) setWatchlist(resp.watchlist)
      } catch { /* ignore */ }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!address) { setReceiveQr(''); return }
      try {
        const dataUrl = await QRCode.toDataURL(`solana:${address}`)
        setReceiveQr(dataUrl)
      } catch {
        try {
          const dataUrl = await QRCode.toDataURL(address)
          setReceiveQr(dataUrl)
        } catch { setReceiveQr('') }
      }
    })()
  }, [address])

  return (
    <div className="container">
      <div className="header">
        <div className="title">Wristkey Global Solutions Wallet</div>
        <div className="subtle">Cluster: devnet</div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card stack">
          <div className="label">Copy trading wallets</div>
          <div className="row">
            <input className="input" placeholder="Search or paste wallet address" value={copySearch} onChange={(e) => setCopySearch(e.target.value)} />
            <button className="btn btn-primary" onClick={handleAddWatch}>Add</button>
          </div>
          <div className="stack">
            {watchlist.length === 0 ? (
              <div className="help">No wallets added yet. Paste an address and click Add.</div>
            ) : (
              watchlist.map((addr) => (
                <div key={addr} className="row-between">
                  <div className="value">{formatPubkeyStr(addr)}</div>
                  <div className="row">
                    <button className="btn" onClick={() => handleCopy(addr)}>Copy</button>
                    <a className="btn btn-secondary" href={`https://explorer.solana.com/address/${addr}?cluster=devnet`} target="_blank" rel="noreferrer">View</a>
                    <button className="btn btn-danger" onClick={() => removeWatch(addr)}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card stack">
          <div className="row">
            <button className="btn btn-primary" onClick={handleCreate}>Create Wallet</button>
            <button className="btn btn-secondary" onClick={refreshBalance} disabled={!keypair}>Refresh</button>
            <button className="btn" onClick={handleAirdrop} disabled={!keypair}>Airdrop 1 SOL</button>
          </div>

          <div className="kv">
            <div className="label">Address</div>
            <div className="value">{formatPubkey(keypair?.publicKey)}</div>
          </div>
          <div className="kv">
            <div className="label">Balance</div>
            <div className="value">{balance ?? '-'} SOL</div>
          </div>

          <div className="stack">
            <div className="label">Import key</div>
            <input className="input" placeholder="Base64 64-byte secret or JSON array of 64 numbers" value={secret} onChange={(e) => setSecret(e.target.value)} />
            <div className="row">
              <button className="btn" onClick={handleImport}>Import</button>
              <div className="help">Tip: After Create Wallet, the box contains importable base64.</div>
            </div>
          </div>
          {status && (
            <div className="warn">
              {status.endsWith('-pending') ? 'Airdrop requested, awaiting confirmation… (hit Refresh)' : status}
            </div>
          )}
        </div>

        <div className="card stack">
          <div className="label">Send SOL</div>
          <input className="input" placeholder="Recipient address" value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
          <div className="row">
            <input className="input" style={{ width: 180 }} placeholder="Amount (SOL)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn btn-primary" onClick={handleSend} disabled={!keypair}>Send</button>
          </div>
          {sig && (
            <div className="kv">
              <div className="label">Recent tx</div>
              <a className="link" href={explorerUrl || `https://explorer.solana.com/tx/${sig}?cluster=devnet`} target="_blank" rel="noreferrer">{formatPubkeyStr(sig)}</a>
            </div>
          )}
        </div>

        <div className="card stack">
          <div className="label">Receive SOL</div>
          {!address ? (
            <div className="help">Create or import a wallet to receive funds.</div>
          ) : (
            <>
              <div className="kv">
                <div className="label">Your address</div>
                <div className="value" style={{ wordBreak: 'break-all' }}>{address}</div>
              </div>
              {receiveQr && (
                <img src={receiveQr} alt="Receive QR" style={{ width: 220, height: 220, imageRendering: 'pixelated', borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)' }} />
              )}
              <div className="row">
                <button className="btn" onClick={() => handleCopy(address)}>Copy address</button>
                <a className="btn btn-secondary" href={`https://explorer.solana.com/address/${address}?cluster=devnet`} target="_blank" rel="noreferrer">View on Explorer</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
