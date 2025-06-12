'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newNotification: Notification = {
      id,
      duration: 5000, // Default 5 seconds
      dismissible: true, // Default dismissible
      ...notification,
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto-remove after duration (if specified)
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()
  const [isExpanded, setIsExpanded] = React.useState(false)

  if (notifications.length === 0) return null

  const handleStackExpand = () => {
    if (notifications.length > 1) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleBringToFront = (id: string) => {
    if (!isExpanded) return
    
    const notification = notifications.find(n => n.id === id)
    if (notification) {
      removeNotification(id)
      setIsExpanded(false)
    }
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
      <div className="w-auto">
        {/* Notification Stack - iPhone style */}
        <div 
          className={cn(
            "relative transition-all duration-500 ease-out",
            isExpanded && notifications.length > 1 ? "space-y-2 sm:space-y-3" : "space-y-0"
          )}
        >
          {notifications.map((notification, index) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onDismiss={() => removeNotification(notification.id)}
              onBringToFront={() => handleBringToFront(notification.id)}
              onStackClick={handleStackExpand}
              index={index}
              total={notifications.length}
              isExpanded={isExpanded}
            />
          ))}
        </div>
        
        {/* iPhone-style stack indicator */}
        {notifications.length > 1 && !isExpanded && (
          <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 pointer-events-auto">
            <button
              onClick={handleStackExpand}
              className="bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-xs font-semibold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center gap-1 min-h-[28px] sm:min-h-[auto]"
              aria-label={`${notifications.length} notifications`}
            >
              <span>{notifications.length}</span>
              <svg className="w-3 h-3 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* iPhone-style collapse button when expanded */}
        {isExpanded && notifications.length > 1 && (
          <div className="absolute top-2 right-3 sm:top-3 sm:right-0 pointer-events-auto">
            <button
              onClick={() => setIsExpanded(false)}
              className="bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-xs font-semibold p-1.5 sm:p-2 rounded-full backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 min-h-[28px] min-w-[28px] sm:min-h-[auto] sm:min-w-[auto] flex items-center justify-center"
              aria-label="Collapse notifications"
            >
              <svg className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NotificationCard({ 
  notification, 
  onDismiss, 
  onBringToFront,
  onStackClick,
  index,
  total,
  isExpanded
}: { 
  notification: Notification
  onDismiss: () => void
  onBringToFront: () => void
  onStackClick: () => void
  index: number
  total: number
  isExpanded: boolean
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return (
          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'info':
        return (
          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  const getColors = () => {
    switch (notification.type) {
      case 'success':
        return {
          icon: 'text-green-500 dark:text-green-400',
          title: 'text-gray-900 dark:text-gray-100',
          message: 'text-gray-700 dark:text-gray-300',
          button: 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
        }
      case 'error':
        return {
          icon: 'text-red-500 dark:text-red-400',
          title: 'text-gray-900 dark:text-gray-100',
          message: 'text-gray-700 dark:text-gray-300',
          button: 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
        }
      case 'warning':
        return {
          icon: 'text-yellow-500 dark:text-yellow-400',
          title: 'text-gray-900 dark:text-gray-100',
          message: 'text-gray-700 dark:text-gray-300',
          button: 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300'
        }
      case 'info':
        return {
          icon: 'text-blue-500 dark:text-blue-400',
          title: 'text-gray-900 dark:text-gray-100',
          message: 'text-gray-700 dark:text-gray-300',
          button: 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
        }
    }
  }

  const colors = getColors()
  const isFirst = index === 0
  const isSingle = total === 1

  // iPhone-style stacking behavior
  const getCardStyle = () => {
    if (isSingle || isExpanded) {
      return {
        position: 'relative' as const,
        transform: 'none',
        opacity: 1,
        zIndex: 50
      }
    }

    // iPhone-like subtle stacking
    const stackOffset = Math.min(index * 2, 4) // Minimal offset like iPhone
    const scaleReduction = Math.min(index * 0.015, 0.03) // Very subtle scale
    const opacityReduction = Math.min(index * 0.08, 0.3) // Gentle fade
    
    return {
      position: index === 0 ? 'relative' as const : 'absolute' as const,
      top: index === 0 ? 0 : -stackOffset,
      right: index === 0 ? 0 : stackOffset * 0.5,
      transform: `scale(${1 - scaleReduction}) translateZ(0)`,
      opacity: Math.max(1 - opacityReduction, 0.7),
      zIndex: 50 - index
    }
  }

  const cardStyle = getCardStyle()

  return (
    <div 
      className={cn(
        // iPhone notification styling - responsive sizes
        "backdrop-blur-xl border border-black/10 dark:border-white/10 pointer-events-auto transition-all duration-400 ease-out",
        "bg-white/95 dark:bg-gray-900/95",
        "shadow-lg hover:shadow-xl",
        // Mobile: much smaller and compact for iPhone SE
        "w-56 p-1.5 rounded-lg text-xs max-w-[80vw]",
        // Desktop: larger, more spacious  
        "sm:w-auto sm:p-4 sm:rounded-3xl sm:text-base sm:max-w-sm",
        isFirst ? "animate-slide-down-center" : "",
        !isFirst && !isExpanded && "cursor-pointer hover:scale-[1.01] hover:opacity-100",
        isExpanded && "hover:scale-[1.005]",
        // Enhanced depth for front card
        isFirst && !isSingle && !isExpanded && "shadow-xl ring-1 ring-black/5 dark:ring-white/5"
      )}
      onClick={!isFirst && !isExpanded ? onStackClick : isExpanded ? onBringToFront : undefined}
      style={cardStyle}
    >
      <div className="flex items-start gap-1.5 sm:gap-3">
        {/* Icon - responsive sizing */}
        <div className={cn("flex-shrink-0 mt-0.5", colors.icon)}>
          <div className="w-3 h-3 sm:w-5 sm:h-5">
            {getIcon()}
          </div>
        </div>
        
        {/* Content - iPhone typography */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-semibold leading-tight mb-0.5 sm:mb-1",
            "text-xs sm:text-base", // Smaller on mobile
            colors.title
          )}>
            {notification.title}
          </p>
          {notification.message && (
            <p className={cn(
              "break-words leading-snug opacity-80",
              "text-xs sm:text-sm", // Smaller on mobile
              colors.message
            )}>
              {notification.message}
            </p>
          )}
          
          {/* Action Button - iPhone style */}
          {notification.action && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                notification.action?.onClick()
              }}
              className={cn(
                "mt-1.5 sm:mt-3 font-medium underline transition-all duration-200 hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded px-1.5 py-1.5 sm:px-1 sm:py-0.5 min-h-[36px] sm:min-h-[auto]",
                "text-xs sm:text-sm", // Smaller on mobile
                colors.button
              )}
            >
              {notification.action.label}
            </button>
          )}
        </div>
        
        {/* Dismiss Button - iPhone X button style */}
        {notification.dismissible && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className={cn(
              "flex-shrink-0 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded-full",
              "p-1 sm:p-1.5 min-h-[28px] min-w-[28px] sm:min-h-[auto] sm:min-w-[auto] flex items-center justify-center", // Smaller touch target on mobile
              colors.icon
            )}
            aria-label="Dismiss notification"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* iPhone-style stack depth indicator */}
      {!isFirst && !isExpanded && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-black/8 to-transparent dark:via-white/8 rounded-b-2xl sm:rounded-b-3xl" />
      )}
    </div>
  )
}

// Convenience hooks for different notification types
export function useNotificationHelpers() {
  const { addNotification } = useNotifications()

  return {
    success: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ type: 'success', title, message, ...options }),
    
    error: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ type: 'error', title, message, ...options }),
    
    warning: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ type: 'warning', title, message, ...options }),
    
    info: (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ type: 'info', title, message, ...options }),
  }
} 