import { useOnline } from '../app/OnlineContext'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return <div className="banner">Offline. Showing last sync — refresh and trading stay disabled until you are back online.</div>
}
