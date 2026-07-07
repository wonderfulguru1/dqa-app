'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { fieldTabs } from './fieldNav'

export default function FieldSideNav({ basePath = '/field' }) {
  const pathname = usePathname()
  const router = useRouter()
  const tabs = useMemo(() => fieldTabs(basePath), [basePath])

  useEffect(() => {
    for (const tab of tabs) {
      if (tab.href !== pathname) router.prefetch(tab.href)
    }
  }, [tabs, pathname, router])

  return (
    <nav className="hq-sidebar-nav" aria-label="Field entry sections">
      {tabs.map(t => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`hq-sidebar-link${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
