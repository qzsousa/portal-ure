import { reactive } from 'vue'
import { defineStore } from 'pinia'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

let nextId = 1

export const useUiStore = defineStore('ui', () => {
  const toasts = reactive<Toast[]>([])

  function push(kind: ToastKind, message: string, timeoutMs = 4500) {
    const id = nextId++
    toasts.push({ id, kind, message })
    window.setTimeout(() => dismiss(id), timeoutMs)
  }

  function dismiss(id: number) {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx >= 0) toasts.splice(idx, 1)
  }

  const success = (m: string) => push('success', m)
  const error = (m: string) => push('error', m, 6000)
  const info = (m: string) => push('info', m)

  return { toasts, push, dismiss, success, error, info }
})
