"use client"

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { DatabaseStudyNote } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Edit3, Save, X, FileText, Clock, CheckCircle, Search, Filter, Tag, Trash2, Download, Share2, Copy, Mail, ArrowLeft } from 'lucide-react'
import { saveAs } from 'file-saver'
import { useSwipeable } from 'react-swipeable'
import { useTheme } from '@/contexts/theme-context'
import { textColors, backgroundColors, borderColors, buttonStyles, inputStyles, statusBadges, overlayStyles, gradientStyles, responsiveUtils } from '@/lib/theme-utils'

// Import markdown editor styles
import '@uiw/react-md-editor/markdown-editor.css'

// Dynamically import the markdown editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

interface StudyNoteWithSession extends DatabaseStudyNote {
  session?: {
    topic: string
    created_at: string
    session_id: string
  }
}

export function JournalsTab() {
  const { isDarkMode } = useTheme()
  const [notes, setNotes] = useState<StudyNoteWithSession[]>([])
  const [selectedNote, setSelectedNote] = useState<StudyNoteWithSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [editedTags, setEditedTags] = useState<string[]>([])
  const [editedCategory, setEditedCategory] = useState('')
  const [editedStatus, setEditedStatus] = useState<'to_review' | 'reviewing' | 'mastered'>('to_review')
  const [isSaving, setIsSaving] = useState(false)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState('generated_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Tag management
  const [newTag, setNewTag] = useState('')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  // Filtered notes
  const [filteredNotes, setFilteredNotes] = useState<StudyNoteWithSession[]>([])
  const [isFiltering, setIsFiltering] = useState(false)

  // Export & Sharing state
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showBulkExportMenu, setShowBulkExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState('')

  // Mobile view state - determines if we're showing list or detail on mobile
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [isSwipeHintVisible, setIsSwipeHintVisible] = useState(true)

  useEffect(() => {
    loadStudyNotes()
  }, [])

  const loadStudyNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/study-notes')
      
      if (!response.ok) {
        throw new Error('Failed to load study notes')
      }

      const data = await response.json()
      const loadedNotes = data.notes || []
      
      setNotes(loadedNotes)
      setFilteredNotes(loadedNotes)
      
      // Auto-select first note if available
      if (loadedNotes.length > 0) {
        setSelectedNote(loadedNotes[0])
      }
    } catch (err) {
      console.error('Error loading notes:', err)
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Export Functions
  const exportAsMarkdown = async () => {
    if (!selectedNote) return
    
    setIsExporting(true)
    try {
      const content = generateMarkdownContent(selectedNote)
      const filename = generateFilename(selectedNote, 'md')
      
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      saveAs(blob, filename)
      
      showExportSuccess('Markdown file downloaded!')
    } catch (error) {
      console.error('Export failed:', error)
      showExportSuccess('Export failed. Please try again.', true)
    } finally {
      setIsExporting(false)
      setShowExportMenu(false)
    }
  }

  const exportAsHTML = async () => {
    if (!selectedNote) return
    
    setIsExporting(true)
    try {
      const content = generateHTMLContent(selectedNote)
      const filename = generateFilename(selectedNote, 'html')
      
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
      saveAs(blob, filename)
      
      showExportSuccess('HTML file downloaded! Open in browser and print to PDF.')
    } catch (error) {
      console.error('Export failed:', error)
      showExportSuccess('Export failed. Please try again.', true)
    } finally {
      setIsExporting(false)
      setShowExportMenu(false)
    }
  }

  const copyToClipboard = async () => {
    if (!selectedNote) return
    
    setIsExporting(true)
    try {
      const content = generatePlainTextContent(selectedNote)
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = content
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      
      showExportSuccess('Copied to clipboard!')
    } catch (error) {
      console.error('Copy failed:', error)
      showExportSuccess('Copy failed. Please try again.', true)
    } finally {
      setIsExporting(false)
      setShowExportMenu(false)
    }
  }

  const shareViaEmail = () => {
    if (!selectedNote) return
    
    const subject = encodeURIComponent(`Study Notes: ${selectedNote.custom_title || selectedNote.session?.topic || 'Medical Notes'}`)
    const body = encodeURIComponent(generateEmailContent(selectedNote))
    
    window.open(`mailto:?subject=${subject}&body=${body}`)
    setShowShareModal(false)
  }

  // Bulk Export Functions
  const exportAllAsMarkdown = async () => {
    setIsExporting(true)
    try {
      const allNotes = filteredNotes.length > 0 ? filteredNotes : notes
      const content = generateBulkMarkdownContent(allNotes)
      const filename = `carson-study-notes-collection-${new Date().toISOString().split('T')[0]}.md`
      
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      saveAs(blob, filename)
      
      showExportSuccess(`${allNotes.length} notes exported as Markdown!`)
    } catch (error) {
      console.error('Bulk export failed:', error)
      showExportSuccess('Export failed. Please try again.', true)
    } finally {
      setIsExporting(false)
      setShowBulkExportMenu(false)
    }
  }

  const exportAllAsHTML = async () => {
    setIsExporting(true)
    try {
      const allNotes = filteredNotes.length > 0 ? filteredNotes : notes
      const content = generateBulkHTMLContent(allNotes)
      const filename = `carson-study-notes-collection-${new Date().toISOString().split('T')[0]}.html`
      
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
      saveAs(blob, filename)
      
      showExportSuccess(`${allNotes.length} notes exported as HTML! Open in browser and print to PDF.`)
    } catch (error) {
      console.error('Bulk export failed:', error)
      showExportSuccess('Export failed. Please try again.', true)
    } finally {
      setIsExporting(false)
      setShowBulkExportMenu(false)
    }
  }

  // Helper Functions
  const generateMarkdownContent = (note: StudyNoteWithSession): string => {
    return `# ${note.custom_title || note.session?.topic || 'Study Notes'}

**Generated:** ${formatDate(note.generated_at)}
${note.last_edited ? `**Last Edited:** ${formatDate(note.last_edited)}` : ''}
${note.category ? `**Medical Field:** ${note.category}` : ''}
${note.tags?.length ? `**Tags:** ${note.tags.join(', ')}` : ''}
${note.study_status ? `**Status:** ${getStatusLabel(note.study_status)}` : ''}

---

${note.content}

---
*Generated by Carson - Your AI Medical Learning Companion*`
  }

  const generateHTMLContent = (note: StudyNoteWithSession): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${note.custom_title || note.session?.topic || 'Study Notes'}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 40px 20px; 
      color: #333; 
    }
    h1 { color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    .meta { 
      background: #f8fafc; 
      padding: 15px; 
      border-radius: 8px; 
      margin: 20px 0; 
      border-left: 4px solid #3b82f6; 
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      font-size: 14px; 
      color: #6b7280; 
      text-align: center; 
    }
    strong { color: #1f2937; }
    @media print { 
      body { margin: 0; padding: 20px; }
      .meta { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${note.custom_title || note.session?.topic || 'Study Notes'}</h1>
  
  <div class="meta">
    <strong>Generated:</strong> ${formatDate(note.generated_at)}<br>
    ${note.last_edited ? `<strong>Last Edited:</strong> ${formatDate(note.last_edited)}<br>` : ''}
    ${note.category ? `<strong>Medical Field:</strong> ${note.category}<br>` : ''}
    ${note.tags?.length ? `<strong>Tags:</strong> ${note.tags.join(', ')}<br>` : ''}
    ${note.study_status ? `<strong>Status:</strong> ${getStatusLabel(note.study_status)}` : ''}
  </div>
  
  ${formatNoteContent(note.content)}
  
  <div class="footer">
    Generated by Carson - Your AI Medical Learning Companion
  </div>
</body>
</html>`
  }

  const generatePlainTextContent = (note: StudyNoteWithSession): string => {
    return `${note.custom_title || note.session?.topic || 'Study Notes'}

Generated: ${formatDate(note.generated_at)}
${note.category ? `Medical Field: ${note.category}` : ''}
${note.tags?.length ? `Tags: ${note.tags.join(', ')}` : ''}
${note.study_status ? `Status: ${getStatusLabel(note.study_status)}` : ''}

${note.content}

---
Generated by Carson`
  }

  const generateEmailContent = (note: StudyNoteWithSession): string => {
    return `Hi,

I wanted to share these study notes I created with Carson:

${note.custom_title || note.session?.topic || 'Study Notes'}
Generated: ${formatDate(note.generated_at)}
${note.category ? `Medical Field: ${note.category}` : ''}

${note.content.length > 1000 ? note.content.substring(0, 1000) + '...\n\n[Note truncated for email - see attached file for full content]' : note.content}

---
Generated by Carson - AI Medical Learning Companion`
  }

  const generateBulkMarkdownContent = (notes: StudyNoteWithSession[]): string => {
    return `# Carson Study Notes Collection

*Generated on ${new Date().toLocaleDateString()}*
*Total Notes: ${notes.length}*

---

${notes.map(note => `
# ${note.custom_title || note.session?.topic || 'Study Notes'}

**Generated:** ${formatDate(note.generated_at)}
${note.last_edited ? `**Last Edited:** ${formatDate(note.last_edited)}` : ''}
${note.category ? `**Medical Field:** ${note.category}` : ''}
${note.tags?.length ? `**Tags:** ${note.tags.join(', ')}` : ''}
${note.study_status ? `**Status:** ${getStatusLabel(note.study_status)}` : ''}

---

${note.content}

---

`).join('\n')}

*Generated by Carson - Your AI Medical Learning Companion*`
  }

  const generateBulkHTMLContent = (notes: StudyNoteWithSession[]): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Carson Study Notes Collection</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 40px 20px; 
      color: #333; 
    }
    h1 { 
      color: #1f2937; 
      border-bottom: 3px solid #3b82f6; 
      padding-bottom: 10px; 
      page-break-before: always; 
    }
    h1:first-of-type { page-break-before: auto; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    .meta { 
      background: #f8fafc; 
      padding: 15px; 
      border-radius: 8px; 
      margin: 20px 0; 
      border-left: 4px solid #3b82f6; 
    }
    .note-separator { 
      margin: 60px 0; 
      border-top: 2px solid #e5e7eb; 
      page-break-before: always;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      font-size: 14px; 
      color: #6b7280; 
      text-align: center; 
    }
    strong { color: #1f2937; }
    @media print { 
      body { margin: 0; padding: 20px; }
      h1 { page-break-before: always; }
      h1:first-of-type { page-break-before: auto; }
      .meta { break-inside: avoid; }
      .note-separator { page-break-before: always; }
    }
  </style>
</head>
<body>
  <h1>Carson Study Notes Collection</h1>
  <div class="meta">
    <strong>Generated:</strong> ${new Date().toLocaleDateString()}<br>
    <strong>Total Notes:</strong> ${notes.length}
  </div>
  
  ${notes.map((note, index) => `
    ${index > 0 ? '<div class="note-separator"></div>' : ''}
    <h1>${note.custom_title || note.session?.topic || 'Study Notes'}</h1>
    
    <div class="meta">
      <strong>Generated:</strong> ${formatDate(note.generated_at)}<br>
      ${note.last_edited ? `<strong>Last Edited:</strong> ${formatDate(note.last_edited)}<br>` : ''}
      ${note.category ? `<strong>Medical Field:</strong> ${note.category}<br>` : ''}
      ${note.tags?.length ? `<strong>Tags:</strong> ${note.tags.join(', ')}<br>` : ''}
      ${note.study_status ? `<strong>Status:</strong> ${getStatusLabel(note.study_status)}` : ''}
    </div>
    
    ${formatNoteContent(note.content)}
  `).join('')}
  
  <div class="footer">
    Generated by Carson - Your AI Medical Learning Companion
  </div>
</body>
</html>`
  }

  const generateFilename = (note: StudyNoteWithSession, extension: string): string => {
    const title = note.custom_title || note.session?.topic || 'study-notes'
    const cleanTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const date = new Date(note.generated_at).toISOString().split('T')[0]
    return `${cleanTitle}-${date}.${extension}`
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'to_review': return '📚 To Review'
      case 'reviewing': return '📖 Studying'
      case 'mastered': return '✅ Mastered'
      default: return status
    }
  }

  const showExportSuccess = (message: string, isError = false) => {
    setExportSuccess(message)
    setTimeout(() => setExportSuccess(''), isError ? 5000 : 3000)
  }

  // Mobile-first navigation
  const handleNoteSelect = (note: StudyNoteWithSession) => {
    setSelectedNote(note)
    setMobileView('detail') // Switch to detail view on mobile
  }

  const handleBackToList = () => {
    setMobileView('list')
    setSelectedNote(null)
  }

  // Swipe gesture handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => {
      // Swipe right to go back to list (only on mobile in detail view)
      if (mobileView === 'detail' && window.innerWidth < 1024) {
        setIsSwipeHintVisible(false) // Hide hint after first use
        handleBackToList()
      }
    },
    onSwiping: (eventData) => {
      // Provide visual feedback during swipe
      if (eventData.dir === 'Right' && mobileView === 'detail' && window.innerWidth < 1024) {
        // Could add visual feedback here if needed
      }
    },
    trackMouse: false, // Only track touch, not mouse
    trackTouch: true,
    delta: 50, // Minimum swipe distance
    preventScrollOnSwipe: false, // Allow vertical scrolling
    touchEventOptions: { passive: true }
  })

  // Hide swipe hint after a few seconds or when back button is used
  useEffect(() => {
    if (mobileView === 'detail') {
      const timer = setTimeout(() => {
        setIsSwipeHintVisible(false)
      }, 5000) // Hide after 5 seconds
      return () => clearTimeout(timer)
    }
  }, [mobileView])

  // Keyboard shortcuts for editing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditing && (event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        saveNote()
      }
      if (isEditing && event.key === 'Escape') {
        cancelEditing()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing])

  const handleBackToListWithHint = () => {
    setIsSwipeHintVisible(false)
    handleBackToList()
  }

  // Editing Functions
  const startEditing = () => {
    if (!selectedNote) return
    setEditedContent(selectedNote.content)
    setEditedTitle(selectedNote.custom_title || selectedNote.session?.topic || '')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditedContent('')
    setEditedTitle('')
  }

  const saveNote = async () => {
    if (!selectedNote) return
    
    setIsSaving(true)
    try {
      // Here you would typically make an API call to save the note
      // For now, we'll update the local state
      const updatedNote = {
        ...selectedNote,
        content: editedContent,
        custom_title: editedTitle,
        last_edited: new Date().toISOString()
      }
      
      // Update the notes array
      const updatedNotes = notes.map(note => 
        note.id === selectedNote.id ? updatedNote : note
      )
      setNotes(updatedNotes)
      setFilteredNotes(updatedNotes)
      setSelectedNote(updatedNote)
      
      setIsEditing(false)
      showExportSuccess('Note saved successfully!')
    } catch (error) {
      console.error('Save failed:', error)
      showExportSuccess('Save failed. Please try again.', true)
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your study notes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">❌ {error}</p>
          <button 
            onClick={loadStudyNotes}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Study Notes Yet</h3>
          <p className="text-gray-600 mb-4">
            Complete a conversation with Carson to generate your first study notes.
          </p>
          <p className="text-sm text-gray-500">
            Notes will automatically appear here when you finish learning about a topic.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      {...swipeHandlers}
      className={`flex h-full ${backgroundColors.primary} transition-colors duration-200`}
    >
      {/* Desktop Sidebar: Notes List - Hidden on mobile when in detail view */}
      <div className={`
        ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}
        lg:w-96 xl:w-80 w-full
        ${backgroundColors.card} ${borderColors.primary}
        lg:border-r flex-col h-full
      `}>
        <div className={`${responsiveUtils.spacing.md} ${borderColors.primary} border-b`}>
          {/* Mobile Back Button - Only show in detail view */}
          {mobileView === 'detail' && (
            <div className="flex items-center mb-6 lg:hidden">
              <button
                onClick={handleBackToList}
                className={`p-2 rounded-lg ${buttonStyles.ghost} transition-colors mr-3`}
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className={`text-xl font-bold ${textColors.primary}`}>Study Notes</h2>
            </div>
          )}

          {/* Carson-style Header */}
          <div className="text-center mb-8 hidden lg:block">
            <h2 className={`text-2xl font-bold ${textColors.primary} mb-3`}>Study Notes</h2>
            <p className={`${textColors.secondary} text-base`}>Your learning journey with Carson</p>
          </div>

          {/* Mobile Header - Only show in list view */}
          {mobileView === 'list' && (
            <div className="text-center mb-6 lg:hidden">
              <h2 className={`text-xl font-bold ${textColors.primary} mb-2`}>Study Notes</h2>
              <p className={`${textColors.secondary} text-sm`}>Your learning journey with Carson</p>
            </div>
          )}
          
          {/* Beautiful Search Bar - Carson Style */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className={textColors.muted} />
            </div>
            <input
              type="text"
              placeholder="Search your notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`
                w-full pl-12 pr-4 py-4 rounded-xl text-base border-0
                ${inputStyles.search}
                focus:outline-none focus:ring-2 transition-all duration-200
              `}
              style={{ fontSize: "16px" }}
            />
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm ${textColors.secondary}`}>
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </p>
            {notes.length > 1 && (
              <button
                onClick={() => setShowBulkExportMenu(true)}
                className={`
                  flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${buttonStyles.ghost}
                `}
                title="Export all notes"
              >
                <Download size={14} />
                Export All
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => handleNoteSelect(note)}
              className={`
                group relative p-5 mb-4 rounded-xl cursor-pointer transition-all duration-200
                ${selectedNote?.id === note.id 
                  ? `${gradientStyles.accent} shadow-lg ring-2 ring-blue-400/50 dark:ring-blue-400/50` 
                  : `${backgroundColors.card} ${backgroundColors.cardHover} hover:shadow-sm ${borderColors.primary} border`
                }
              `}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className={`
                    font-semibold text-base leading-tight mb-2 line-clamp-2
                    ${textColors.primary}
                  `}>
                    {note.custom_title || note.session?.topic || 'Untitled Note'}
                  </h3>
                  <p className={`text-sm ${textColors.secondary}`}>
                    {formatDistanceToNow(new Date(note.last_edited || note.generated_at))} ago
                  </p>
                </div>
                <span className={`
                  px-2.5 py-1 text-xs rounded-full font-medium flex-shrink-0 ml-3 border
                  ${note.status === 'completed' 
                    ? statusBadges.completed
                    : note.status === 'in_progress'
                    ? statusBadges.inProgress
                    : statusBadges.pending
                  }
                `}>
                  {getStatusLabel(note.status)}
                </span>
              </div>
              <div className={`flex items-center gap-2 text-xs ${textColors.muted}`}>
                <Clock size={12} />
                <span>{formatDate(note.generated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Selected Note - Full width on mobile, right side on desktop */}
      <div className={`
        ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}
        flex-1 flex-col
      `}>
        {selectedNote ? (
          <>
            {/* Header */}
            <div className={`
              ${backgroundColors.card} ${borderColors.primary}
              border-b ${responsiveUtils.spacing.md}
            `}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                {/* Mobile Header - Add left padding to avoid hamburger menu overlap */}
                <div className="min-w-0 flex-1 pl-12 lg:pl-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className={`
                        text-lg lg:text-xl xl:text-2xl font-bold leading-tight bg-transparent border-none outline-none
                        text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                        w-full focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2
                      `}
                      placeholder="Enter note title..."
                    />
                  ) : (
                    <h1 className="text-lg lg:text-xl xl:text-2xl font-bold leading-tight text-gray-900 dark:text-white">
                      {selectedNote.custom_title || selectedNote.session?.topic || 'Study Notes'}
                    </h1>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={cancelEditing}
                        className={`
                          inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                          bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                          text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600
                        `}
                      >
                        <X size={16} className="mr-2" />
                        Cancel
                      </button>
                      <button
                        onClick={saveNote}
                        disabled={isSaving}
                        className={`
                          inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                          bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                          text-white border border-blue-600 disabled:opacity-50
                        `}
                      >
                        <Save size={16} className="mr-2" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={startEditing}
                        className={`
                          inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                          bg-blue-600 hover:bg-blue-700 text-white border border-blue-600
                        `}
                        title="Edit note"
                      >
                        <Edit3 size={16} className="mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => setShowShareModal(true)}
                        className={`
                          inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                          bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                          text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600
                        `}
                      >
                        <Share2 size={16} className="mr-2" />
                        Share
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 pl-12 lg:pl-0">
                Generated {formatDate(selectedNote.generated_at)}
                {selectedNote.last_edited && selectedNote.last_edited !== selectedNote.generated_at && (
                  <span> • Edited {formatDate(selectedNote.last_edited)}</span>
                )}
              </p>
            </div>

            {/* Mobile Back Button - Clean text link style */}
            <div className="lg:hidden bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <button
                onClick={handleBackToListWithHint}
                className={`
                  inline-flex items-center gap-2 text-sm font-medium transition-colors
                  text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300
                `}
                aria-label="Back to notes list"
              >
                <ArrowLeft size={16} />
                Back to Notes
              </button>
            </div>

            {/* Swipe Hint for Mobile */}
            {isSwipeHintVisible && (
              <div className="lg:hidden bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2 animate-pulse">
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                  💡 Swipe right or use the back button above to return to notes list
                </p>
              </div>
            )}

            {/* Note Content */}
            <div className={`
              flex-1 overflow-y-auto
              ${backgroundColors.primary}
            `}>
              <div className="max-w-4xl mx-auto p-6 lg:p-8 xl:p-12">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className={`
                      rounded-lg border overflow-hidden
                      ${borderColors.primary}
                    `}>
                      <MDEditor
                        value={editedContent}
                        onChange={(value) => setEditedContent(value || '')}
                        data-color-mode={isDarkMode ? 'dark' : 'light'}
                        preview="edit"
                        hideToolbar={false}
                        height={600}
                        style={{
                          backgroundColor: 'transparent',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-4">
                        <span>💡 Tip: Use Markdown formatting for rich text</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Cmd+S</kbd>
                        <span>to save</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    className={`
                      prose prose-lg max-w-none
                      ${isDarkMode 
                        ? 'prose-invert prose-headings:text-white prose-p:text-gray-300 prose-strong:text-white prose-li:text-gray-300' 
                        : 'prose-gray'
                      }
                    `}
                    dangerouslySetInnerHTML={{ 
                      __html: formatNoteContent(selectedNote.content) 
                    }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className={`
            flex flex-col items-center justify-center h-full px-6 lg:px-8
            ${backgroundColors.primary}
          `}>
            <div className="text-center max-w-md">
              <div className={`
                w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center
                ${backgroundColors.secondary}
              `}>
                <FileText size={24} className={textColors.muted} />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${textColors.primary}`}>
                Select a note to get started
              </h3>
              <p className={`text-sm ${textColors.secondary}`}>
                Choose a study note from the sidebar to view its content and export options.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export Menu */}
      {showExportMenu && (
        <div className={`fixed inset-0 ${overlayStyles.backdrop} z-50 flex items-center justify-center p-4`}>
          <div className={`
            ${overlayStyles.modal}
            rounded-2xl border p-6 w-full max-w-md
          `}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${textColors.primary}`}>Export Notes</h3>
              <button
                onClick={() => setShowExportMenu(false)}
                className={`
                  p-2 rounded-lg transition-colors
                  ${buttonStyles.ghost}
                `}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={exportAsMarkdown}
                disabled={isExporting}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 disabled:opacity-50
                  ${gradientStyles.accent} ${borderColors.accent}
                `}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <div className={`font-medium ${textColors.primary}`}>Markdown (.md)</div>
                  <div className={`text-sm ${textColors.secondary}`}>Perfect for GitHub, Obsidian, or Notion</div>
                </div>
              </button>

              <button 
                onClick={exportAsHTML}
                disabled={isExporting}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 disabled:opacity-50
                  ${gradientStyles.success} ${borderColors.success}
                `}
              >
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Download size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <div className={`font-medium ${textColors.primary}`}>HTML for PDF</div>
                  <div className={`text-sm ${textColors.secondary}`}>Download HTML, then print to PDF</div>
                </div>
              </button>

              <button 
                onClick={copyToClipboard}
                disabled={isExporting}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 disabled:opacity-50
                  bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 border-purple-200 dark:border-purple-700
                `}
              >
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Copy size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <div className={`font-medium ${textColors.primary}`}>Copy to Clipboard</div>
                  <div className={`text-sm ${textColors.secondary}`}>Paste anywhere you need</div>
                </div>
              </button>
            </div>

            {exportSuccess && (
              <div className={`
                mt-4 p-3 rounded-lg border
                ${exportSuccess.includes('failed') 
                  ? `${backgroundColors.error} ${borderColors.error}` 
                  : `${backgroundColors.success} ${borderColors.success}`
                }
              `}>
                <div className={`
                  flex items-center gap-2
                  ${exportSuccess.includes('failed') 
                    ? textColors.error
                    : textColors.success
                  }
                `}>
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{exportSuccess}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className={`fixed inset-0 ${overlayStyles.backdrop} z-50 flex items-center justify-center p-4`}>
          <div className={`
            ${overlayStyles.modal}
            rounded-2xl border p-6 w-full max-w-md
          `}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${textColors.primary}`}>Share & Export</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className={`
                  p-2 rounded-lg transition-colors
                  ${buttonStyles.ghost}
                `}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              {/* Share Options */}
              <div className="mb-4">
                <h4 className={`text-sm font-medium ${textColors.primary} mb-3`}>Share</h4>
                <div className="space-y-2">
                  <button 
                    onClick={shareViaEmail}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
                      ${backgroundColors.card} ${borderColors.primary} hover:bg-gray-50 dark:hover:bg-gray-700
                    `}
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Mail size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                      <div className={`font-medium ${textColors.primary}`}>Share via Email</div>
                      <div className={`text-xs ${textColors.secondary}`}>Send to study partners or mentors</div>
                    </div>
                  </button>

                  <button 
                    onClick={copyToClipboard}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
                      ${backgroundColors.card} ${borderColors.primary} hover:bg-gray-50 dark:hover:bg-gray-700
                    `}
                  >
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Copy size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                      <div className={`font-medium ${textColors.primary}`}>Copy Text</div>
                      <div className={`text-xs ${textColors.secondary}`}>Copy formatted text to share anywhere</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Export Options */}
              <div>
                <h4 className={`text-sm font-medium ${textColors.primary} mb-3`}>Export</h4>
                <div className="space-y-2">
                  <button 
                    onClick={exportAsMarkdown}
                    disabled={isExporting}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 disabled:opacity-50
                      ${backgroundColors.card} ${borderColors.primary} hover:bg-gray-50 dark:hover:bg-gray-700
                    `}
                  >
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                      <FileText size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                      <div className={`font-medium ${textColors.primary}`}>Markdown (.md)</div>
                      <div className={`text-xs ${textColors.secondary}`}>Perfect for GitHub, Obsidian, or Notion</div>
                    </div>
                  </button>

                  <button 
                    onClick={exportAsHTML}
                    disabled={isExporting}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 disabled:opacity-50
                      ${backgroundColors.card} ${borderColors.primary} hover:bg-gray-50 dark:hover:bg-gray-700
                    `}
                  >
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                      <Download size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                      <div className={`font-medium ${textColors.primary}`}>HTML for PDF</div>
                      <div className={`text-xs ${textColors.secondary}`}>Download HTML, then print to PDF</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {exportSuccess && (
              <div className={`
                mt-4 p-3 rounded-lg border
                ${exportSuccess.includes('failed') 
                  ? `${backgroundColors.error} ${borderColors.error}` 
                  : `${backgroundColors.success} ${borderColors.success}`
                }
              `}>
                <div className={`
                  flex items-center gap-2
                  ${exportSuccess.includes('failed') 
                    ? textColors.error
                    : textColors.success
                  }
                `}>
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{exportSuccess}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Export Menu */}
      {showBulkExportMenu && (
        <div className={`fixed inset-0 ${overlayStyles.backdrop} z-50 flex items-center justify-center p-4`}>
          <div className={`
            ${overlayStyles.modal}
            rounded-2xl border p-6 w-full max-w-md
          `}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${textColors.primary}`}>Export All Notes</h3>
              <button
                onClick={() => setShowBulkExportMenu(false)}
                className={`
                  p-2 rounded-lg transition-colors
                  ${buttonStyles.ghost}
                `}
              >
                <X size={20} />
              </button>
            </div>

            <div className={`
              mb-4 p-4 rounded-xl border
              ${backgroundColors.accent} ${borderColors.accent}
            `}>
              <div className={`text-sm ${textColors.accent}`}>
                <strong>Ready to export:</strong> {notes.length} notes
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={exportAllAsMarkdown}
                disabled={isExporting}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 disabled:opacity-50
                  ${gradientStyles.accent} ${borderColors.accent}
                `}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <div className={`font-medium ${textColors.primary}`}>All as Markdown</div>
                  <div className={`text-sm ${textColors.secondary}`}>Combined markdown file with all notes</div>
                </div>
              </button>

              <button 
                onClick={exportAllAsHTML}
                disabled={isExporting}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 disabled:opacity-50
                  ${gradientStyles.success} ${borderColors.success}
                `}
              >
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Download size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <div className={`font-medium ${textColors.primary}`}>All as HTML</div>
                  <div className={`text-sm ${textColors.secondary}`}>Combined HTML file for PDF printing</div>
                </div>
              </button>
            </div>

            {exportSuccess && (
              <div className={`
                mt-4 p-3 rounded-lg border
                ${exportSuccess.includes('failed') 
                  ? `${backgroundColors.error} ${borderColors.error}` 
                  : `${backgroundColors.success} ${borderColors.success}`
                }
              `}>
                <div className={`
                  flex items-center gap-2
                  ${exportSuccess.includes('failed') 
                    ? textColors.error
                    : textColors.success
                  }
                `}>
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{exportSuccess}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple markdown-to-HTML converter for Carson's notes
function formatNoteContent(content: string): string {
  return content
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-6">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-800 dark:text-gray-200">$1</em>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-700 dark:text-gray-300">$1</li>')
    .replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1 mb-4">$1</ul>')
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 dark:text-gray-300">')
    .replace(/^(.*)$/gm, '<p class="mb-4 text-gray-700 dark:text-gray-300">$1</p>')
    .replace(/<\/p><p class="mb-4 text-gray-700 dark:text-gray-300"><h([1-6])/g, '<h$1')
    .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
} 