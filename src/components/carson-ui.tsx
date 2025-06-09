"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useSwipeable } from "react-swipeable"
import { Sidebar } from "./features/sidebar/sidebar"
import { SidebarProvider, useSidebarState } from "./features/sidebar/sidebar-context"
import { KnowledgeMapPanel } from "./features/knowledge-map/knowledge-map-panel"
import { Conversation } from "./features/conversation/conversation"
import { ErrorBoundary } from "./ui/error-boundary"
import { PenLine, GraduationCap, Code, Coffee, Sparkles, Plus, SendHorizonal, Telescope, Mic, MicOff, Camera, FileText, Image, HelpCircle } from "lucide-react"
import { useSession } from "./features/conversation/session-context"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/contexts/theme-context"
import { CarsonMainContent } from "./carson-main-content"
import { useKnowledgeMap } from "./features/knowledge-map/knowledge-map-context"

export default function CarsonUI() {
  console.log("CarsonUI")
  // Add viewport meta tag for better mobile behavior
  useEffect(() => {
    // Add viewport meta tag to prevent scaling and improve mobile rendering
    const meta = document.createElement("meta")
    meta.name = "viewport"
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
    document.head.appendChild(meta)
 
    // Add class to body for touch optimization only
    document.body.classList.add("touch-manipulation")
    
    // Add CSS for hover media queries
    const style = document.createElement("style")
    style.textContent = `
      @media (hover: none) and (pointer: coarse) {
        .hover\\:bg-gray-50:hover { background-color: inherit !important; }
        .hover\\:text-blue-600:hover { color: inherit !important; }
        .hover\\:bg-blue-50:hover { background-color: inherit !important; }
        .hover\\:border-blue-200:hover { border-color: inherit !important; }
        .hover\\:shadow-md:hover { box-shadow: inherit !important; }
        .hover\\:bg-blue-700:hover { background-color: inherit !important; }
        .hover\\:bg-red-600:hover { background-color: inherit !important; }
      }
      
      /* Ensure proper scrolling behavior */
      html, body {
        overflow: visible;
        height: 100%;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
      
      /* Ensure scrollable containers work properly */
      // .overflow-y-scroll {
      //   -webkit-overflow-scrolling: touch;
      //   overscroll-behavior: contain;
      // }
    `
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(meta)) document.head.removeChild(meta)
      if (document.head.contains(style)) document.head.removeChild(style)
      document.body.classList.remove("touch-manipulation")
    }
  }, [])

  return (
    <ThemeProvider>
      <SidebarProvider>
          <ErrorBoundary>
            <CarsonUIContent />
          </ErrorBoundary>
      </SidebarProvider>
    </ThemeProvider>
  )
}

function CarsonUIContent() {
  const [query, setQuery] = useState("")
  const [deepDive, setDeepDive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inConversation, setInConversation] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [initialTopic, setInitialTopic] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { collapsed, setSidebarOpen, sidebarOpen } = useSidebarState()
  const { isMapOpen, toggleMap, clearKnowledgeMap } = useKnowledgeMap()
  const { clearSession } = useSession()
  const [contentWidth, setContentWidth] = useState("max-w-2xl")

  // Voice-to-text state (Whisper-based)
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const conversationVoiceCallback = useRef<((transcript: string) => void) | null>(null);

  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Enhanced device and browser detection for voice features
  const getDeviceCapabilities = () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isChrome = /Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isEdge = /Edge/.test(userAgent);
    
    return {
      isIOS,
      isSafari,
      isAndroid, 
      isChrome,
      isFirefox,
      isEdge,
      isMobile: isIOS || isAndroid,
      supportsMediaRecorder: typeof MediaRecorder !== 'undefined',
      supportsGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  };

  // Get optimal audio configuration for current device/browser
  const getAudioConfig = () => {
    const capabilities = getDeviceCapabilities();
    
    // iOS Safari - very limited support
    if (capabilities.isIOS && capabilities.isSafari) {
      return {
        mimeType: 'audio/mp4', // Safest for iOS Safari
        codecs: '',
        fileExtension: 'mp4',
        fallbacks: ['audio/wav', 'audio/webm']
      };
    }
    
    // Android Chrome - good webm support
    if (capabilities.isAndroid && capabilities.isChrome) {
      return {
        mimeType: 'audio/webm;codecs=opus',
        codecs: 'opus',
        fileExtension: 'webm',
        fallbacks: ['audio/webm', 'audio/mp4', 'audio/wav']
      };
    }
    
    // Firefox - prefers webm but different codec
    if (capabilities.isFirefox) {
      return {
        mimeType: 'audio/webm;codecs=vorbis',
        codecs: 'vorbis', 
        fileExtension: 'webm',
        fallbacks: ['audio/webm', 'audio/wav']
      };
    }
    
    // Chrome desktop - best support
    if (capabilities.isChrome) {
      return {
        mimeType: 'audio/webm;codecs=opus',
        codecs: 'opus',
        fileExtension: 'webm',
        fallbacks: ['audio/webm', 'audio/wav']
      };
    }
    
    // Edge and others - safe fallback
    return {
      mimeType: 'audio/wav',
      codecs: '',
      fileExtension: 'wav',
      fallbacks: ['audio/wav', 'audio/webm']
    };
  };

  // Enhanced MediaRecorder support detection
  const checkMediaRecorderSupport = (mimeType: string) => {
    if (!MediaRecorder.isTypeSupported) return false;
    return MediaRecorder.isTypeSupported(mimeType);
  };

  // Initialize audio recording with cross-platform fallbacks
  const initializeRecording = async () => {
    if (mediaRecorder) return true; // Already initialized
    
    const capabilities = getDeviceCapabilities();
    
    // Check basic support first
    if (!capabilities.supportsGetUserMedia) {
      console.error('[Voice] getUserMedia not supported');
      return false;
    }
    
    if (!capabilities.supportsMediaRecorder) {
      console.error('[Voice] MediaRecorder not supported');
      return false;
    }
    
    try {
      // Request microphone access with enhanced constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Sample rate optimization based on device
          sampleRate: capabilities.isMobile ? 16000 : 44100,
          channelCount: 1, // Mono for efficiency
          ...(capabilities.isIOS && {
            // iOS-specific constraints
            sampleSize: 16,
            latency: 0.1
          })
        }
      };
      
      console.log('[Voice] Requesting microphone access with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[Voice] Microphone access granted');
      
      // Try to find best supported audio format
      const audioConfig = getAudioConfig();
      let selectedMimeType = audioConfig.mimeType;
      let selectedExtension = audioConfig.fileExtension;
      
      // Test primary format
      if (!checkMediaRecorderSupport(audioConfig.mimeType)) {
        console.warn(`[Voice] Primary format ${audioConfig.mimeType} not supported, trying fallbacks...`);
        
        // Try fallback formats
        let formatFound = false;
        for (const fallback of audioConfig.fallbacks) {
          if (checkMediaRecorderSupport(fallback)) {
            selectedMimeType = fallback;
            selectedExtension = fallback.includes('webm') ? 'webm' : 
                               fallback.includes('mp4') ? 'mp4' : 'wav';
            formatFound = true;
            console.log(`[Voice] Using fallback format: ${fallback}`);
            break;
          }
        }
        
        if (!formatFound) {
          // Last resort - try without codecs
          selectedMimeType = capabilities.isMobile ? 'audio/mp4' : 'audio/webm';
          selectedExtension = capabilities.isMobile ? 'mp4' : 'webm';
          console.warn(`[Voice] Using basic format as last resort: ${selectedMimeType}`);
        }
      } else {
        console.log(`[Voice] Using primary format: ${selectedMimeType}`);
      }
      
      // Create MediaRecorder with selected format
      const recorderOptions = selectedMimeType.includes('codecs') ? 
        { mimeType: selectedMimeType } : 
        { mimeType: selectedMimeType.split(';')[0] }; // Remove codecs if not supported
        
      const recorder = new MediaRecorder(stream, recorderOptions);
      
      // Store format info for later use (extending MediaRecorder)
      (recorder as any).selectedMimeType = selectedMimeType;
      (recorder as any).selectedExtension = selectedExtension;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[Voice] Audio chunk received: ${event.data.size} bytes`);
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = async () => {
        console.log('[Voice] Recording stopped');
        setIsRecording(false);
      };
      
      recorder.onerror = (event) => {
        console.error('[Voice] MediaRecorder error:', event);
        setIsRecording(false);
      };

      setMediaRecorder(recorder);
      console.log('[Voice] MediaRecorder initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[Voice] Error accessing microphone:', error);
      
      // Enhanced error handling with user-friendly messages
      const err = error as any;
      if (err.name === 'NotAllowedError') {
        console.error('[Voice] Microphone access denied by user');
        // Could show user guidance modal here
      } else if (err.name === 'NotFoundError') {
        console.error('[Voice] No microphone found');
      } else if (err.name === 'NotReadableError') {
        console.error('[Voice] Microphone already in use');
      } else if (err.name === 'OverconstrainedError') {
        console.error('[Voice] Microphone constraints cannot be satisfied');
      } else {
        console.error('[Voice] Unknown microphone error:', error);
      }
      
      return false;
    }
  };

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaRecorder]);

  // Handle voice recording toggle with enhanced error handling
  const toggleVoiceRecording = async () => {
    const capabilities = getDeviceCapabilities();
    
    // Show unsupported message for very old browsers
    if (!capabilities.supportsMediaRecorder || !capabilities.supportsGetUserMedia) {
      console.error('[Voice] Voice input not supported on this device/browser');
      // Could show user notification here
      return;
    }
    
    // Initialize microphone if not already done
    if (!mediaRecorder) {
      console.log('[Voice] Initializing recording...');
      const success = await initializeRecording();
      if (!success) {
        console.error('[Voice] Failed to initialize recording');
        // Could show error modal here
        return;
      }
    }

    if (!mediaRecorder) return;

    if (isRecording) {
      // Stop recording and transcribe
      console.log('[Voice] Stopping recording...');
      mediaRecorder.stop();
      setIsTranscribing(true);
      
      // Create audio blob with proper format
      const mimeType = (mediaRecorder as any).selectedMimeType || 'audio/webm';
      const extension = (mediaRecorder as any).selectedExtension || 'webm';
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      
      console.log(`[Voice] Created audio blob: ${audioBlob.size} bytes, type: ${mimeType}`);
      setAudioChunks([]); // Clear chunks for next recording
      
      try {
        // Send to transcription API with proper filename
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${extension}`);
        
        console.log('[Voice] Sending audio for transcription...');
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const { transcript } = await response.json();
          console.log('[Voice] Transcription received:', transcript);
          
          // Check if we're in conversation mode vs home screen mode
          if (inConversation) {
            // In conversation mode - set transcript for conversation component to pick up
            conversationVoiceCallback.current?.(transcript);
          } else {
            // Home screen mode - update query as before
          setQuery(prevQuery => prevQuery + (prevQuery ? ' ' : '') + transcript);
          
          // Auto-resize textarea after adding voice input
          if (inputRef.current) {
          setTimeout(() => {
            if (inputRef.current) {
              resizeTextarea(inputRef.current);
            }
          }, 10);
          }
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[Voice] Transcription failed:', response.statusText, errorData);
          // Could show user error notification here
        }
      } catch (error) {
        console.error('[Voice] Error during transcription:', error);
        // Could show user error notification here
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      console.log('[Voice] Starting recording...');
      setAudioChunks([]);
      
      try {
        // Start with appropriate time slice based on device
        const timeSlice = capabilities.isMobile ? 250 : 100; // Longer chunks on mobile for stability
        mediaRecorder.start(timeSlice);
      setIsRecording(true);
        console.log(`[Voice] Recording started with ${timeSlice}ms time slice`);
      } catch (error) {
        console.error('[Voice] Error starting recording:', error);
        setIsRecording(false);
      }
    }
  };

  // Swipe handlers for sidebar (left edge swipe) - always active for touch devices
  const sidebarSwipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (!sidebarOpen) {
        setSidebarOpen(true)
      }
    },
    onSwipedLeft: () => {
      if (sidebarOpen) {
        setSidebarOpen(false)
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50, // Minimum swipe distance
    preventScrollOnSwipe: false, // Allow scrolling
    touchEventOptions: { passive: true }
  })

  // Swipe handlers for knowledge map (right edge swipe) - always active for touch devices
  const knowledgeMapSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (!isMapOpen && inConversation) {
        toggleMap()
      }
    },
    onSwipedRight: () => {
      if (isMapOpen && inConversation) {
        toggleMap()
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false, // Allow scrolling
    touchEventOptions: { passive: true }
  })

  // Update content width when sidebar state changes - CSS responsive
  useEffect(() => {
    setContentWidth(collapsed ? "max-w-3xl" : "max-w-2xl")
  }, [collapsed])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    setIsLoading(true)
    setTimeout(() => {
      setIsTransitioning(true)
    }, 300)
    setTimeout(() => {
      setIsLoading(false)
      setInitialTopic(query)
      setInConversation(true)
    }, 1000)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 1200)
  }

  // Reset to home screen (new chat) - user controls sidebar manually
  const handleNewChat = () => {
    // Immediate state reset to prevent any lingering UI issues
    setIsTransitioning(true)
    
    // Clear everything immediately
    setQuery("")
    setInitialTopic(null)
    clearSession()
    clearKnowledgeMap()
    
    // Force transition to home screen after brief delay
    setTimeout(() => {
      setInConversation(false)
      setIsLoading(false)
      setIsTransitioning(false)
    }, 100)
  }

  // Auto-resize textarea with universal best practices
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    // Reset height to auto to get accurate scrollHeight measurement
    textarea.style.height = "auto"
    
    // Calculate content height
    const scrollHeight = textarea.scrollHeight
    
    // Set responsive max heights based on device
    const isMobile = window.innerWidth < 768
    const maxHeight = isMobile ? 80 : 120 // 3-4 lines mobile, 4-5 lines desktop
    const minHeight = 60 // Slightly larger minimum for home screen
    
    // Calculate final height within bounds
    const finalHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    
    // Apply height with smooth transition
    textarea.style.height = `${finalHeight}px`
    
    // Enable internal scrolling only when at max height
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setQuery(textarea.value)
    resizeTextarea(textarea);
  }

  // Focus the input field when clicking anywhere in the input container
  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  // Handle attachment option selection
  const handleAttachmentOption = (option: 'file' | 'camera' | 'photos') => {
    setShowAttachmentModal(false);
    // TODO: Implement attachment handling
    console.log(`Selected attachment option: ${option}`);
  };

  return (
    <div className="fixed inset-0 flex bg-gray-50 dark:bg-gray-900">
      <Sidebar onNewChat={handleNewChat} />

      {/* Only show knowledge map when in conversation */}
      {inConversation && <KnowledgeMapPanel />}

      {/* Left edge swipe zone for sidebar - only on mobile */}
      <div
        {...sidebarSwipeHandlers}
        className="fixed left-0 top-0 bottom-0 w-8 z-30 pointer-events-auto md:hidden"
        style={{ touchAction: 'pan-y pinch-zoom' }}
      />

      {/* Right edge swipe zone for knowledge map - only on mobile when in conversation */}
      {inConversation && (
        <div
          {...knowledgeMapSwipeHandlers}
          className="fixed right-0 top-0 bottom-0 w-8 z-30 pointer-events-auto md:hidden"
          style={{ touchAction: 'pan-y pinch-zoom' }}
        />
      )}

      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-700 ease-in-out h-full",
          // Responsive margins: no margin on mobile, responsive margin on desktop
          "ml-0 md:ml-[60px]",
          !collapsed && "md:ml-[260px]",
          isTransitioning && "opacity-20 scale-98 blur-sm",
        )}
        style={{ minHeight: 0 }}
      >
        <CarsonMainContent
          inConversation={inConversation}
          setInConversation={setInConversation}
          query={query}
          setQuery={setQuery}
          deepDive={deepDive}
          setDeepDive={setDeepDive}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          isTransitioning={isTransitioning}
          setIsTransitioning={setIsTransitioning}
          initialTopic={initialTopic}
          setInitialTopic={setInitialTopic}
          inputRef={inputRef}
          handleSubmit={handleSubmit}
          handleNewChat={handleNewChat}
          isRecording={isRecording}
          mediaRecorder={mediaRecorder}
          audioChunks={audioChunks}
          isTranscribing={isTranscribing}
          showAttachmentModal={showAttachmentModal}
          setShowAttachmentModal={setShowAttachmentModal}
          handleAttachmentOption={handleAttachmentOption}
          toggleVoiceRecording={toggleVoiceRecording}
          conversationVoiceCallback={conversationVoiceCallback}
        />
      </div>
    </div>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}

function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  return (
    <button
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-gray-700 rounded-lg sm:rounded-xl text-gray-700 dark:text-gray-200 text-sm sm:text-base font-medium transition-all duration-200 border border-gray-200 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 active:scale-95 active:bg-gray-50 dark:active:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md"
      onClick={onClick}
      type="button"
      role="button"
      tabIndex={0}
    >
      {icon}
      {label}
    </button>
  )
}
