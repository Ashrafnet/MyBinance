import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { cacheClearAll, getSettings, saveSettings } from '../storage/cache'
import { exportEncryptedBackup, importEncryptedBackup } from '../storage/vault'
import { exportTextFile } from '../utils/exportFile'
import { Toast } from '../components/Toast'

export function SettingsScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(100)
  const [dustUsdt, setDustUsdt] = useState(3)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  useEffect(() => {
    void (async () => {
      const s = await getSettings()
      setAutoRefreshSeconds(s.autoRefreshSeconds)
      setDustUsdt(s.dustUsdt)
    })()
  }, [])

  async function save() {
    await saveSettings({ autoRefreshSeconds, dustUsdt })
    setToast('Settings saved')
  }

  async function clearCache() {
    if (!confirm('Clear cached balances/orders/prices? Your accounts and vault keys are kept.')) return
    await cacheClearAll()
    setToast('Cache cleared')
  }

  async function onExport() {
    setBusy('export')
    setToast(null)
    try {
      const json = await exportEncryptedBackup()
      const filename = `myexchanges-backup-${new Date().toISOString().slice(0, 10)}.json`
      await exportTextFile(filename, json, 'Save MyExchanges backup')
      setToast('Backup ready — save or share the file somewhere safe')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed'
      if (/cancel|abort|dismiss/i.test(msg)) {
        setToast('Export canceled')
      } else {
        setToast(msg)
      }
    } finally {
      setBusy(null)
    }
  }

  async function onImportFile(file: File) {
    const ok = confirm(
      'Restore this backup?\n\nThis replaces accounts and API keys on this device. You will unlock next with the recovery PIN from when the backup was created.',
    )
    if (!ok) return

    setBusy('import')
    setToast(null)
    try {
      const text = await file.text()
      const result = await importEncryptedBackup(text)
      await auth.requireUnlock()
      navigate('/unlock', {
        replace: true,
        state: {
          fromImport: true,
          accountCount: result.accountCount,
          legacyBackup: result.legacyBackup,
        },
      })
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="mobile-page">
      <p className="eyebrow">Preferences</p>
      <h2>Settings</h2>

      <div className="panel">
        <label>
          Auto-refresh (seconds)
          <input
            type="number"
            value={autoRefreshSeconds}
            onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
          />
        </label>
        <label>
          Dust threshold (USDT)
          <input type="number" value={dustUsdt} onChange={(e) => setDustUsdt(Number(e.target.value))} />
        </label>
        <div className="settings-save-row">
          <button
            type="button"
            className="icon-btn primary-glow"
            aria-label="Save settings"
            title="Save settings"
            onClick={() => void save()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Backup</h3>
        <p className="muted backup-help">
          Export saves your encrypted API keys and account list. Import restores them, then asks for your recovery PIN right away.
        </p>
        <div className="stack-actions">
          <button className="btn block primary" disabled={busy !== null} onClick={() => void onExport()}>
            {busy === 'export' ? 'Preparing backup…' : 'Export backup'}
          </button>
          <button
            type="button"
            className="btn block"
            disabled={busy !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy === 'import' ? 'Restoring…' : 'Import backup'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
            }}
          />
          <button className="btn danger block" disabled={busy !== null} onClick={() => void clearCache()}>
            Clear cache
          </button>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
