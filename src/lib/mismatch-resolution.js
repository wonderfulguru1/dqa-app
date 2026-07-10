export const RESOLUTION_STATUS_OPTIONS = ['Pending', 'Ongoing', 'Completed']

export const EMPTY_MISMATCH_RESOLUTION = {
  gap: '',
  whyGapExists: '',
  proposedSolution: '',
  expectedResult: '',
  requiredResources: '',
  dueDate: '',
  status: 'Pending',
  otherComments: '',
}

const LEGACY_REMARKS_START = '---DQA_MISMATCH_RESOLUTIONS---'
const LEGACY_REMARKS_END = '---END_DQA_MISMATCH_RESOLUTIONS---'

export function normalizeResolutionStatus(value) {
  const s = String(value || '').trim()
  if (s === 'In Progress') return 'Ongoing'
  return RESOLUTION_STATUS_OPTIONS.includes(s) ? s : 'Pending'
}

export function isResolutionComplete(resolution) {
  return !!String(resolution?.gap || '').trim()
}

export function normalizeResolutionMap(resolutions) {
  if (!resolutions || typeof resolutions !== 'object' || Array.isArray(resolutions)) return {}
  const out = {}
  for (const [key, value] of Object.entries(resolutions)) {
    if (!value || typeof value !== 'object') continue
    out[key] = normalizeSingleResolution(value)
  }
  return out
}

export function normalizeSingleResolution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return {
    gap: String(value.gap || ''),
    whyGapExists: String(value.whyGapExists || ''),
    proposedSolution: String(value.proposedSolution || ''),
    expectedResult: String(value.expectedResult || ''),
    requiredResources: String(value.requiredResources || ''),
    dueDate: String(value.dueDate || ''),
    status: normalizeResolutionStatus(value.status),
    otherComments: String(value.otherComments || ''),
  }
}

export function splitRemarksAndResolutions(remarks) {
  const text = String(remarks || '')
  const start = text.indexOf(LEGACY_REMARKS_START)
  if (start === -1) {
    return { remarks: text.trim(), resolutions: {} }
  }
  const end = text.indexOf(LEGACY_REMARKS_END)
  const userRemarks = text.slice(0, start).trim()
  if (end === -1) return { remarks: userRemarks, resolutions: {} }
  const block = text.slice(start + LEGACY_REMARKS_START.length, end).trim()
  let resolutions = {}
  try {
    resolutions = normalizeResolutionMap(JSON.parse(block))
  } catch {
    resolutions = {}
  }
  return { remarks: userRemarks, resolutions }
}

export function parseStoredMismatchResolutions(record) {
  if (!record) return {}
  const raw = record.mismatchResolutions ?? record.mismatchResolution
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeResolutionMap(raw)
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeResolutionMap(JSON.parse(raw))
    } catch {
      return {}
    }
  }
  return splitRemarksAndResolutions(record.remarks).resolutions
}

export function formatMismatchResolutionsForRemarks(resolutions, rows) {
  const lines = []
  for (const row of rows) {
    const resolution = resolutions[row.key]
    if (!resolution || !isResolutionComplete(resolution)) continue
    lines.push(`[${row.label}]`)
    if (resolution.gap) lines.push(`Issues/gaps: ${resolution.gap}`)
    if (resolution.whyGapExists) lines.push(`Why: ${resolution.whyGapExists}`)
    if (resolution.proposedSolution) lines.push(`Proposed solution: ${resolution.proposedSolution}`)
    if (resolution.expectedResult) lines.push(`Expected result: ${resolution.expectedResult}`)
    if (resolution.requiredResources) lines.push(`Required resources: ${resolution.requiredResources}`)
    if (resolution.dueDate) lines.push(`Due date: ${resolution.dueDate}`)
    if (resolution.status) lines.push(`Status: ${resolution.status}`)
    if (resolution.otherComments) lines.push(`Responsible person(s): ${resolution.otherComments}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
