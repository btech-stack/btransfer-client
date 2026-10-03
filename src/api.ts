// HTTP-client voor de BTransfer-API. Werkt in de browser en in Node 20+ (globale fetch).

export type Tier = 'FREE' | 'PAID'

export interface TierInfo {
  maxPlaintextBytes: number
  expiryDays: number[]
}

export interface ServerConfig {
  chunkSize: number
  free: TierInfo
  paid: TierInfo
  /** Gratis cellen die tegelijk in gebruik mogen zijn. */
  freeMaxActiveCells: number
  /** 1 cel = zoveel bytes (100 MB) voor de kortste termijn. */
  cellBytes: number
  cellPriceCents: number
  /** Cellen per `cellBytes` per bewaartermijn in dagen, bijvoorbeeld { "7": 1, "30": 2 }. */
  cellsPerTerm: Record<string, number>
  sandbox: boolean
  /** Productie vóór de lancering: alleen beheerders kunnen versturen. */
  prelaunch?: boolean
  oidc: { authority: string; clientId: string }
}

export interface Quote {
  tier: Tier
  cells: number
  priceCents: number
  balanceCents: number
  allowed: boolean
  reason?: string
  shortfallCents: number
}

export interface PresignedUrl {
  index: number
  url: string
}

export interface CreateTransferResponse {
  id: string
  chunkSize: number
  manifestUploadUrl: string
  expiresAt: string
  cells: number
  priceCents: number
}

export interface CompleteResponse {
  storedBytes: number
  objectCount: number
  /** Aanwezig als het e-mailadres van het account bevestigd is; anders gaat de link per mail. */
  downloadToken?: string
}

export interface DownloadInfo {
  status: string
  chunkCount: number
  plaintextBytes: number
  storedBytes: number
  expiresAt: string
  storageLabel: string
  manifestUrl: string
}

export interface LedgerEntry {
  id: number
  amountCents: number
  kind: string
  description: string
  transferId: string | null
  createdAt: string
}

export interface TransferSummary {
  id: string
  createdAt: string
  expiresAt: string
  status: string
  destroyReason: string | null
  tier: Tier
  plaintextBytes: number
  cells: number
  priceCents: number
  downloadedAt: string | null
  destroyedAt: string | null
  /** Waar de versleutelde stukken stonden (bewijs). */
  storageLabel?: string | null
}

export interface PaymentView {
  id: string
  createdAt: string | null
  paidAt: string | null
  netCents: number
  grossCents: number
  cells: number
  status: 'paid' | 'refunded' | string
  /** Tot wanneer terugbetalen kan (herroeping, alleen bij volledig ongebruikt tegoed); null = niet mogelijk. */
  refundableUntil: string | null
}

export interface Account {
  email: string
  emailVerified: boolean
  isAdmin: boolean
  balanceCents: number
  paidCells: number
  freeCells: number
  freeCellsInUse: number
  freeActiveBytes: number
  freeMaxActiveBytes: number
  topUpOptionsCents: number[]
  vatPercent: number
  paymentsEnabled: boolean
  payments: PaymentView[]
  ledger: LedgerEntry[]
  transfers: TransferSummary[]
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/**
 * Maakt een API-client.
 * @param baseUrl bijvoorbeeld `https://playground.btransfer.nl`; leeg in de browser op dezelfde host.
 * @param token API-sleutel (`btk_…`) of OIDC-access-token; als functie wordt hij per verzoek opgehaald.
 */
export function createApi(baseUrl = '', token?: string | (() => string | undefined)) {
  const getToken = typeof token === 'function' ? token : () => token

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const t = getToken()
    const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(baseUrl + '/api' + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const msg = await res.json().then((j) => j.error).catch(() => res.statusText)
      throw new ApiError(res.status, msg || `HTTP ${res.status}`)
    }
    return res.status === 204 ? (undefined as T) : res.json()
  }

  return {
    config: () => call<ServerConfig>('GET', '/config'),

    account: () => call<Account>('GET', '/account'),
    topUp: (netCents: number) => call<{ checkoutUrl: string }>('POST', '/account/topups', { netCents }),
    /** Herroeping: opwaardering volledig terugbetalen (binnen 14 dagen, tegoed nog ongebruikt). */
    refund: (paymentId: string) => call<void>('POST', `/account/payments/${paymentId}/refund`),
    testCredit: (cents: number) => call<void>('POST', '/account/test-credit', { cents }),
    /** Je geschiedenis binnen de bewaartermijn (2 jaar), nieuwste eerst. */
    history: () => call<TransferSummary[]>('GET', '/account/history'),
    /** Al je gegevens als JSON (zonder bestandsinhoud: die kunnen we niet lezen). */
    exportAccount: () => call<unknown>('GET', '/account/export'),
    /** Stuurt een bevestigingslink om je account te wissen. */
    requestWipe: () => call<void>('POST', '/account/wipe-request'),
    /** Wist je account definitief, met het token uit de bevestigingsmail. */
    wipe: (token: string) => call<void>('POST', '/account/wipe', { token }),
    apiKeys: () => call<ApiKey[]>('GET', '/account/api-keys'),
    createApiKey: (name: string) => call<ApiKey & { key: string }>('POST', '/account/api-keys', { name }),
    revokeApiKey: (id: string) => call<void>('DELETE', `/account/api-keys/${id}`),

    quote: (body: { tier: Tier; expiryDays: number; plaintextBytes: number }) => call<Quote>('POST', '/quote', body),
    createTransfer: (body: { tier: Tier; expiryDays: number; chunkCount: number; plaintextBytes: number }) =>
      call<CreateTransferResponse>('POST', '/transfers', body),
    uploadUrls: (id: string, from: number, count: number) => call<PresignedUrl[]>('POST', `/transfers/${id}/upload-urls`, { from, count }),
    complete: (id: string, uploadMs: number) => call<CompleteResponse>('POST', `/transfers/${id}/complete`, { uploadMs }),
    /** Nieuwe downloadlink als de ontvanger niet bevestigde; het oude token vervalt. Max 3 keer. */
    newLink: (id: string) => call<{ downloadToken: string; newLinksLeft: number }>('POST', `/transfers/${id}/new-link`),
    reveal: (id: string, revealToken: string) => call<{ downloadToken: string }>('POST', `/transfers/${id}/reveal`, { revealToken }),

    downloadInfo: (token: string) => call<DownloadInfo>('GET', `/d/${token}`),
    downloadUrls: (token: string, from: number, count: number) => call<PresignedUrl[]>('POST', `/d/${token}/download-urls`, { from, count }),
    downloaded: (token: string, downloadMs: number) => call<void>('POST', `/d/${token}/downloaded`, { downloadMs }),
    confirm: (token: string) => call<void>('POST', `/d/${token}/confirm`),
    /** Misbruik melden: de link wordt direct geblokkeerd. */
    report: (token: string, reason: string, email?: string) => call<void>('POST', `/d/${token}/report`, { reason, email }),
  }
}

export type Api = ReturnType<typeof createApi>
