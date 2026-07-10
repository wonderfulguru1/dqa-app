/** Correct "All …" labels for HQ filter dropdowns. */
const FILTER_ALL_LABELS = {
  Period: 'All periods',
  State: 'All states',
  LGA: 'All LGAs',
  Facility: 'All facilities',
  Indicator: 'All indicators',
}

export function filterAllOptionLabel(label) {
  return FILTER_ALL_LABELS[label] || `All ${String(label || '').toLowerCase()}s`
}

export function uniqueSortedFacilities(records, { state = '', lga = '', key = 'facilityName' } = {}) {
  return [...new Set(
    (records || [])
      .filter(r => (!state || r.state === state) && (!lga || r.lga === lga))
      .map(r => String(r[key] || '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b))
}
