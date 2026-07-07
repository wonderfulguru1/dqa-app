/** Pregnancy / breastfeeding status codes (DQA reference list). */

export const PREGNANCY_STATUS_OPTIONS = [
  { code: 'P', label: 'Pregnant' },
  { code: 'BF', label: 'Breastfeeding' },
  { code: 'NP', label: 'Not Pregnant' },
  { code: 'NP', label: 'NP' },
]

export function formatPregnancyStatus({ label }) {
  return label
}

const LABEL_ALIASES = new Map([
  ['p', 'Pregnant'],
  ['pregnant', 'Pregnant'],
  ['bf', 'Breastfeeding'],
  ['breastfeeding', 'Breastfeeding'],
  ['breast feeding', 'Breastfeeding'],
  ['not pregnant', 'Not Pregnant'],
  ['not-pregnant', 'Not Pregnant'],
])

export function findPregnancyStatusByValue(value) {
  const v = String(value || '').trim()
  if (!v) return null
  const lower = v.toLowerCase()

  for (const opt of PREGNANCY_STATUS_OPTIONS) {
    if (lower === opt.label.toLowerCase()) return opt
  }

  if (lower === 'np') {
    return PREGNANCY_STATUS_OPTIONS.find(o => o.label === 'NP') || null
  }

  const aliasLabel = LABEL_ALIASES.get(lower)
  if (aliasLabel) {
    return PREGNANCY_STATUS_OPTIONS.find(o => o.label === aliasLabel) || null
  }

  for (const opt of PREGNANCY_STATUS_OPTIONS) {
    if (
      lower === opt.code.toLowerCase() ||
      lower === `${opt.code} = ${opt.label}`.toLowerCase()
    ) {
      return opt
    }
  }
  return null
}

/** Dropdown / display value (description label). */
export function resolvePregnancyStatusSelectValue(value) {
  const match = findPregnancyStatusByValue(value)
  return match ? match.label : String(value || '').trim()
}

/** Canonical code for EMR vs folder matching (P, BF, NP). */
export function normalizePregnancyStatus(value) {
  const match = findPregnancyStatusByValue(value)
  return match ? match.code : String(value || '').trim()
}
