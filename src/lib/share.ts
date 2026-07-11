import { defaultScenario, type LoanScenario } from '../domain/loan'

const VERSION = 'v1'
const MAX_FRAGMENT_LENGTH = 8_000

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const fromBase64Url = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export const encodeScenario = (scenario: LoanScenario) => {
  const fragment = `${VERSION}=${toBase64Url(JSON.stringify(scenario))}`
  if (fragment.length > MAX_FRAGMENT_LENGTH) {
    throw new Error('This scenario is too large to share. Remove some dated OD transactions.')
  }
  return fragment
}

export const decodeScenario = (hash: string): LoanScenario | null => {
  const fragment = hash.replace(/^#/, '')
  if (!fragment || fragment.length > MAX_FRAGMENT_LENGTH || !fragment.startsWith(`${VERSION}=`)) return null
  try {
    const parsed = JSON.parse(fromBase64Url(fragment.slice(VERSION.length + 1))) as Partial<LoanScenario>
    const defaults = defaultScenario()
    return {
      ...defaults,
      ...parsed,
      rateChanges: Array.isArray(parsed.rateChanges) ? parsed.rateChanges : [],
      prepayments: Array.isArray(parsed.prepayments) ? parsed.prepayments : [],
      od: {
        ...defaults.od,
        ...(parsed.od ?? {}),
        transactions: Array.isArray(parsed.od?.transactions) ? parsed.od.transactions : [],
      },
    }
  } catch {
    return null
  }
}

export const scenarioUrl = (scenario: LoanScenario) => {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  base.hash = encodeScenario(scenario)
  return base.toString()
}

export const copyScenarioUrl = async (scenario: LoanScenario) => {
  const url = scenarioUrl(scenario)
  await navigator.clipboard.writeText(url)
  return url
}
