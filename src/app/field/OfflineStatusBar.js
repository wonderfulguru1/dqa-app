'use client'
import { useFieldEntry } from './FieldEntryContext'

export default function OfflineStatusBar() {
  const { isOnline, pendingCount, syncing, syncNow } = useFieldEntry()

  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`entry-offline-bar${isOnline ? ' online' : ' offline'}`}>
      <div className="entry-offline-text">
        {!isOnline && (
          <strong>Offline mode.</strong>
        )}
        {' '}
        {!isOnline
          ? 'Entries are saved on this device and will sync to the server when internet returns.'
          : pendingCount > 0
            ? 'Connection restored. Pending entries will sync automatically.'
            : null}
        {pendingCount > 0 && (
          <span className="entry-offline-count">
            {' '}{pendingCount} pending {pendingCount === 1 ? 'entry' : 'entries'} on this device.
          </span>
        )}
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          className="entry-btn secondary entry-offline-sync"
          onClick={syncNow}
          disabled={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      )}
    </div>
  )
}
