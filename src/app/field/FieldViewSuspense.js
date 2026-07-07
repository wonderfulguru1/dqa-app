'use client'
import { Suspense, lazy } from 'react'
import FieldRouteFallback from './FieldRouteFallback'

const FieldTxView = lazy(() => import('./views/FieldTxView'))
const FieldAggView = lazy(() => import('./views/FieldAggView'))
const FieldIssuesView = lazy(() => import('./views/FieldIssuesView'))
const FieldReviewView = lazy(() => import('./views/FieldReviewView'))

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
