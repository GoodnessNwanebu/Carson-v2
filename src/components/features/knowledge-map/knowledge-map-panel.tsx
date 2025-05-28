"use client"

import { useKnowledgeMap, type TopicStatus } from "./knowledge-map-context"
import { cn } from "@/lib/utils"
import { X, Map } from "lucide-react"
import { useSidebarState } from "../sidebar/sidebar-context"

export function KnowledgeMapPanel() {
  const { topics, isMapOpen, toggleMap, currentTopicName, isLoading } = useKnowledgeMap()
  const { isMobile } = useSidebarState()

  // Get status color class
  const getStatusColor = (status: TopicStatus) => {
    switch (status) {
      case "red":
        return "bg-red-500"
      case "yellow":
        return "bg-yellow-500"
      case "green":
        return "bg-green-500"
      default:
        return "bg-gray-300"
    }
  }

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
          "fixed inset-y-0 right-0 z-30 w-[280px] bg-white shadow-lg transition-transform duration-300 transform",
          isMapOpen ? "translate-x-0" : "translate-x-full",
          "flex flex-col",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium">Knowledge Map</h2>
          <button
            onClick={toggleMap}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close knowledge map"
          >
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{currentTopicName || "Topic"}</h3>
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="h-6 w-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                <span className="text-gray-500 text-base">Oops, just a minute</span>
              </div>
            )}
            {!isLoading && topics.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8">
                <span className="text-gray-400 text-base">No subtopics yet</span>
              </div>
            )}
            <div className="space-y-3">
              {topics.map((topic) => (
                <div key={topic.id} className="flex items-center space-x-3">
                  <div className={cn("w-3 h-3 rounded-full", getStatusColor(topic.status))} aria-hidden="true" />
                  <span className="text-gray-800">{topic.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
              <span className="text-sm text-gray-600">Mastered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" aria-hidden="true" />
              <span className="text-sm text-gray-600">Shaky</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true" />
              <span className="text-sm text-gray-600">Gap</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gray-300" aria-hidden="true" />
              <span className="text-sm text-gray-600">Not yet assessed</span>
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
