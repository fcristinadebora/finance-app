import { useEffect, useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(min-width: 768px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function MobileSheet({ open, onClose, title, children }: Props) {
  const isMobile = useIsMobile()

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 transition duration-200 ease-out data-[closed]:opacity-0"
      />

      <div className={`fixed inset-0 flex ${isMobile ? 'items-end' : 'items-center justify-center p-4'}`}>
        <DialogPanel
          transition
          className={
            isMobile
              ? 'w-full rounded-t-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto transition-transform duration-300 ease-out data-[closed]:translate-y-full'
              : 'w-full max-w-lg rounded-2xl bg-white shadow-xl transition duration-200 ease-out data-[closed]:opacity-0 data-[closed]:scale-95'
          }
        >
          {/* Drag handle — mobile only */}
          {isMobile && (
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
          )}

          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable content with safe-area bottom padding */}
          <div className="px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
