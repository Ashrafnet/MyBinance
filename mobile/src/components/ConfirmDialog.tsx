import { useEffect } from 'react'

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="confirm-backdrop" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">Please confirm</p>
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-message" className="confirm-message">
          {message}
        </p>
        {detail && <p className="confirm-detail">{detail}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'danger solid' : 'primary'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
