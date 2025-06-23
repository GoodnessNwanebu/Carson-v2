'use client'

import { toast } from 'sonner'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationOptions {
  duration?: number
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function useNotifications() {
  const addNotification = (
    type: NotificationType,
    title: string,
    options?: NotificationOptions
  ) => {
    const toastOptions = {
      duration: options?.duration || 5000,
      description: options?.description,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    }

    switch (type) {
      case 'success':
        return toast.success(title, toastOptions)
      case 'error':
        return toast.error(title, toastOptions)
      case 'warning':
        return toast.warning(title, toastOptions)
      case 'info':
        return toast.info(title, toastOptions)
      default:
        return toast(title, toastOptions)
    }
  }

  // Support both new API and old API for backward compatibility
  const success = (title: string, optionsOrMessage?: NotificationOptions | string) => {
    const options = typeof optionsOrMessage === 'string' 
      ? { description: optionsOrMessage } 
      : optionsOrMessage
    return addNotification('success', title, options)
  }

  const error = (title: string, optionsOrMessage?: NotificationOptions | string) => {
    const options = typeof optionsOrMessage === 'string' 
      ? { description: optionsOrMessage } 
      : optionsOrMessage
    return addNotification('error', title, options)
  }

  const warning = (title: string, optionsOrMessage?: NotificationOptions | string) => {
    const options = typeof optionsOrMessage === 'string' 
      ? { description: optionsOrMessage } 
      : optionsOrMessage
    return addNotification('warning', title, options)
  }

  const info = (title: string, optionsOrMessage?: NotificationOptions | string) => {
    const options = typeof optionsOrMessage === 'string' 
      ? { description: optionsOrMessage } 
      : optionsOrMessage
    return addNotification('info', title, options)
  }

  const dismiss = (toastId: string | number) => toast.dismiss(toastId)

  const dismissAll = () => toast.dismiss()

  return {
    addNotification,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
  }
}

// Helper functions for quick access
export const notify = {
  success: (title: string, options?: NotificationOptions) => 
    toast.success(title, options),
  error: (title: string, options?: NotificationOptions) => 
    toast.error(title, options),
  warning: (title: string, options?: NotificationOptions) => 
    toast.warning(title, options),
  info: (title: string, options?: NotificationOptions) => 
    toast.info(title, options),
} 