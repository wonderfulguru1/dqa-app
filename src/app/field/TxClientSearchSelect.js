'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

function formatClient(r) {
  const pep = r.pepId || '—'
  const pid = r.patientId || '—'
  const fac = r.facilityName ? ` · ${r.facilityName}` : ''
  return `${pep} | ${pid}${fac}`
}

function matchesClientQuery(option, rawQuery) {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  if (option.search.includes(q) || option.label.toLowerCase().includes(q)) return true
  const tokens = q
    .replace(/[—|·]/g, ' ')
    .split(/\s+/)
    .filter(t => t && t !== '-')
  if (!tokens.length) return true
  const hay = `${option.search} ${option.label.toLowerCase()}`
  return tokens.every(t => hay.includes(t))
}

export default function TxClientSearchSelect({
  clients,
  value,
  onChange,
  disabled,
  loading = false,
  remoteSearch = false,
  onRemoteQuery,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const selected = value !== '' && clients[+value] ? clients[+value] : null

  const options = useMemo(
    () => clients.map((r, i) => ({
      i,
      label: formatClient(r),
      search: `${r.pepId || ''} ${r.patientId || ''} ${r.facilityName || ''}`.toLowerCase(),
    })),
    [clients],
  )

  const filtered = useMemo(() => {
    if (remoteSearch) return options.slice(0, 80)
    const q = query.trim()
    if (!q) return options.slice(0, 80)
    if (selected && q === formatClient(selected)) return options.slice(0, 80)
    return options.filter(o => matchesClientQuery(o, q)).slice(0, 80)
  }, [options, query, remoteSearch, selected])

  useEffect(() => {
    if (selected) setQuery(formatClient(selected))
  }, [selected])

  useEffect(() => {
    if (value !== '' && !selected) onChange('')
  }, [value, selected, onChange])

  useEffect(() => {
    if (value === '' && !open && !selected) setQuery('')
  }, [value, open, selected])

  useEffect(() => {
    if (!remoteSearch || !onRemoteQuery || value !== '') return
    const q = query.trim()
    const t = setTimeout(() => onRemoteQuery(q), 300)
    return () => clearTimeout(t)
  }, [query, remoteSearch, onRemoteQuery, value])

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(idx) {
    onChange(String(idx))
    setOpen(false)
  }

  const canSearch = remoteSearch || clients.length > 0
  const placeholder = disabled
    ? 'Select a facility first'
    : loading
      ? 'Loading clients…'
      : canSearch
        ? 'Search PepID or Patient ID…'
        : 'No clients in line list'

  return (
    <div className={`client-search-select${open ? ' open' : ''}`} ref={wrapRef}>
      <input
        type="text"
        className="client-search-input"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          onChange('')
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled || loading}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && !disabled && !loading && (remoteSearch || clients.length > 0) && (
        <ul className="client-search-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="client-search-empty">No clients match your search.</li>
          ) : filtered.map(({ i, label }) => (
            <li key={i}>
              <button
                type="button"
                className={`client-search-option${String(i) === value ? ' active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(i)}
                role="option"
                aria-selected={String(i) === value}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
