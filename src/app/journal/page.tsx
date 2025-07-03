import React from 'react';

export default function JournalPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Learning Journal</h2>
            <p className="text-gray-600 mt-1">Track your medical learning progress</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="text-center py-12">
          <div className="h-12 w-12 text-gray-400 mx-auto mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Journal feature coming soon</h3>
          <p className="text-gray-500 mb-6">
            Track your learning journey and insights with Carson
          </p>
        </div>
      </div>
    </div>
  );
} 