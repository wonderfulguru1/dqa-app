import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { markdownToHtml } from '@/lib/markdown-lite'
import './docs.css'

export const metadata = {
  title: 'API Documentation — ECEWS DQA Companion',
  description: 'REST API reference for the ECEWS DQA Companion application.',
}

function loadApiMarkdown() {
  const filePath = path.join(process.cwd(), 'docs', 'API.md')
  return fs.readFileSync(filePath, 'utf8')
}

export default function DocsPage() {
  const html = markdownToHtml(loadApiMarkdown())

  return (
    <div className="docs-page">
      <header className="docs-topbar">
        <span className="docs-topbar-title">ECEWS DQA Companion — API Docs</span>
        <Link href="/login">Sign in</Link>
      </header>
      <main className="docs-main">
        <article
          className="docs-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  )
}
