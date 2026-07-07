/** Standard ART regimen lines and regimens (Nigeria DQA reference list). */

const SEP = ' – '

export const REGIMEN_GROUPS = [
  {
    line: 'Adult 1st line ARV regimen',
    regimens: [
      `TDF${SEP}3TC${SEP}DTG`,
      `TDF${SEP}FTC${SEP}DTG`,
      `TDF${SEP}3TC${SEP}EFV 400`,
      `TDF${SEP}FTC${SEP}EFV 400`,
      `ABC${SEP}3TC${SEP}DTG`,
      `TDF${SEP}3TC${SEP}EFV`,
      `TDF${SEP}FTC${SEP}EFV`,
      `TAF${SEP}3TC${SEP}DTG`,
      `TAF${SEP}FTC${SEP}DTG`,
      `TDF${SEP}3TC${SEP}RAL`,
      `TDF${SEP}FTC${SEP}RAL`,
    ],
  },
  {
    line: 'Adult 2nd line ARV regimen',
    regimens: [
      `AZT${SEP}3TC${SEP}ATV/r`,
      `TDF${SEP}3TC${SEP}ATV/r`,
      `TDF${SEP}3TC${SEP}LPV/r`,
      `AZT${SEP}3TC${SEP}LPV/r`,
      `AZT${SEP}TDF${SEP}3TC${SEP}ATV/r`,
      `AZT${SEP}TDF${SEP}3TC${SEP}LPV/r`,
      `TDF${SEP}3TC${SEP}DTG`,
      `AZT${SEP}3TC${SEP}DRV/r`,
      `TDF${SEP}3TC${SEP}DRV/r`,
      `AZT${SEP}3TC${SEP}LPV/r${SEP}DTG`,
    ],
  },
  {
    line: 'Adult 3rd line ARV regimen',
    regimens: [
      `DRV/r${SEP}DTG ± 1-2 NRTIs`,
      `DRV/r${SEP}2NRTIs ± ETV`,
    ],
  },
  {
    line: 'Child 1st line ARV regimen',
    regimens: [
      `TDF${SEP}3TC${SEP}DTG`,
      `TDF${SEP}FTC${SEP}DTG`,
      `ABC${SEP}3TC${SEP}DTG`,
      `ABC${SEP}FTC${SEP}DTG`,
      `ABC${SEP}3TC${SEP}LPV/r`,
      `TDF${SEP}3TC${SEP}EFV400`,
      `TDF${SEP}FTC${SEP}EFV400`,
      `AZT${SEP}3TC${SEP}LPV/r`,
      `ABC${SEP}3TC${SEP}EFV400`,
      `ABC${SEP}FTC${SEP}EFV400`,
      `AZT${SEP}3TC${SEP}RAL`,
      `ABC${SEP}3TC${SEP}EFV`,
      `AZT${SEP}3TC${SEP}NVP`,
      `TAF${SEP}3TC${SEP}DTG`,
      `TAF${SEP}FTC${SEP}DTG`,
      `ABC${SEP}3TC${SEP}RAL`,
      `AZT${SEP}3TC${SEP}EFV 200 or 400`,
    ],
  },
  {
    line: 'Child 2nd line ARV regimen',
    regimens: [
      `AZT${SEP}3TC${SEP}LPV/r`,
      `AZT${SEP}3TC${SEP}ATV/r`,
      `TDF${SEP}3TC${SEP}ATV/r`,
      `TDF${SEP}3TC${SEP}LPV/r`,
      `AZT${SEP}3TC${SEP}RAL or DTG`,
      `ABC${SEP}3TC${SEP}RAL or DTG`,
      `ABC${SEP}3TC${SEP}LPV/r or pDRV/r`,
      `ABC${SEP}3TC${SEP}LPV/r or ATV/r`,
      `AZT${SEP}3TC${SEP}ATV/r or pDRV/r${SEP}or LPV/r`,
    ],
  },
  {
    line: 'Child 3rd line ARV regimen',
    regimens: [
      `DRV/r${SEP}DTG or RAL ± 1-2 NRTIs`,
      `DRV/r${SEP}2NRTIs ± ETV`,
    ],
  },
]

/** Previous dropdown labels — kept so saved rows and EMR values still resolve. */
const LEGACY_LINE_ALIASES = new Map([
  ['adult 1st-line regimens', 'Adult 1st line ARV regimen'],
  ['adult 1st line arv regimen', 'Adult 1st line ARV regimen'],
  ['adult 1st line', 'Adult 1st line ARV regimen'],
  ['1st line arv regimen', 'Adult 1st line ARV regimen'],
  ['adult 2nd-line regimens', 'Adult 2nd line ARV regimen'],
  ['adult 2nd line arv regimen', 'Adult 2nd line ARV regimen'],
  ['adult 2nd line', 'Adult 2nd line ARV regimen'],
  ['2nd line arv regimen', 'Adult 2nd line ARV regimen'],
  ['adult 3rd-line regimens', 'Adult 3rd line ARV regimen'],
  ['adult 3rd line arv regimen', 'Adult 3rd line ARV regimen'],
  ['adult 3rd line', 'Adult 3rd line ARV regimen'],
  ['3rd line arv regimen', 'Adult 3rd line ARV regimen'],
  ['paediatric 1st-line regimens', 'Child 1st line ARV regimen'],
  ['child 1st line arv regimen', 'Child 1st line ARV regimen'],
  ['child 1st line', 'Child 1st line ARV regimen'],
  ['paediatric 2nd-line regimens', 'Child 2nd line ARV regimen'],
  ['child 2nd line arv regimen', 'Child 2nd line ARV regimen'],
  ['child 2nd line', 'Child 2nd line ARV regimen'],
  ['paediatric 3rd-line regimens', 'Child 3rd line ARV regimen'],
  ['child 3rd line arv regimen', 'Child 3rd line ARV regimen'],
  ['child 3rd line', 'Child 3rd line ARV regimen'],
])

/** Legacy coded labels from the earlier list (e.g. "1a = TDF – 3TC – DTG"). */
const LEGACY_CODED_REGIMENS = new Map([
  ['1a', `TDF${SEP}3TC${SEP}DTG`],
  ['1aa', `TDF${SEP}FTC${SEP}DTG`],
  ['1b', `TDF${SEP}3TC${SEP}EFV 400`],
  ['1bb', `TDF${SEP}FTC${SEP}EFV 400`],
  ['1c', `ABC${SEP}3TC${SEP}DTG`],
  ['1d', `TDF${SEP}3TC${SEP}EFV`],
  ['1dd', `TDF${SEP}FTC${SEP}EFV`],
  ['1e', `TAF${SEP}3TC${SEP}DTG`],
  ['1ee', `TAF${SEP}FTC${SEP}DTG`],
  ['1f', `TDF${SEP}3TC${SEP}RAL`],
  ['1ff', `TDF${SEP}FTC${SEP}RAL`],
  ['2a', `AZT${SEP}3TC${SEP}ATV/r`],
  ['2b', `TDF${SEP}3TC${SEP}ATV/r`],
  ['2c', `TDF${SEP}3TC${SEP}LPV/r`],
  ['2d', `AZT${SEP}3TC${SEP}LPV/r`],
  ['2e', `AZT${SEP}TDF${SEP}3TC${SEP}ATV/r`],
  ['2f', `AZT${SEP}TDF${SEP}3TC${SEP}LPV/r`],
  ['2g', `TDF${SEP}3TC${SEP}DTG`],
  ['2h', `AZT${SEP}3TC${SEP}DRV/r`],
  ['2i', `TDF${SEP}3TC${SEP}DRV/r`],
  ['2j', `AZT${SEP}3TC${SEP}LPV/r${SEP}DTG`],
  ['3a', `DRV/r${SEP}DTG ± 1-2 NRTIs`],
  ['3b', `DRV/r${SEP}2NRTIs ± ETV`],
  ['4a', `TDF${SEP}3TC${SEP}DTG`],
  ['4aa', `TDF${SEP}FTC${SEP}DTG`],
  ['4b', `ABC${SEP}3TC${SEP}DTG`],
  ['4bb', `ABC${SEP}FTC${SEP}DTG`],
  ['4c', `ABC${SEP}3TC${SEP}LPV/r`],
  ['4d', `TDF${SEP}3TC${SEP}EFV400`],
  ['4dd', `TDF${SEP}FTC${SEP}EFV400`],
  ['4e', `AZT${SEP}3TC${SEP}LPV/r`],
  ['4f', `ABC${SEP}3TC${SEP}EFV400`],
  ['4ff', `ABC${SEP}FTC${SEP}EFV400`],
  ['4g', `AZT${SEP}3TC${SEP}RAL`],
  ['4h', `ABC${SEP}3TC${SEP}EFV`],
  ['4i', `AZT${SEP}3TC${SEP}NVP`],
  ['4j', `TAF${SEP}3TC${SEP}DTG`],
  ['4jj', `TAF${SEP}FTC${SEP}DTG`],
  ['4k', `ABC${SEP}3TC${SEP}RAL`],
  ['4l', `AZT${SEP}3TC${SEP}EFV 200 or 400`],
  ['5a', `AZT${SEP}3TC${SEP}LPV/r`],
  ['5b', `AZT${SEP}3TC${SEP}ATV/r`],
  ['5c', `TDF${SEP}3TC${SEP}ATV/r`],
  ['5d', `TDF${SEP}3TC${SEP}LPV/r`],
  ['5e', `AZT${SEP}3TC${SEP}RAL or DTG`],
  ['5f', `ABC${SEP}3TC${SEP}RAL or DTG`],
  ['5g', `ABC${SEP}3TC${SEP}LPV/r or pDRV/r`],
  ['5h', `ABC${SEP}3TC${SEP}LPV/r or ATV/r`],
  ['5i', `AZT${SEP}3TC${SEP}ATV/r or pDRV/r${SEP}or LPV/r`],
  ['6a', `DRV/r${SEP}DTG or RAL ± 1-2 NRTIs`],
  ['6b', `DRV/r${SEP}2NRTIs ± ETV`],
])

export const REGIMEN_LINE_OPTIONS = REGIMEN_GROUPS.map(g => g.line)

function normalizeLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed) return ''
  if (REGIMEN_LINE_OPTIONS.includes(trimmed)) return trimmed
  return LEGACY_LINE_ALIASES.get(trimmed.toLowerCase()) || trimmed
}

/** Match +, –, -, / separators and spacing variants when comparing regimen text. */
export function regimenMatchKey(text) {
  let s = String(text || '').trim().toLowerCase()
  s = s.replace(/^[a-z0-9]+\s*=\s*/, '')
  s = s.replace(/\s*\+\s*/g, '|')
  s = s.replace(/\s*[-–—]\s*/g, '|')
  s = s.replace(/\s+\/\s+/g, '|')
  s = s.replace(/\s*,\s*/g, '|')
  s = s.replace(/\s*\/\s*/g, '/')
  s = s.replace(/\|+/g, '|')
  s = s.replace(/\s+/g, '')
  return s
}

function normalizeRegimenText(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  const coded = LEGACY_CODED_REGIMENS.get(trimmed.toLowerCase())
  if (coded) return coded

  const eq = trimmed.match(/^[^=]+=\s*(.+)$/)
  if (eq) {
    const fromCode = LEGACY_CODED_REGIMENS.get(trimmed.split('=')[0].trim().toLowerCase())
    if (fromCode) return fromCode
    return eq[1].trim()
      .replace(/\s*\+\s*/g, SEP)
      .replace(/\s+[-–—]\s+/g, SEP)
      .replace(/\s*[-–—]\s*/g, SEP)
      .replace(/\s+\/\s+/g, SEP)
      .replace(/\s*,\s*/g, SEP)
  }

  for (const group of REGIMEN_GROUPS) {
    for (const regimen of group.regimens) {
      if (regimenMatchKey(regimen) === regimenMatchKey(trimmed)) return regimen
    }
  }

  return trimmed
    .replace(/\s*\+\s*/g, SEP)
    .replace(/\s+[-–—]\s+/g, SEP)
    .replace(/\s*[-–—]\s*/g, SEP)
    .replace(/\s+\/\s+/g, SEP)
    .replace(/\s*,\s*/g, SEP)
}

export function formatRegimen(regimen) {
  if (typeof regimen === 'string') return regimen
  return regimen?.drugs || regimen?.label || ''
}

export function allRegimenOptions() {
  const out = []
  for (const group of REGIMEN_GROUPS) {
    for (const drugs of group.regimens) {
      out.push({ line: group.line, drugs, label: drugs })
    }
  }
  return out
}

export function regimensForLine(line) {
  const normalizedLine = normalizeLine(line)
  const group = REGIMEN_GROUPS.find(g => g.line === normalizedLine)
  if (!group) return []
  return group.regimens.map(drugs => ({
    line: group.line,
    drugs,
    label: drugs,
  }))
}

export function findRegimenByValue(value) {
  const key = regimenMatchKey(normalizeRegimenText(value))
  if (!key) return null

  for (const group of REGIMEN_GROUPS) {
    for (const regimen of group.regimens) {
      if (regimenMatchKey(regimen) === key) {
        return { line: group.line, drugs: regimen, label: regimen }
      }
    }
  }
  return null
}

/** True when two regimen strings mean the same drug combination. */
export function regimenValuesEquivalent(a, b) {
  const rawA = String(a || '').trim()
  const rawB = String(b || '').trim()
  if (!rawA && !rawB) return true
  if (!rawA || !rawB) return false

  const matchA = findRegimenByValue(rawA)
  const matchB = findRegimenByValue(rawB)
  if (matchA && matchB) return matchA.label === matchB.label

  return regimenMatchKey(normalizeRegimenText(rawA)) === regimenMatchKey(normalizeRegimenText(rawB))
}

/** True when two regimen line strings mean the same line category. */
export function regimenLineValuesEquivalent(lineA, lineB, regimenA = '', regimenB = '') {
  const a = resolveRegimenLineSelectValue(lineA, regimenA)
  const b = resolveRegimenLineSelectValue(lineB, regimenB)
  if (!a && !b) return true
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

export function lineForRegimenValue(value) {
  return findRegimenByValue(value)?.line || ''
}

/** Map a saved/EMR regimen string to the standard dropdown label. */
export function resolveRegimenSelectValue(value) {
  const match = findRegimenByValue(value)
  return match ? match.label : normalizeRegimenText(value)
}

export function resolveRegimenLineSelectValue(lineValue, regimenValue) {
  const line = normalizeLine(lineValue)
  if (line && REGIMEN_LINE_OPTIONS.includes(line)) return line
  return lineForRegimenValue(regimenValue) || line
}
