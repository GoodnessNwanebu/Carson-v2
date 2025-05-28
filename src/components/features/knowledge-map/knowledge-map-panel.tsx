"use client"

import { useKnowledgeMap, type TopicStatus } from "./knowledge-map-context"
import { cn } from "@/lib/utils"
import { X, Map, Target, CheckCircle, AlertCircle, HelpCircle, Clock } from "lucide-react"
import { useSidebarState } from "../sidebar/sidebar-context"
import { ProgressAnimation, StatusChangeAnimation, SlideInAnimation, PulseIndicator } from "./knowledge-map-animations"

export function KnowledgeMapPanel() {
  const { topics, isMapOpen, toggleMap, currentTopicName, isLoading, currentSubtopicIndex } = useKnowledgeMap()
  const { isMobile } = useSidebarState()

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

  // Get question type badge
  const getQuestionTypeBadge = (questionType: 'parent' | 'child' | 'checkin') => {
    const badges = {
      parent: { label: "Core", color: "bg-blue-100 text-blue-800" },
      child: { label: "Deep", color: "bg-purple-100 text-purple-800" },
      checkin: { label: "Check", color: "bg-orange-100 text-orange-800" }
    };
    
    const badge = badges[questionType];
    return (
      <span className={cn("px-2 py-1 text-xs font-medium rounded-full", badge.color)}>
        {badge.label}
      </span>
    );
  };

  // Get progress percentage
  const getProgressPercentage = (questionsAnswered: number, totalQuestions: number) => {
    return Math.round((questionsAnswered / totalQuestions) * 100);
  };

  return (
    <>
      {/* Map toggle button - positioned to avoid hamburger menu */}
      <button
        onClick={toggleMap}
        className={cn(
          "fixed z-50 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors",
          isMobile ? "top-4 right-4" : "top-4 right-4",
        )}
        aria-label="Toggle knowledge map"
      >
        <Map size={20} className="text-gray-700" />
      </button>

      {/* Knowledge map panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-30 w-[320px] bg-white shadow-lg transition-transform duration-300 transform",
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
          <button
            onClick={toggleMap}
            className="p-1 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="Close knowledge map"
          >
            <X size={20} className="text-gray-700" />
          </button>
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
                const progress = topic.progress;
                
                return (
                  <SlideInAnimation key={topic.id} delay={index * 100} direction="up">
                    <StatusChangeAnimation status={topic.status}>
                      <div 
                        className={cn(
                          "group relative p-3 rounded-lg border transition-all duration-200 hover:shadow-md",
                          isActive 
                            ? "border-blue-300 bg-blue-50 shadow-sm" 
                            : "border-gray-200 bg-white hover:border-gray-300"
                        )}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r animate-pulse"></div>
                        )}
                        
                        {/* Topic header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-shrink-0">
                              <StatusChangeAnimation status={topic.status}>
                                {getStatusIcon(topic.status)}
                              </StatusChangeAnimation>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={cn(
                                "text-sm font-medium truncate transition-colors duration-200",
                                isActive ? "text-blue-900" : "text-gray-900"
                              )}>
                                {topic.name}
                              </h4>
                            </div>
                          </div>
                          
                          {isActive && (
                            <Target size={16} className="text-blue-500 flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        
                        {/* Progress bar and details */}
                        {progress && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">
                                Progress: {progress.questionsAnswered}/{progress.totalQuestions}
                              </span>
                              <div className="transition-all duration-200">
                                {getQuestionTypeBadge(progress.currentQuestionType)}
                              </div>
                            </div>
                            
                            <ProgressAnimation 
                              progress={getProgressPercentage(progress.questionsAnswered, progress.totalQuestions)}
                              status={topic.status}
                              isActive={isActive}
                            />
                          </div>
                        )}
                        
                        {/* Status indicator dot with pulse */}
                        <div className="absolute top-3 right-3">
                          <PulseIndicator 
                            isActive={isActive} 
                            color={topic.status === 'green' ? 'green' : 
                                   topic.status === 'yellow' ? 'yellow' : 
                                   topic.status === 'red' ? 'red' : 'blue'} 
                          />
                        </div>
                      </div>
                    </StatusChangeAnimation>
                  </SlideInAnimation>
                );
              })}
            </div>
          </div>
        </div>

        {/* Enhanced Legend */}
        <div className="p-4 border-t bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Understanding Levels</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm text-gray-700">Mastered</span>
              </div>
              <span className="text-xs text-gray-500">Solid understanding</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HelpCircle size={16} className="text-yellow-600" />
                <span className="text-sm text-gray-700">Shaky</span>
              </div>
              <span className="text-xs text-gray-500">Needs reinforcement</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} className="text-red-600" />
                <span className="text-sm text-gray-700">Gap</span>
              </div>
              <span className="text-xs text-gray-500">Requires explanation</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm text-gray-700">Not assessed</span>
              </div>
              <span className="text-xs text-gray-500">Waiting to explore</span>
            </div>
          </div>
          
          {/* Question type legend */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <h5 className="text-xs font-medium text-gray-700 mb-2">Question Types</h5>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                Core - Fundamental concepts
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                Deep - Advanced understanding
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                Check - Verify comprehension
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile backdrop overlay when map is open */}
      {isMobile && isMapOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20" onClick={toggleMap} aria-hidden="true" />
      )}
    </>
  )
}
