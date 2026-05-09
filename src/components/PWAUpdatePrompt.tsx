import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-3">
      <span className="text-sm">A new version is available.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-white text-slate-900 px-3 py-1 rounded text-sm font-medium hover:bg-slate-100"
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-slate-400 hover:text-white text-sm underline"
      >
        Dismiss
      </button>
    </div>
  )
}
