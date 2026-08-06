import type { SyncErrorInfo } from '../exchanges/formatSyncError'

export function SyncErrorBanner({
  error,
  onDismiss,
}: {
  error: SyncErrorInfo
  onDismiss?: () => void
}) {
  return (
    <div className={`sync-banner sync-banner-${error.kind}`} role="status">
      <div className="sync-banner-icon" aria-hidden="true">
        {error.kind === 'rate' ? 'R' : error.kind === 'network' ? 'N' : error.kind === 'time' ? 'T' : '!'}
      </div>
      <div className="sync-banner-body">
        <strong>{error.title}</strong>
        <p>{error.detail}</p>
      </div>
      {onDismiss && (
        <button type="button" className="sync-banner-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  )
}
