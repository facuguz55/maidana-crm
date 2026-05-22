import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('549') && digits.length === 13) {
    return `+54 9 ${digits.slice(3, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`
  }
  return `+${digits}`
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return `hace ${m} min`
  }
  if (diff < 86400 && date.getDate() === now.getDate()) {
    const h = Math.floor(diff / 3600)
    return `hace ${h} ${h === 1 ? 'hora' : 'hs'}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
    return `ayer ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (diff < 604800) {
    const d = Math.floor(diff / 86400)
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  }
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}
