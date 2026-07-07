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
