const ones = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
] as const

const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

const belowThousand = (value: number): string => {
  if (value < 20) return ones[value] ?? ''
  if (value < 100) {
    const remainder = value % 10
    return `${tens[Math.floor(value / 10)]}${remainder ? `-${ones[remainder]}` : ''}`
  }
  const remainder = value % 100
  return `${ones[Math.floor(value / 100)]} hundred${remainder ? ` ${belowThousand(remainder)}` : ''}`
}

const integerToIndianWords = (value: number): string => {
  if (value === 0) return 'zero'
  const parts: string[] = []
  let remaining = value
  const crore = Math.floor(remaining / 10_000_000)
  if (crore) {
    parts.push(`${belowThousand(crore)} crore`)
    remaining %= 10_000_000
  }
  const lakh = Math.floor(remaining / 100_000)
  if (lakh) {
    parts.push(`${belowThousand(lakh)} lakh`)
    remaining %= 100_000
  }
  const thousand = Math.floor(remaining / 1_000)
  if (thousand) {
    parts.push(`${belowThousand(thousand)} thousand`)
    remaining %= 1_000
  }
  if (remaining) parts.push(belowThousand(remaining))
  return parts.join(' ')
}

const indianNumber = new Intl.NumberFormat('en-IN', {
  useGrouping: true,
  maximumFractionDigits: 20,
})

export const formatIndianAmountInput = (value: number) =>
  Number.isFinite(value) ? indianNumber.format(value) : ''

export const parseNumericDraft = (draft: string) => {
  const normalized = draft.replaceAll(',', '').trim()
  if (!normalized || !/^\d+(?:\.\d*)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export const formatAmountHelper = (value: number, equivalent = false) => {
  if (!Number.isFinite(value) || value < 0) return null
  const roundedRupees = Math.round(value)
  const words = integerToIndianWords(roundedRupees)
  const sentence = `${words[0]?.toUpperCase()}${words.slice(1)} rupees`
  return `${equivalent ? 'Equivalent: ' : ''}₹${formatIndianAmountInput(value)} · ${sentence}`
}
