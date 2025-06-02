"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Conversation } from "./features/conversation/conversation"
import { PenLine, GraduationCap, Code, Coffee, Sparkles, Plus, SendHorizonal, Telescope, Mic, MicOff, Camera, FileText, Image } from "lucide-react"
import { useSidebarState } from "./features/sidebar/sidebar-context"
import { cn } from "@/lib/utils"

export function CarsonMainContent() {
  const [query, setQuery] = useState("")
  const [deepDive, setDeepDive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inConversation, setInConversation] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [initialTopic, setInitialTopic] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { isMobile } = useSidebarState()
  const [contentWidth, setContentWidth] = useState("max-w-2xl")

  // Voice-to-text state (Whisper-based)
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Attachment modal state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  // Initialize audio recording for initial input only when user clicks microphone
  const initializeRecording = async () => {
    if (mediaRecorder) return; // Already initialized
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Good compression, supported by OpenAI
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        // Will handle transcription in the toggle function
      };

      setMediaRecorder(recorder);
      return true; // Success
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false; // Failed
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

  // Handle voice recording toggle for initial input
  const toggleVoiceRecording = async () => {
    // Initialize microphone if not already done
    if (!mediaRecorder) {
      const success = await initializeRecording();
      if (!success) {
        // Could show error state here
        return;
      }
    }

    if (!mediaRecorder) return;

    if (isRecording) {
      // Stop recording and transcribe
      mediaRecorder.stop();
      setIsTranscribing(true);
      
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
      setAudioChunks([]); // Clear chunks for next recording
      
      try {
        // Send to our transcription API
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const { transcript } = await response.json();
          setQuery(prevQuery => prevQuery + (prevQuery ? ' ' : '') + transcript);
          
          // Auto-resize textarea after adding voice input - call immediately and with slight delay
          if (inputRef.current) {
            resizeTextarea(inputRef.current);
          }
          setTimeout(() => {
            if (inputRef.current) {
              resizeTextarea(inputRef.current);
            }
          }, 10);
        } else {
          console.error('Transcription failed:', response.statusText);
        }
      } catch (error) {
        console.error('Error during transcription:', error);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      setAudioChunks([]);
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    }
  };

  // Update content width when sidebar state changes
  useEffect(() => {
    if (isMobile) {
      setContentWidth("max-w-xl")
    } else {
      setContentWidth("max-w-2xl")
    }
  }, [isMobile])

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

  // Auto-resize textarea based on content
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    // Set the height to scrollHeight to fit the content, with stricter mobile limits
    const maxHeight = isMobile ? 80 : 120;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
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
    <div className={cn(
      "flex-1 flex flex-col transition-all duration-700 ease-in-out",
      isTransitioning && "opacity-20 scale-98 blur-sm",
    )}>
      {inConversation ? (
        // Conversation mode
        <div className="flex flex-col h-full animate-in fade-in duration-500">
          <Conversation initialTopic={initialTopic} onInitialTopicUsed={() => setInitialTopic(null)} />
        </div>
      ) : (
        // Initial input mode
        <div className="flex flex-col justify-center items-center h-full min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center items-center min-h-screen">
          <div className={cn("w-full transition-all duration-300 flex flex-col items-center", contentWidth)}>
              {/* Header Section */}
              <div className="text-center mb-12 sm:mb-16">
                <div className="inline-flex items-center gap-3 sm:gap-4 bg-white dark:bg-gray-800 px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 mb-12 sm:mb-16">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full"></div>
                  </div>
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Carson</span>
                </div>
                <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                  Your AI medical tutor for deep, interactive learning
                </p>
              </div>

              {/* Main Input Card */}
              <div className="w-full max-w-4xl mx-auto">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 relative">
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12"></div>
                  
                  <div className="relative">
                <form onSubmit={handleSubmit} className="w-full">
                  <div
                        className="relative rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200 dark:focus-within:ring-blue-800 transition-all duration-200"
                    onClick={handleContainerClick}
                  >
                    {/* Textarea input */}
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={handleInput}
                      placeholder="What would you like to understand better?"
                      className="w-full px-4 sm:px-6 py-4 sm:py-6 min-h-[60px] sm:min-h-[80px] max-h-[80px] sm:max-h-[150px] md:max-h-[200px] text-base sm:text-lg bg-transparent border-0 focus:ring-0 focus:outline-none resize-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white overflow-hidden"
                      style={{ fontSize: "16px" }}
                      rows={1}
                      disabled={isLoading || isTransitioning}
                      autoComplete="off"
                      autoCorrect="on"
                      spellCheck="true"
                      enterKeyHint="send"
                      inputMode="text"
                      autoCapitalize="sentences"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          if (query.trim() && !isLoading && !isTransitioning) {
                            handleSubmit(e)
                          }
                        }
                      }}
                    />

                    {/* Bottom toolbar */}
                        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-600 p-2 sm:p-3">
                      {/* Left side tools */}
                          <div className="flex items-center space-x-2 relative">
                        <button
                          type="button"
                              onClick={() => setShowAttachmentModal(!showAttachmentModal)}
                              className="p-2 sm:p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          disabled={isLoading || isTransitioning}
                        >
                              <Plus size={isMobile ? 18 : 20} />
                        </button>

                            {/* Attachment options dropdown */}
                            {showAttachmentModal && (
                              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-3 z-50 min-w-[200px] drop-shadow-lg">
                                <button
                                  onClick={() => handleAttachmentOption('file')}
                                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">File</span>
                                </button>
                                <button
                                  onClick={() => handleAttachmentOption('camera')}
                                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <Camera size={18} className="text-green-600 dark:text-green-400" />
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Camera</span>
                                </button>
                                <button
                                  onClick={() => handleAttachmentOption('photos')}
                                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <Image size={18} className="text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Photos</span>
                                </button>
                              </div>
                            )}

                        <button
                          type="button"
                          onClick={() => setDeepDive(!deepDive)}
                          disabled={isLoading || isTransitioning}
                          className={cn(
                                "p-2 sm:p-3 rounded-lg transition-all duration-200 flex items-center gap-2",
                            deepDive
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                  : "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                          )}
                          title={deepDive ? "Deep dive enabled" : "Enable deep dive for detailed explanations"}
                        >
                              <Telescope size={isMobile ? 18 : 20} />
                              {deepDive && <span className="text-sm font-medium">Deep dive</span>}
                        </button>
                      </div>

                          {/* Right side - single button that switches between mic and send */}
                          <div className="flex items-center">
                            {query.trim() ? (
                              // Send button when there's text
                      <button
                        type="submit"
                                disabled={isLoading || isTransitioning}
                                className="p-2 sm:p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-sm"
                      >
                        {isLoading || isTransitioning ? (
                          <div className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white border-t-transparent rounded-full animate-spin no-transition"></div>
                        ) : (
                          <SendHorizonal size={isMobile ? 18 : 20} />
                        )}
                      </button>
                            ) : (
                              // Microphone button when input is empty
                              <button
                                type="button"
                                onClick={toggleVoiceRecording}
                                disabled={isLoading || isTransitioning || isTranscribing}
                                className={cn(
                                  "p-2 sm:p-3 rounded-lg transition-all duration-200",
                                  isRecording
                                    ? "bg-red-500 text-white hover:bg-red-600"
                                    : isTranscribing
                                    ? "bg-blue-500 text-white"
                                    : "text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                                  (isLoading || isTransitioning || isTranscribing) && "cursor-not-allowed opacity-50"
                                )}
                                title={
                                  isTranscribing 
                                    ? "Transcribing..." 
                                    : isRecording 
                                    ? "Stop recording" 
                                    : "Start voice input"
                                }
                              >
                                {isTranscribing ? (
                                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin no-transition"></div>
                                ) : isRecording ? (
                                  <MicOff size={isMobile ? 18 : 20} />
                                ) : (
                                  <Mic size={isMobile ? 18 : 20} />
                        )}
                      </button>
                            )}
                          </div>
                    </div>
                  </div>
                </form>

                {/* Quick action buttons - responsive */}
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-6 sm:mt-8">
                      <QuickActionButton icon={<PenLine size={isMobile ? 16 : 18} />} label="Explain" />
                      <QuickActionButton icon={<GraduationCap size={isMobile ? 16 : 18} />} label="Learn" />
                      <QuickActionButton icon={<Code size={isMobile ? 16 : 18} />} label="Mechanisms" />
                      <QuickActionButton icon={<Coffee size={isMobile ? 16 : 18} />} label="Simplify" />
                      <QuickActionButton icon={<Sparkles size={isMobile ? 16 : 18} />} label="Carson's choice" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}

function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  const { isMobile } = useSidebarState()

  return (
    <button
      className={cn(
        "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-gray-700 rounded-lg sm:rounded-xl text-gray-700 dark:text-gray-200 text-sm sm:text-base font-medium transition-all duration-200 border border-gray-200 dark:border-gray-600 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
        "active:scale-95 active:bg-gray-50 dark:active:bg-gray-600",
        !isMobile && "hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md"
      )}
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