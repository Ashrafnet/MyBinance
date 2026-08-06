import { useEffect, useState } from 'react'
import { cacheClearAll, getSettings, saveSettings } from '../storage/cache'
import { exportEncryptedBackup, importEncryptedBackup } from '../storage/vault'
import { Toast } from '../components/Toast'

export function SettingsScreen() {
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(100)
  const [dustUsdt, setDustUsdt] = useState(3)
  const [toast, setToast] = useState<string | null>(null)

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
    if (!confirm('Clear cached balances/orders/prices? Vault keys are kept.')) return
    await cacheClearAll()
    setToast('Cache cleared')
  }

  async function onExport() {
    try {
      const json = await exportEncryptedBackup()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'myexchanges-vault-backup.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Export failed')
    }
  }

  async function onImport(file: File) {
    try {
      const text = await file.text()
      await importEncryptedBackup(text)
      setToast('Backup imported — unlock with your PIN')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Import failed')
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
        <button className="btn primary block" onClick={() => void save()}>
          Save settings
        </button>
      </div>

      <div className="panel">
        <h3>Data</h3>
        <div className="stack-actions">
          <button className="btn block" onClick={() => void onExport()}>
            Export encrypted vault
          </button>
          <label className="btn block file-btn">
            Import vault
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImport(f)
              }}
            />
          </label>
          <button className="btn danger block" onClick={() => void clearCache()}>
            Clear cache
          </button>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
