function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text) {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return out
}

function isTableRow(line) {
  return /^\|.+\|$/.test(line.trim())
}

function parseTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim())
}

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

/** Minimal markdown → HTML for internal API docs (no external deps). */
export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const parts = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '---') {
      parts.push('<hr />')
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      parts.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(line)
      i += 2
      const bodyRows = []
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        bodyRows.push(parseTableRow(lines[i]))
        i += 1
      }
      const thead = `<thead><tr>${headerCells.map(c => `<th>${inlineMarkdown(c)}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${bodyRows.map(row => `<tr>${row.map(c => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
      parts.push(`<div class="docs-table-wrap"><table>${thead}${tbody}</table></div>`)
      continue
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      i += 1
      const codeLines = []
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1
      const code = escapeHtml(codeLines.join('\n'))
      const cls = lang ? ` class="language-${lang}"` : ''
      parts.push(`<pre><code${cls}>${code}</code></pre>`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*]\s+/, ''))}</li>`)
        i += 1
      }
      parts.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (line.trim() === '') {
      i += 1
      continue
    }

    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !/^[-*]\s+/.test(lines[i]) && lines[i].trim() !== '---' && !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))) {
      paraLines.push(lines[i])
      i += 1
    }
    parts.push(`<p>${inlineMarkdown(paraLines.join(' '))}</p>`)
    if (paraLines.length === 0) i += 1
  }

  return parts.join('\n')
}
