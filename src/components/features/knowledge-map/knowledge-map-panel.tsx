"use client"

import { useState, useEffect } from "react"
import { useKnowledgeMap, type TopicStatus } from "./knowledge-map-context"
import { useSession } from "../conversation/session-context"
import { useScrollContext } from "../conversation/conversation"
import { cn } from "@/lib/utils"
import { Map, CheckCircle, AlertCircle, HelpCircle, Clock } from "lucide-react"
import { SlideInAnimation } from "./knowledge-map-animations"

// Progress dots component for showing subtopic progress
function ProgressDots({ currentPhase, questionsUsed }: { 
  currentPhase?: 'initial_assessment' | 'targeted_remediation' | 'application' | 'gap_acknowledgment' | 'complete';
  questionsUsed?: number;
}) {
  // Map phases to confidence building progression
  const getPhaseProgress = (phase?: string) => {
    switch (phase) {
      case 'initial_assessment': return 1; // Exploring understanding
      case 'targeted_remediation': return 2; // Building foundation
      case 'application': return 3; // Testing confidence
      case 'gap_acknowledgment': return 4; // Acknowledging limits
      case 'complete': return 4; // Confident mastery
      default: return 0;
    }
  };
  
  const progress = getPhaseProgress(currentPhase);
  const totalPhases = 4;
  
  const dots = Array.from({ length: totalPhases }, (_, i) => (
    <span
      key={i}
      className={cn(
        "w-1.5 h-1.5 rounded-full transition-colors duration-200",
        i < progress ? "bg-blue-500" : "bg-gray-300"
      )}
    />
  ));
  
  return (
    <div className="flex items-center space-x-1">
      <div className="flex space-x-0.5">
        {dots}
      </div>
    </div>
  );
}

// Custom hook for mobile detection
function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Check on mount
    checkMobile()
    
    // Add event listener
    window.addEventListener('resize', checkMobile)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export function KnowledgeMapPanel() {
  const { topics, isMapOpen, toggleMap, currentTopicName, isLoading, currentSubtopicIndex } = useKnowledgeMap()
  const { session } = useSession()
  const scrollContext = useScrollContext()
  const isMobile = useMobile()
  
  // Check if we're in conversation mode - use session data for more accurate detection
  const inConversation = !!(session && session.history && session.history.length > 1)
  
  // Determine if header is visible or will be visible (affects positioning)
  const headerVisible = scrollContext?.showStickyHeader && scrollContext?.isScrolled

  // Get status icon
  const getStatusIcon = (status: TopicStatus) => {
    switch (status) {
      case "red":
        return <AlertCircle size={16} className="text-red-600" />
      case "yellow":
        return <HelpCircle size={16} className="text-yellow-600" />
      case "green":
        return <CheckCircle size={16} className="text-green-600" />
      default:
        return <Clock size={16} className="text-gray-400" />
    }
  }

  return (
    <>
      {/* Map toggle button - positioned to avoid hamburger menu */}
      <button
        onClick={toggleMap}
        className={cn(
          "fixed z-[90] p-2 bg-white rounded-full shadow-xl hover:bg-gray-100 transition-all duration-200 drop-shadow-lg hover:shadow-2xl",
          // Always stay in normal position - above header
          "top-4 right-4"
        )}
        aria-label="Toggle knowledge map"
      >
        <Map size={20} className="text-gray-700" />
      </button>

      {/* Knowledge map panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[85] w-[320px] bg-white shadow-2xl transition-transform duration-300 transform drop-shadow-2xl",
          isMapOpen ? "translate-x-0" : "translate-x-full",
          "flex flex-col",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Knowledge Map</h2>
            <p className="text-sm text-gray-600">Track your learning progress</p>
          </div>
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {currentTopicName || "Topic"}
              </h3>
              {topics.length > 0 && (
                <span className="text-xs text-gray-400">
                  {topics.filter(t => t.status === 'green').length}/{topics.length} completed
                </span>
              )}
            </div>
            
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-6 w-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                <span className="text-gray-500 text-base">Generating subtopics...</span>
              </div>
            )}
            
            {!isLoading && topics.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8">
                <Map size={48} className="text-gray-300 mb-3" />
                <span className="text-gray-400 text-base">No subtopics yet</span>
                <span className="text-gray-400 text-sm">Start a conversation to begin</span>
              </div>
            )}
            
            <div className="space-y-3">
              {topics.map((topic, index) => {
                const isActive = index === currentSubtopicIndex;
                
                return (
                  <SlideInAnimation key={topic.id} delay={index * 100} direction="up">
                    <div 
                      className={cn(
                        "group relative p-4 rounded-lg border transition-all duration-200 hover:shadow-lg drop-shadow-sm",
                        isActive 
                          ? "border-blue-300 bg-blue-50 shadow-md drop-shadow-md" 
                          : "border-gray-200 bg-white hover:border-gray-300 hover:drop-shadow-md"
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r"></div>
                      )}
                      
                      {/* Topic content */}
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {getStatusIcon(topic.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={cn(
                            "text-sm font-medium transition-colors duration-200",
                            isActive ? "text-blue-900" : "text-gray-900"
                          )}>
                            {topic.name}
                          </h4>
                          {/* Progress dots - only show for active subtopic */}
                          {isActive && topic.progress?.currentPhase !== undefined && topic.progress?.questionsUsed !== undefined && (
                            <div className="mt-2">
                              <ProgressDots 
                                currentPhase={topic.progress.currentPhase} 
                                questionsUsed={topic.progress.questionsUsed} 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </SlideInAnimation>
                );
              })}
            </div>
          </div>
        </div>

        {/* Simplified Legend */}
        <div className="p-4 border-t bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Understanding Levels</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <Clock size={14} className="text-gray-400" />
              <span className="text-sm text-gray-600">Not yet assessed</span>
            </div>
            <div className="flex items-center space-x-3">
              <AlertCircle size={14} className="text-red-600" />
              <span className="text-sm text-gray-600">Needs more work</span>
            </div>
            <div className="flex items-center space-x-3">
              <HelpCircle size={14} className="text-yellow-600" />
              <span className="text-sm text-gray-600">Getting there</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-sm text-gray-600">Well understood</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile backdrop overlay when map is open */}
      {isMobile && isMapOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[82]" onClick={toggleMap} aria-hidden="true" />
      )}
    </>
  )
}
