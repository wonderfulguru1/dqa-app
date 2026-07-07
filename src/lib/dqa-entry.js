import { normalizeTbStatus } from './tb-status-list'
import { normalizePregnancyStatus } from './pregnancy-status-list'
import { normalizeResolutionMap, splitRemarksAndResolutions, normalizeSingleResolution } from './mismatch-resolution'
import { resolveRegimenLineSelectValue, resolveRegimenSelectValue, regimenLineValuesEquivalent, regimenValuesEquivalent, findRegimenByValue, REGIMEN_LINE_OPTIONS } from './regimen-list'

export const TX_FIELDS = [
  { key: 'sex', label: 'Sex', emr: 'sex', folder: 'folderSex' },
  { key: 'ageatstartofart', label: 'Age at start of ART', emr: 'ageatstartofart', folder: 'folderAge' },
  { key: 'artStartDate', label: 'ART start date', emr: 'artStartDate', folder: 'folderArtStart', date: true },
  { key: 'regimenLineAtArtStart', label: 'Regimen line at ART start', emr: 'regimenLineAtArtStart', folder: 'folderRegLine', normalize: 'regimenLine' },
  { key: 'regimenAtArtStart', label: 'Regimen at ART start', emr: 'regimenAtArtStart', folder: 'folderRegStart', normalize: 'regimen' },
  { key: 'pharmacyLastPickupdate', label: 'Pharmacy last pickup', emr: 'pharmacyLastPickupdate', folder: 'folderPickup', date: true },
  { key: 'daysOfArvRefill', label: 'Days of ARV refill', emr: 'daysOfArvRefill', folder: 'folderRefill' },
  { key: 'currentTbStatus', label: 'Current TB status', emr: 'currentTbStatus', folder: 'folderTb', normalize: 'tbStatus' },
  { key: 'currentPregnancyStatus', label: 'Current pregnancy status', emr: 'currentPregnancyStatus', folder: 'folderPreg', normalize: 'pregnancyStatus' },
]

function pad2(n) { return String(n).padStart(2, '0') }

export function dateToYmdLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function normalizeDateText(v) {
  if (v === undefined || v === null || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const serial = Math.floor(v)
    const excelEpoch = Date.UTC(1899, 11, 30)
    const d = new Date(excelEpoch + serial * 86400000)
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    if (a > 12) return `${m[3]}-${pad2(b)}-${pad2(a)}`
    return `${m[3]}-${pad2(a)}-${pad2(b)}`
  }
  const monMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2}|\d{4})$/)
  if (m) {
    const day = Number(m[1])
    const mon = monMap[m[2].slice(0, 3).toLowerCase()]
    if (mon) {
      let yr = Number(m[3])
      if (m[3].length === 2) yr = yr >= 50 ? 1900 + yr : 2000 + yr
      return `${yr}-${pad2(mon)}-${pad2(day)}`
    }
  }
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return dateToYmdLocal(parsed)
  return s
}

export function parseDateOnly(v) {
  const s = normalizeDateText(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
}

export function fmtDate(v) { return normalizeDateText(v) }

export function getAny(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  return ''
}

function isRegimenLineText(value) {
  const s = String(value || '').trim()
  if (!s) return false
  if (findRegimenByValue(s)) return false
  const resolved = resolveRegimenLineSelectValue(s, '')
  return REGIMEN_LINE_OPTIONS.includes(resolved)
}

function getRegimenLineAtArtStart(r) {
  const keys = ['regimenLineAtArtStart', 'RegimenLineAtARTStart_EMR', 'RegimenLineAtARTStart', 'Regimen Line', 'Regimen Line at ART Start']
  for (const k of keys) {
    const v = r?.[k]
    if (v === undefined || v === null || v === '') continue
    const s = String(v).trim()
    if (findRegimenByValue(s) && !isRegimenLineText(s)) continue
    return s
  }
  return ''
}

function getRegimenAtArtStart(r) {
  const keys = ['regimenAtArtStart', 'RegimenAtARTStart_EMR', 'RegimenAtARTStart', 'Regimen at ART Start', 'Regimen']
  for (const k of keys) {
    const v = r?.[k]
    if (v === undefined || v === null || v === '') continue
    const s = String(v).trim()
    if (isRegimenLineText(s) && !findRegimenByValue(s)) continue
    return s
  }
  return ''
}

export function canonicalTxRow(r) {
  return {
    dqaPeriod: getAny(r, ['DQA Period', 'DQAPeriod', 'Period', 'period', 'Quarter']),
    periodFy: getAny(r, ['Period_FY', 'period_FY', 'periodFy', 'Period FY', 'FY']),
    state: getAny(r, ['state', 'State', 'STATE', 'State Name', 'STATE_NAME']),
    lga: getAny(r, ['lga', 'LGA', 'Lga', 'LGA_NAME', 'LGA Name', 'County']),
    datimCode: getAny(r, ['datimCode', 'Datim_Code', 'datimcode', 'DATIM Code', 'DATIM', 'DATIM_CODE', 'Datim Code']),
    facilityName: getAny(r, ['facilityName', 'FacilityName', 'facility', 'Facility Name', 'Facility', 'FACILITY', 'Facility_Name']),
    patientId: getAny(r, ['patientId', 'patient_id', 'Patient ID', 'PatientId', 'PatientID']),
    pepId: getAny(r, ['pepId', 'PepID', 'pepID', 'PEP ID', 'PEPID']),
    patientHospitalNo: getAny(r, ['PatientHospitalNo', 'patientHospitalNo', 'patient_hospital_no', 'Patient Hospital No', 'HospitalNo']),
    sex: getAny(r, ['sex', 'Sex_EMR', 'Sex', 'Gender']),
    ageatstartofart: getAny(r, ['ageatstartofart', 'Ageatstartofart_EMR', 'Ageatstartofart', 'Age', 'Age at ART Start']),
    artStartDate: normalizeDateText(getAny(r, ['artStartDate', 'ARTStartDate_EMR', 'ARTStartDate', 'ART Start Date', 'ART Start'])),
    pharmacyLastPickupdate: normalizeDateText(getAny(r, ['pharmacyLastPickupdate', 'Pharmacy_LastPickupdate_EMR', 'Pharmacy_LastPickupdate', 'Last Pharmacy Pickup', 'Last Pickup Date'])),
    daysOfArvRefill: getAny(r, ['daysOfArvRefill', 'DaysOfARVRefill_EMR', 'DaysOfARVRefill', 'Days of ARV Refill', 'Days Refill']),
    regimenLineAtArtStart: getRegimenLineAtArtStart(r),
    regimenAtArtStart: getRegimenAtArtStart(r),
    currentTbStatus: getAny(r, ['currentTbStatus', 'Current_TB_Status_EMR', 'Current_TB_Status', 'TB Status', 'Current TB Status']),
    currentPregnancyStatus: getAny(r, ['currentPregnancyStatus', 'CurrentPregnancyStatus_EMR', 'CurrentPregnancyStatus', 'Pregnancy Status', 'Current Pregnancy Status']),
  }
}

export function canonicalAggRow(r) {
  const out = {
    dqaPeriod: getAny(r, ['DQA Period', 'Period', 'period', 'Quarter']),
    periodFy: getAny(r, ['Period_FY', 'period_FY', 'periodFy', 'Period FY', 'FY']),
    state: getAny(r, ['State', 'state', 'STATE']),
    lga: getAny(r, ['LGA', 'lga']),
    datimCode: getAny(r, ['Datim_Code', 'datimCode', 'DATIM Code', 'DATIM']),
    facilityName: getAny(r, ['FacilityName', 'facilityName', 'Facility Name', 'Facility']),
  }
  Object.keys(r || {}).forEach(k => { out[k] = r[k] })
  return out
}

export function norm(a) { return String(a ?? '').trim().toLowerCase() }

/** Effective assessor from a form field and/or the shared General controls value. */
export function resolveAssessor(localAssessor, globalAssessor) {
  return String(localAssessor ?? globalAssessor ?? '').trim()
}

export const ASSESSOR_REQUIRED_MSG = 'Assessor is required. Enter it on this form or in General controls at the top.'

function nullStrField(v) {
  if (v === undefined || v === null || v === '') return null
  return String(v)
}

/** Coerce TX validation payload types for Prisma (Excel may send numbers). */
export function normalizeTxValidationPayload(body) {
  const b = body || {}
  return {
    period: String(b.period || '').trim(),
    periodFy: nullStrField(b.periodFy),
    state: String(b.state || '').trim(),
    lga: nullStrField(b.lga),
    facilityName: String(b.facilityName || '').trim(),
    datimCode: nullStrField(b.datimCode),
    patientId: nullStrField(b.patientId),
    pepId: nullStrField(b.pepId),
    patientHospitalNo: nullStrField(b.patientHospitalNo),
    assessor: nullStrField(resolveAssessor(b.assessor, '')),
    assessmentDate: nullStrField(b.assessmentDate),
    recordFound: nullStrField(b.recordFound),
    emrSex: nullStrField(b.emrSex),
    emrAge: nullStrField(b.emrAge),
    emrArtStartDate: nullStrField(normalizeDateText(b.emrArtStartDate) || null),
    emrRegimenLine: nullStrField(b.emrRegimenLine),
    emrRegimen: nullStrField(b.emrRegimen),
    emrPharmacyPickup: nullStrField(normalizeDateText(b.emrPharmacyPickup) || null),
    emrDaysRefill: nullStrField(b.emrDaysRefill),
    emrTbStatus: nullStrField(b.emrTbStatus),
    emrPregnancy: nullStrField(b.emrPregnancy),
    folderSex: nullStrField(b.folderSex),
    folderAge: nullStrField(b.folderAge),
    folderArtStartDate: nullStrField(normalizeDateText(b.folderArtStartDate) || null),
    folderRegimenLine: nullStrField(b.folderRegimenLine),
    folderRegimen: nullStrField(b.folderRegimen),
    folderPharmacyPickup: nullStrField(normalizeDateText(b.folderPharmacyPickup) || null),
    folderDaysRefill: nullStrField(b.folderDaysRefill),
    folderTbStatus: nullStrField(b.folderTbStatus),
    folderPregnancy: nullStrField(b.folderPregnancy),
    folderCompleteCount: b.folderCompleteCount ?? null,
    folderCompletenessPct: b.folderCompletenessPct ?? null,
    matchCount: b.matchCount ?? null,
    concurrencePct: b.concurrencePct ?? null,
    emrOnlyCompleteCount: b.emrOnlyCompleteCount ?? null,
    emrOnlyPct: b.emrOnlyPct ?? null,
    pbsEmr: nullStrField(b.pbsEmr),
    pbsCompleteness: nullStrField(b.pbsCompleteness),
    recaptureEmr: nullStrField(b.recaptureEmr),
    recaptureCompleteness: nullStrField(b.recaptureCompleteness),
    recaptureDate: nullStrField(normalizeDateText(b.recaptureDate) || null),
    recaptureDateComplete: nullStrField(b.recaptureDateComplete),
    recaptureDateValid: nullStrField(b.recaptureDateValid),
    remarks: nullStrField(b.remarks),
    mismatchResolutions: (() => {
      const mapped = normalizeResolutionMap(b.mismatchResolutions)
      return Object.keys(mapped).length ? mapped : null
    })(),
  }
}

/** Coerce aggregate validation payload types for Prisma. */
export function normalizeAggValidationPayload(body) {
  const b = body || {}
  const mismatchResolution = normalizeSingleResolution(b.mismatchResolution)
  return {
    period: String(b.period || '').trim(),
    periodFy: nullStrField(b.periodFy),
    state: String(b.state || '').trim(),
    lga: nullStrField(b.lga),
    facilityName: String(b.facilityName || '').trim(),
    datimCode: nullStrField(b.datimCode),
    assessor: nullStrField(resolveAssessor(b.assessor, '')),
    assessmentDate: nullStrField(b.assessmentDate),
    indicator: String(b.indicator || '').trim(),
    reported: b.reported ?? null,
    validated: b.validated ?? null,
    concurrencePct: b.concurrencePct ?? null,
    classification: nullStrField(b.classification),
    mismatchResolution,
  }
}

export function same(folder, emr, isDate = false) {
  if (isDate) {
    const f = normalizeDateText(folder)
    const e = normalizeDateText(emr)
    if (!f && !e) return 'Both Missing'
    if (!f) return 'Missing in Folder'
    if (!e) return 'Missing in EMR'
    return f === e ? 'Match' : 'Mismatch'
  }
  if (!folder && !emr) return 'Both Missing'
  if (!folder) return 'Missing in Folder'
  if (!emr) return 'Missing in EMR'
  return norm(folder) === norm(emr) ? 'Match' : 'Mismatch'
}

export function recaptureCompleteness(recapture, dateVal) {
  if (!recapture) return ''
  if (recapture === 'No') return 'Not Required'
  return dateVal ? 'EMR Complete' : 'Missing in EMR'
}

export function recaptureValidation(artStart, recapture, recDate) {
  if (norm(recapture) === 'no') return 'Not required'
  if (!recDate) return ''
  const a = parseDateOnly(artStart)
  const r = parseDateOnly(recDate)
  if (!a || !r) return ''
  const diffDays = Math.round((r - a) / (1000 * 60 * 60 * 24))
  return diffDays >= 15 ? 'Valid' : 'Invalid'
}

export function detectAggIndicators(rows) {
  if (!rows?.length) return []
  const first = rows[0]
  if (first.Indicator || first.indicator) return null // long format — handled separately
  return Object.keys(first).filter(k => String(k).includes('(Reported)'))
}

export function unique(arr) { return [...new Set(arr.filter(Boolean))] }

function normalizeTxFieldValue(field, emr, folder, folderValues, txRow) {
  if (field.date) {
    return {
      emr: normalizeDateText(emr),
      folder: normalizeDateText(folder),
      isDate: true,
    }
  }
  if (field.normalize === 'tbStatus') {
    return { emr: normalizeTbStatus(emr), folder: normalizeTbStatus(folder), isDate: false }
  }
  if (field.normalize === 'pregnancyStatus') {
    return { emr: normalizePregnancyStatus(emr), folder: normalizePregnancyStatus(folder), isDate: false }
  }
  if (field.normalize === 'regimenLine') {
    return {
      emr: resolveRegimenLineSelectValue(emr, txRow?.regimenAtArtStart || ''),
      folder: resolveRegimenLineSelectValue(folder, folderValues?.folderRegStart || ''),
      isDate: false,
      regimenLineEquivalent: regimenLineValuesEquivalent(
        emr,
        folder,
        txRow?.regimenAtArtStart || '',
        folderValues?.folderRegStart || '',
      ),
    }
  }
  if (field.normalize === 'regimen') {
    return {
      emr: resolveRegimenSelectValue(emr),
      folder: resolveRegimenSelectValue(folder),
      isDate: false,
      regimenEquivalent: regimenValuesEquivalent(emr, folder),
    }
  }
  return { emr, folder, isDate: false }
}

export function compareTxField(fieldKey, txRow, folderValues) {
  const field = TX_FIELDS.find(f => f.key === fieldKey)
  if (!field) return ''
  const folder = folderValues[field.folder] || ''
  const emr = txRow ? txRow[field.emr] : ''
  const normalized = normalizeTxFieldValue(field, emr, folder, folderValues, txRow)
  if (field.normalize === 'regimen') {
    if (!String(emr || '').trim() && !String(folder || '').trim()) return ''
    if (!String(emr || '').trim()) return 'Missing in EMR'
    if (!String(folder || '').trim()) return 'Missing in Folder'
    return normalized.regimenEquivalent ? 'Match' : 'Mismatch'
  }
  if (field.normalize === 'regimenLine') {
    if (!String(emr || '').trim() && !String(folder || '').trim()) return ''
    if (!String(emr || '').trim()) return 'Missing in EMR'
    if (!String(folder || '').trim()) return 'Missing in Folder'
    return normalized.regimenLineEquivalent ? 'Match' : 'Mismatch'
  }
  if (!normalized.emr && !normalized.folder) return ''
  return same(normalized.folder, normalized.emr, normalized.isDate)
}

/** Rows for TX concurrence preview table (EMR vs folder per field). */
export function buildTxConcurrenceRows(txRow, folderValues) {
  return TX_FIELDS.map(f => {
    const normalized = normalizeTxFieldValue(
      f,
      txRow ? txRow[f.emr] : '',
      folderValues[f.folder] || '',
      folderValues,
      txRow,
    )
    const status = compareTxField(f.key, txRow, folderValues)
    return {
      key: f.key,
      label: f.label,
      emr: normalized.emr ? String(normalized.emr) : '—',
      folder: normalized.folder ? String(normalized.folder) : '—',
      status,
      isMismatch: status === 'Mismatch',
    }
  }).filter(r => r.status)
}

export function calcTxMetrics(txRow, folderValues, emrOnly) {
  let folderCount = 0, matchCount = 0
  TX_FIELDS.forEach(f => {
    let folder = folderValues[f.folder] || ''
    let emr = txRow ? txRow[f.emr] : ''
    const normalized = normalizeTxFieldValue(f, emr, folder, folderValues, txRow)
    folder = normalized.folder
    emr = normalized.emr
    if (folder) folderCount++
    if (f.normalize === 'regimen') {
      const rawEmr = txRow ? txRow[f.emr] : ''
      const rawFolder = folderValues[f.folder] || ''
      if (normalized.regimenEquivalent && String(rawEmr || '').trim() && String(rawFolder || '').trim()) matchCount++
    } else if (f.normalize === 'regimenLine') {
      const rawEmr = txRow ? txRow[f.emr] : ''
      const rawFolder = folderValues[f.folder] || ''
      if (normalized.regimenLineEquivalent && String(rawEmr || '').trim() && String(rawFolder || '').trim()) matchCount++
    } else if (same(folder, emr, normalized.isDate) === 'Match') {
      matchCount++
    }
  })
  const folderPct = Math.round((folderCount / 9) * 1000) / 10
  const concPct = Math.round((matchCount / 9) * 1000) / 10
  const recComp = recaptureCompleteness(emrOnly.recapture, emrOnly.recDate)
  const pbs = emrOnly.pbs ? 1 : 0
  const rec = emrOnly.recapture ? 1 : 0
  const dateScore = (recComp === 'EMR Complete' || recComp === 'Not Required') ? 1 : 0
  const emrPct = Math.round(((pbs + rec + dateScore) / 3) * 1000) / 10
  const recVal = txRow ? recaptureValidation(txRow.artStartDate, emrOnly.recapture, emrOnly.recDate) : ''
  return { folderCount, matchCount, folderPct, concPct, emrPct, recVal, recComp }
}

export function calcAggRow(reported, validatedRaw) {
  if (validatedRaw === '' || validatedRaw === null || validatedRaw === undefined) {
    return { conc: '', cls: '' }
  }
  const validated = Number(validatedRaw)
  const rep = Number(reported ?? 0)
  if (validated === 0 && rep === 0) return { conc: '100.0%', cls: 'Accurately reported', concNum: 100 }
  if (validated === 0 && rep > 0) return { conc: '', cls: 'Over-reported', concNum: null }
  const pct = (rep / validated) * 100
  const cls = Math.abs(pct - 100) < 0.01 ? 'Accurately reported' : pct > 100 ? 'Over-reported' : 'Under-reported'
  return { conc: pct.toFixed(1) + '%', cls, concNum: pct }
}

/** Same rules as per-row classification — for totals / weighted concurrence. */
export function aggClassification(reported, validated) {
  const rep = Number(reported ?? 0)
  const v = Number(validated ?? 0)
  if (v === 0 && rep === 0) return 'Accurately reported'
  if (v === 0 && rep > 0) return 'Over-reported'
  const pct = (rep / v) * 100
  if (Math.abs(pct - 100) < 0.01) return 'Accurately reported'
  return pct > 100 ? 'Over-reported' : 'Under-reported'
}

/** Text color matching field-entry classification badges. */
export function aggClassificationColor(reported, validated) {
  const badge = badgeClass(aggClassification(reported, validated))
  if (badge === 'good') return 'var(--good)'
  if (badge === 'over') return '#9f1239'
  if (badge === 'bad') return 'var(--bad)'
  return 'var(--warn)'
}

/** KPI value class for aggregate entry scorecard. */
export function aggClassificationKpiClass(reported, validated) {
  const badge = badgeClass(aggClassification(reported, validated))
  if (badge === 'good') return 'entry-kpi-good'
  if (badge === 'over') return 'entry-kpi-over'
  if (badge === 'bad') return 'entry-kpi-bad'
  return 'entry-kpi-warn'
}

export function badgeClass(text) {
  const t = String(text || '')
  if (['Match', 'Completed', 'Valid', 'EMR Complete', 'Not Required', 'On track', 'Accurately reported', 'Resolved', 'Pending'].includes(t)) return 'good'
  if (['Over-reported', 'Ongoing', 'In Progress'].includes(t)) return 'over'
  if (['Mismatch', 'Invalid', 'Overdue', 'Missing in EMR', 'Missing in Folder', 'Escalated'].includes(t)) return 'bad'
  return 'warnb'
}

export function txRowToApi(period, state, lga, facilityName, datimCode, patientId, pepId, assessor, assessmentDate, recordFound, txRow, folderValues, emrOnly, metrics, meta = {}) {
  const pbsAnswered = emrOnly.pbs !== '' && emrOnly.pbs != null
  const recaptureAnswered = emrOnly.recapture !== '' && emrOnly.recapture != null
  return normalizeTxValidationPayload({
    period,
    periodFy: meta.periodFy,
    state,
    lga,
    facilityName,
    datimCode,
    patientId,
    pepId,
    patientHospitalNo: meta.patientHospitalNo,
    assessor,
    assessmentDate,
    recordFound,
    emrSex: txRow?.sex,
    emrAge: txRow?.ageatstartofart,
    emrArtStartDate: txRow?.artStartDate,
    emrRegimenLine: txRow?.regimenLineAtArtStart,
    emrRegimen: txRow?.regimenAtArtStart,
    emrPharmacyPickup: txRow?.pharmacyLastPickupdate,
    emrDaysRefill: txRow?.daysOfArvRefill,
    emrTbStatus: txRow?.currentTbStatus,
    emrPregnancy: txRow?.currentPregnancyStatus,
    folderSex: folderValues.folderSex,
    folderAge: folderValues.folderAge,
    folderArtStartDate: folderValues.folderArtStart,
    folderRegimenLine: folderValues.folderRegLine,
    folderRegimen: folderValues.folderRegStart,
    folderPharmacyPickup: folderValues.folderPickup,
    folderDaysRefill: folderValues.folderRefill,
    folderTbStatus: folderValues.folderTb,
    folderPregnancy: folderValues.folderPreg,
    folderCompleteCount: metrics.folderCount,
    folderCompletenessPct: metrics.folderPct,
    matchCount: metrics.matchCount,
    concurrencePct: metrics.concPct,
    emrOnlyCompleteCount: (emrOnly.pbs ? 1 : 0) + (emrOnly.recapture ? 1 : 0) + ((metrics.recComp === 'EMR Complete' || metrics.recComp === 'Not Required') ? 1 : 0),
    emrOnlyPct: metrics.emrPct,
    pbsEmr: emrOnly.pbs,
    pbsCompleteness: pbsAnswered ? 'Complete' : 'Incomplete',
    recaptureEmr: emrOnly.recapture,
    recaptureCompleteness: recaptureAnswered ? 'Complete' : 'Incomplete',
    recaptureDate: emrOnly.recDate,
    recaptureDateComplete: metrics.recComp,
    recaptureDateValid: metrics.recVal,
    remarks: emrOnly.remarks,
  })
}

export function filterSavedAggRecords(facilityName, period, state, records) {
  if (!facilityName || !Array.isArray(records)) return []
  const facility = String(facilityName).trim()
  const periodKey = String(period || '').trim()
  const stateKey = String(state || '').trim()
  return records.filter(r => {
    if (String(r.facilityName || '').trim() !== facility) return false
    if (periodKey && String(r.period || '').trim() !== periodKey) return false
    if (stateKey && String(r.state || '').trim() !== stateKey) return false
    return true
  })
}

export function aggRowResolution(record) {
  return normalizeSingleResolution(record?.mismatchResolution)
}

export function savedAggRowsToForm(savedRows) {
  if (!Array.isArray(savedRows) || !savedRows.length) return null
  const validated = {}
  const mismatchResolutions = {}
  let assessor = ''
  let assessmentDate = ''
  for (const r of savedRows) {
    if (!assessor && r.assessor) assessor = r.assessor
    if (!assessmentDate && r.assessmentDate) assessmentDate = r.assessmentDate
    if (r.indicator != null && r.validated != null) {
      validated[r.indicator] = String(r.validated)
    }
    const resolution = aggRowResolution(r)
    if (resolution && r.indicator) mismatchResolutions[r.indicator] = resolution
  }
  return { validated, mismatchResolutions, assessor, assessmentDate }
}

export function resolutionsFromAggRows(rows) {
  const out = {}
  if (!Array.isArray(rows)) return out
  for (const r of rows) {
    const resolution = aggRowResolution(r)
    if (resolution && r.indicator) out[r.indicator] = resolution
  }
  return out
}

export function savedTxToForm(saved) {
  if (!saved) return null
  const { remarks, resolutions } = splitRemarksAndResolutions(saved.remarks)
  const storedResolutions = saved.mismatchResolutions
    ? normalizeResolutionMap(saved.mismatchResolutions)
    : resolutions
  return {
    assessmentDate: saved.assessmentDate || '',
    assessor: saved.assessor || '',
    recordFound: saved.recordFound || '',
    folderSex: saved.folderSex || '',
    folderAge: saved.folderAge != null ? String(saved.folderAge) : '',
    folderArtStart: normalizeDateText(saved.folderArtStartDate) || '',
    folderRegLine: saved.folderRegimenLine || '',
    folderRegStart: saved.folderRegimen || '',
    folderPickup: normalizeDateText(saved.folderPharmacyPickup) || '',
    folderRefill: saved.folderDaysRefill != null ? String(saved.folderDaysRefill) : '',
    folderTb: saved.folderTbStatus || '',
    folderPreg: saved.folderPregnancy || '',
    pbs: saved.pbsEmr || '',
    recapture: saved.recaptureEmr || '',
    recDate: saved.recaptureDate || '',
    recVal: saved.recaptureDateValid || '',
    remarks,
    mismatchResolutions: storedResolutions,
  }
}

export function normalizeTxId(v) {
  if (v === undefined || v === null || v === '') return ''
  return String(v).trim()
}

export function resolveTxClientPeriod(client, defaultPeriod, activeTxPreload) {
  return String(client?.dqaPeriod || defaultPeriod || activeTxPreload?.period || '').trim()
}

/** Match a preload client row to a saved TxValidation record. */
export function matchSavedTxRecord(client, records, { defaultPeriod, activeTxPreload } = {}) {
  if (!client || !Array.isArray(records) || !records.length) return null

  const period = resolveTxClientPeriod(client, defaultPeriod, activeTxPreload)
  const facility = String(client.facilityName || '').trim()
  const patientId = normalizeTxId(client.patientId)
  const pepId = normalizeTxId(client.pepId)

  return records.find(s => {
    if (String(s.facilityName || '').trim() !== facility) return false
    const savedPeriod = String(s.period || '').trim()
    if (period && savedPeriod !== period) return false
    return normalizeTxId(s.patientId) === patientId && normalizeTxId(s.pepId) === pepId
  }) || null
}

export function csvDownload(name, rows) {
  if (!rows.length) return false
  const headers = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return true
}
