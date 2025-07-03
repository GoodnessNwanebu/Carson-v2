"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Clock, MessageSquare, Trash2 } from "lucide-react"

export function RecentsTab() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recent Sessions</h2>
            <p className="text-gray-600 mt-1">Continue your learning journey</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recent sessions</h3>
          <p className="text-gray-500 mb-6">
            Start a new conversation to begin your medical learning journey
          </p>
          <Button>
            Start New Session
          </Button>
        </div>
      </div>
    </div>
  )
} 