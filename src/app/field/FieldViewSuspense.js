'use client'
import { Suspense } from 'react'
import FieldTxView from './views/FieldTxView'
import FieldAggView from './views/FieldAggView'
import FieldIssuesView from './views/FieldIssuesView'
import FieldReviewView from './views/FieldReviewView'
import FieldRouteFallback from './FieldRouteFallback'

const VIEW_CONFIG = {
  tx: { Component: FieldTxView, label: 'TX_NEW Entry' },
  agg: { Component: FieldAggView, label: 'Aggregate Entry' },
  issues: { Component: FieldIssuesView, label: 'Issues & Actions' },
  review: { Component: FieldReviewView, label: 'Review & Export' },
}

export default function FieldViewSuspense({ view }) {
  const config = VIEW_CONFIG[view]
  if (!config) return null
  const { Component, label } = config

  return (
    <Suspense fallback={<FieldRouteFallback label={label} />}>
      <Component />
    </Suspense>
  )
}
