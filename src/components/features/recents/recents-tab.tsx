"use client"

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Clock, MessageSquare, CheckCircle, Search, RefreshCw, ArrowRight } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { textColors, backgroundColors, borderColors, buttonStyles, inputStyles, statusBadges, overlayStyles, gradientStyles, responsiveUtils } from '@/lib/theme-utils'
import { useSession } from '@/components/features/conversation/session-context'
import { useRouter } from 'next/navigation'

interface RecentSession {
  id: string
  sessionId: string
  title: string
  createdAt: string
  updatedAt: string
  completed: boolean
  messageCount: number
  lastMessage: string
  subtopicsCount: number
  isComplete: boolean
}

export function RecentsTab() {
  const { isDarkMode } = useTheme()
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const { session: currentSession, clearSession, startSession } = useSession()
  const router = useRouter()

  useEffect(() => {
    loadRecentSessions()
  }, [])

  const loadRecentSessions = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const response = await fetch('/api/sessions/recent')
      
      if (!response.ok) {
        throw new Error('Failed to load recent sessions')
      }

      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Error loading recent sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load recent sessions')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    loadRecentSessions(true)
  }

  const handleSessionSelect = async (session: RecentSession) => {
    try {
      console.log('🔄 [RecentsTab] Starting session load:', session.sessionId)
      
      // Auto-save current session if exists
      if (currentSession && currentSession.sessionId !== session.sessionId) {
        console.log('Auto-saving current session before switching...')
        // The session context auto-saves, so we just need to clear and load new one
      }

      // Update session access time
      await fetch('/api/sessions/recent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId })
      })

      // Load the selected session and wait for it to be fully set
      console.log('Loading session:', session.sessionId)
      await startSession(session.title, session.sessionId)
      
      // **CRITICAL FIX**: Wait for session state to propagate before navigation
      // Give React a chance to update the session context
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Verify session is actually loaded
      console.log('Session loaded, navigating...')
      router.push('/')
    } catch (error) {
      console.error('Error switching to session:', error)
      setError('Failed to load conversation. Please try again.')
    }
  }

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSessionStatus = (session: RecentSession) => {
    if (session.isComplete) return 'completed'
    if (session.messageCount > 0) return 'in_progress'
    return 'new'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={`${textColors.secondary}`}>Loading your conversations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ {error}</p>
          <button 
            onClick={() => loadRecentSessions()}
            className={`px-4 py-2 rounded-lg ${buttonStyles.primary}`}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">💬</div>
          <h3 className={`text-xl font-semibold mb-2 ${textColors.primary}`}>No Conversations Yet</h3>
          <p className={`mb-4 ${textColors.secondary}`}>
            Start a conversation with Carson to see it appear here.
          </p>
          <p className={`text-sm ${textColors.muted}`}>
            Your recent conversations will be saved and you can resume them anytime.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${backgroundColors.primary} transition-colors duration-200`}>
      {/* Header */}
      <div className={`${backgroundColors.card} ${borderColors.primary} border-b flex-shrink-0`}>
        <div className="px-4 pt-6 pb-4 md:px-6 md:pt-8 md:pb-6 lg:px-8 lg:pt-10 lg:pb-8">
          {/* Carson-style Header with mobile clearance */}
          <div className="text-center mb-6 md:mb-8 lg:mb-10">
            <div className="mb-4 md:mb-6 pl-12 pr-4 md:pl-0 md:pr-0">
              <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold mb-2 md:mb-3 ${textColors.primary} leading-tight`}>
                Recent Conversations
              </h1>
              <p className={`text-sm md:text-base lg:text-lg ${textColors.secondary} max-w-sm md:max-w-md mx-auto leading-relaxed`}>
                Pick up where you left off with Carson
              </p>
            </div>
          </div>
          
          {/* Search and Controls */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-full md:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={20} className={textColors.muted} />
              </div>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-12 pr-4 py-3 rounded-xl text-base border-0
                  ${inputStyles.search}
                  focus:outline-none focus:ring-2 transition-all duration-200
                `}
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between md:justify-end gap-3">
              <p className={`text-sm ${textColors.secondary} order-2 md:order-1`}>
                {filteredSessions.length} conversation{filteredSessions.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`
                  inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors order-1 md:order-2
                  ${buttonStyles.ghost}
                  ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Refresh conversations"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.sessionId}
              onClick={() => handleSessionSelect(session)}
              className={`
                group relative p-4 md:p-6 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] md:active:scale-100
                ${currentSession?.sessionId === session.sessionId
                  ? `${gradientStyles.accent} shadow-lg ring-2 ring-blue-400/50 dark:ring-blue-400/50`
                  : `${backgroundColors.card} ${backgroundColors.cardHover} hover:shadow-md ${borderColors.primary} border`
                }
              `}
            >
              {/* Session Header */}
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex-1 min-w-0 pr-3 md:pr-4">
                  <h3 className={`
                    font-semibold text-base md:text-lg leading-tight mb-2 line-clamp-2
                    ${textColors.primary}
                  `}>
                    {session.title}
                  </h3>
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4 mb-2 md:mb-3">
                    <span className={`text-sm ${textColors.secondary}`}>
                      {formatDistanceToNow(new Date(session.updatedAt))} ago
                    </span>
                    <div className="flex items-center gap-3 md:gap-4">
                      <span className={`text-xs md:text-sm ${textColors.muted}`}>
                        {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                      </span>
                      {session.subtopicsCount > 0 && (
                        <span className={`text-xs md:text-sm ${textColors.muted}`}>
                          {session.subtopicsCount} topic{session.subtopicsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge and Arrow */}
                <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-3 flex-shrink-0">
                  <span className={`
                    px-2 md:px-3 py-1 md:py-1.5 text-xs rounded-full font-medium border text-center
                    ${session.isComplete
                      ? statusBadges.completed
                      : session.messageCount > 0
                      ? statusBadges.inProgress
                      : statusBadges.pending
                    }
                  `}>
                    {session.isComplete ? (
                      <>
                        <CheckCircle size={10} className="inline mr-1" />
                        <span className="hidden sm:inline">Complete</span>
                        <span className="sm:hidden">✓</span>
                      </>
                    ) : session.messageCount > 0 ? (
                      <>
                        <MessageSquare size={10} className="inline mr-1" />
                        <span className="hidden sm:inline">In Progress</span>
                        <span className="sm:hidden">●</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">New</span>
                        <span className="sm:hidden">○</span>
                      </>
                    )}
                  </span>
                  <ArrowRight 
                    size={16} 
                    className={`
                      ${textColors.muted} 
                      group-hover:translate-x-1 
                      transition-transform duration-200
                      hidden md:block
                    `} 
                  />
                </div>
              </div>

              {/* Last Message Preview */}
              {session.lastMessage && (
                <div className={`
                  p-3 rounded-lg border-l-4 border-blue-400/30 mb-3
                  ${backgroundColors.accent}
                `}>
                  <p className={`text-sm ${textColors.accent} line-clamp-2`}>
                    {session.lastMessage}
                  </p>
                </div>
              )}

              {/* Session Metadata */}
              <div className={`flex items-center gap-2 text-xs ${textColors.muted}`}>
                <Clock size={12} />
                <span>Created {formatDate(session.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 