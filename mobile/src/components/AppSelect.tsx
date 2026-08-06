import { useEffect, useId, useRef, useState } from 'react'

export type AppSelectOption = {
  value: string
  label: string
  hint?: string
}

export function AppSelect({
  value,
  options,
  onChange,
  label,
  prefix,
  className = '',
  fullWidth = false,
  variant = 'chip',
  icon = 'none',
}: {
  value: string
  options: AppSelectOption[]
  onChange: (value: string) => void
  label?: string
  /** Always-visible caption in the trigger (e.g. "Sort") */
  prefix?: string
  className?: string
  fullWidth?: boolean
  variant?: 'chip' | 'field'
  icon?: 'none' | 'wallet' | 'sort' | 'exchange' | 'type'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className={`app-select ${variant} ${fullWidth ? 'full' : ''} ${open ? 'open' : ''} ${className}`.trim()}
    >
      {label && <span className="app-select-label">{label}</span>}
      <button
        type="button"
        className="app-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {icon !== 'none' && (
          <span className={`app-select-glyph ${icon}`} aria-hidden="true">
            <SelectGlyph kind={icon} />
          </span>
        )}
        <span className="app-select-value">
          {prefix ? <em className="app-select-prefix">{prefix}</em> : null}
          <strong title={selected?.label}>{selected?.label ?? 'Select'}</strong>
          {!prefix && selected?.hint ? <em>{selected.hint}</em> : null}
        </span>
        <span className="app-select-caret" aria-hidden="true">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <ul id={listId} className="app-select-menu" role="listbox">
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`app-select-option ${active ? 'active' : ''}`}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <span>
                    <strong>{opt.label}</strong>
                    {opt.hint && <em>{opt.hint}</em>}
                  </span>
                  {active && <CheckIcon />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SelectGlyph({ kind }: { kind: 'wallet' | 'sort' | 'exchange' | 'type' }) {
  if (kind === 'wallet') {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <path d="M3 10h18" />
        <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (kind === 'sort') {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h10M4 12h7M4 17h4" strokeLinecap="round" />
        <path d="M16 6v12M16 18l3-3M16 18l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'exchange') {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 7h11l-3-3M17 17H6l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14M8 12h11M11 17h8" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`app-select-chevron ${open ? 'open' : ''}`}
      viewBox="0 0 20 20"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M4.5 10.5 8 14l7.5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
