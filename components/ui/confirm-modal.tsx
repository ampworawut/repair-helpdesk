'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
}

export default function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'ยืนยัน',
  variant = 'default',
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md z-50 p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
              )}
            >
              <AlertTriangle
                className={cn('w-5 h-5', variant === 'danger' ? 'text-red-600' : 'text-blue-600')}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                {message}
              </Dialog.Description>
            </div>
            <Dialog.Close className="p-1 text-gray-400 hover:text-gray-600 rounded transition flex-shrink-0">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Dialog.Close asChild>
              <button className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition font-medium">
                ยกเลิก
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className={cn(
                'px-6 py-2.5 rounded-lg text-sm transition font-medium text-white',
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
