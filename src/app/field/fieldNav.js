export const FIELD_TAB_ITEMS = [
  { slug: 'tx', label: 'TX_NEW Entry' },
  { slug: 'agg', label: 'Aggregate Entry' },
  { slug: 'issues', label: 'Issues & Actions' },
  { slug: 'review', label: 'Review & Export' },
]

export function fieldTabs(basePath = '/field') {
  return FIELD_TAB_ITEMS.map(t => ({
    href: `${basePath}/${t.slug}`,
    label: t.label,
  }))
}

/** @deprecated use fieldTabs() */
export const FIELD_TABS = fieldTabs('/field')
