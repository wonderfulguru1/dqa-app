'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './searchable-select.css'

export default function SearchableSelect({
  label,
  value = '',
  onChange,
  options = [],
  allLabel = 'All',
  placeholder = 'Search…',
  disabled = false,
  className = '',
  required = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()

  const normalizedOptions = useMemo(
    () => [...new Set(options.map(o => String(o || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [options],
  )

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return normalizedOptions
    return normalizedOptions.filter(option => option.toLowerCase().includes(q))
  }, [normalizedOptions, query])

  useEffect(() => {
    if (!open) return undefined
    function handleOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function selectOption(option) {
    onChange(option)
    setOpen(false)
    setQuery('')
  }

  function clearSelection(event) {
    event.stopPropagation()
    onChange('')
    setOpen(false)
    setQuery('')
  }

  const displayValue = value || allLabel

  return (
    <div className={`form-field searchable-select ${className}`.trim()} ref={rootRef}>
      {label ? <label>{label}</label> : null}
      <div className={`searchable-select__control${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}>
        <button
          type="button"
          className="searchable-select__trigger"
          onClick={() => !disabled && setOpen(current => !current)}
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
        >
          <span
            className={`searchable-select__value${!value ? ' is-placeholder' : ''}`}
            title={value || allLabel}
          >
            {displayValue}
          </span>
          <span className="searchable-select__chevron" aria-hidden="true">▾</span>
        </button>
        {value && !disabled ? (
          <button
            type="button"
            className="searchable-select__clear"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            ×
          </button>
        ) : null}
        {open ? (
          <div className="searchable-select__dropdown">
            <input
              ref={inputRef}
              className="searchable-select__search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-controls={listId}
            />
            <ul id={listId} className="searchable-select__list" role="listbox">
              {!required ? (
                <li
                  role="option"
                  aria-selected={!value}
                  className={!value ? 'is-selected' : ''}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => selectOption('')}
                >
                  {allLabel}
                </li>
              ) : null}
              {filteredOptions.length === 0 ? (
                <li className="searchable-select__empty">No matches</li>
              ) : filteredOptions.map(option => (
                <li
                  key={option}
                  role="option"
                  aria-selected={value === option}
                  className={value === option ? 'is-selected' : ''}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  title={option}
                >
                  {option}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
