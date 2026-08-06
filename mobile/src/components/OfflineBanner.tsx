import { useOnline } from '../app/OnlineContext'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return <div className="banner">Offline — showing last sync. Refresh and trading are disabled.</div>
}
