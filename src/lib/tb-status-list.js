/** Standard TB status codes and labels (DQA reference list). */

export const TB_STATUS_OPTIONS = [
  { code: '1', label: 'No signs or symptoms of disease' },
  { code: '2', label: 'Disease suspected' },
  { code: '3', label: 'Currently on INH prophylaxis' },
  { code: '4', label: 'Disease diagnosed' },
  { code: '5', label: 'Confirmed with GeneXpert' },
  { code: '6', label: 'Confirmed with CXR' },
  { code: '7', label: 'Confirmed with LF LAM' },
  { code: '8', label: 'On treatment for disease' },
]

export function formatTbStatus({ label }) {
  return label
}

const LABEL_ALIASES = new Map([
  ['no signs', 'No signs or symptoms of disease'],
  ['no signs or symptoms of disease', 'No signs or symptoms of disease'],
  ['presumptive tb', 'Disease suspected'],
  ['disease suspected', 'Disease suspected'],
  ['tpt', 'Currently on INH prophylaxis'],
  ['currently on inh prophylaxis', 'Currently on INH prophylaxis'],
  ['confirmed tb', 'Disease diagnosed'],
  ['disease diagnosed', 'Disease diagnosed'],
  ['confirmed with genexper', 'Confirmed with GeneXpert'],
  ['confirmed with genexpert', 'Confirmed with GeneXpert'],
  ['genexper', 'Confirmed with GeneXpert'],
  ['genexpert', 'Confirmed with GeneXpert'],
  ['confirmed with cxr', 'Confirmed with CXR'],
  ['confirmed with lf lam', 'Confirmed with LF LAM'],
  ['tb treatment', 'On treatment for disease'],
  ['on treatment for disease', 'On treatment for disease'],
])

export function findTbStatusByValue(value) {
  const v = String(value || '').trim()
  if (!v) return null
  const lower = v.toLowerCase()

  const aliasLabel = LABEL_ALIASES.get(lower)
  if (aliasLabel) {
    const match = TB_STATUS_OPTIONS.find(o => o.label === aliasLabel)
    if (match) return { ...match, display: formatTbStatus(match) }
  }

  for (const opt of TB_STATUS_OPTIONS) {
    const display = formatTbStatus(opt)
    if (
      lower === display.toLowerCase() ||
      lower === opt.code ||
      lower === opt.label.toLowerCase() ||
      lower === `${opt.code} = ${opt.label}`.toLowerCase()
    ) {
      return { ...opt, display }
    }
  }
  return null
}

export function resolveTbStatusSelectValue(value) {
  const match = findTbStatusByValue(value)
  return match ? match.label : String(value || '').trim()
}

/** Normalize code/label variants for folder vs EMR comparison. */
export function normalizeTbStatus(value) {
  return resolveTbStatusSelectValue(value)
}
