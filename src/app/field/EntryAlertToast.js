'use client'

export default function EntryAlertToast({ banner }) {
  if (!banner) return null

  return (
    <div
      className={`entry-alert-toast ${banner.ok ? 'ok' : 'err'}`}
      role="alert"
      aria-live="assertive"
    >
      <strong>{banner.ok ? 'Success' : 'Error'}</strong>
      <span>{banner.msg}</span>
    </div>
  )
}
