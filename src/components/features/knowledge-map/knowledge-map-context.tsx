"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Topic status types
export type TopicStatus = "red" | "yellow" | "green" | "unassessed"

// Topic interface
export interface Topic {
  id: string
  name: string
  status: TopicStatus
  progress?: {
    questionsAnswered: number
    totalQuestions: number
    currentQuestionType: 'parent' | 'child' | 'checkin'
  }
}

// Knowledge map context type
interface KnowledgeMapContextType {
  topics: Topic[]
  updateTopicStatus: (id: string, status: TopicStatus) => void
  updateTopicProgress: (id: string, progress: Topic['progress']) => void
  isMapOpen: boolean
  toggleMap: () => void
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>
  currentTopicName: string
  setCurrentTopicName: React.Dispatch<React.SetStateAction<string>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  currentSubtopicIndex: number
  setCurrentSubtopicIndex: React.Dispatch<React.SetStateAction<number>>
  clearKnowledgeMap: () => void
}

// Create context
const KnowledgeMapContext = createContext<KnowledgeMapContextType | undefined>(undefined)

// Hook to use the knowledge map context
export function useKnowledgeMap() {
  const context = useContext(KnowledgeMapContext)
  if (!context) {
    throw new Error("useKnowledgeMap must be used within a KnowledgeMapProvider")
  }
  return context
}

// Provider component
export function KnowledgeMapProvider({ children }: { children: ReactNode }) {
  // Initial topics - now with localStorage persistence
  const [topics, setTopics] = useState<Topic[]>([])
  const [currentTopicName, setCurrentTopicName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentSubtopicIndex, setCurrentSubtopicIndex] = useState(0)

  // State for knowledge map panel visibility
  const [isMapOpen, setIsMapOpen] = useState(false)

  // Load knowledge map state from localStorage on mount
  useEffect(() => {
    const savedTopics = localStorage.getItem('carsonKnowledgeMap');
    const savedTopicName = localStorage.getItem('carsonCurrentTopic');
    const savedSubtopicIndex = localStorage.getItem('carsonCurrentSubtopicIndex');
    
    if (savedTopics) {
      setTopics(JSON.parse(savedTopics));
    }
    if (savedTopicName) {
      setCurrentTopicName(savedTopicName);
    }
    if (savedSubtopicIndex) {
      setCurrentSubtopicIndex(parseInt(savedSubtopicIndex, 10));
    }
  }, []);

  // Save knowledge map state to localStorage whenever it changes
  useEffect(() => {
    if (topics.length > 0) {
      localStorage.setItem('carsonKnowledgeMap', JSON.stringify(topics));
    }
  }, [topics]);

  useEffect(() => {
    if (currentTopicName) {
      localStorage.setItem('carsonCurrentTopic', currentTopicName);
    }
  }, [currentTopicName]);

  useEffect(() => {
    localStorage.setItem('carsonCurrentSubtopicIndex', currentSubtopicIndex.toString());
  }, [currentSubtopicIndex]);

  // Function to update a topic's status
  const updateTopicStatus = (id: string, status: TopicStatus) => {
    setTopics((prevTopics) => prevTopics.map((topic) => (topic.id === id ? { ...topic, status } : topic)))
  }

  // Function to update a topic's progress
  const updateTopicProgress = (id: string, progress: Topic['progress']) => {
    setTopics((prevTopics) => 
      prevTopics.map((topic) => 
        topic.id === id ? { ...topic, progress } : topic
      )
    )
  }

  // Function to toggle the knowledge map panel
  const toggleMap = () => {
    setIsMapOpen((prev) => !prev)
  }

  // Function to clear the knowledge map (for new sessions)
  const clearKnowledgeMap = () => {
    setTopics([])
    setCurrentTopicName("")
    setCurrentSubtopicIndex(0)
    localStorage.removeItem('carsonKnowledgeMap')
    localStorage.removeItem('carsonCurrentTopic')
    localStorage.removeItem('carsonCurrentSubtopicIndex')
  }

  return (
    <KnowledgeMapContext.Provider value={{ 
      topics, 
      updateTopicStatus, 
      updateTopicProgress, 
      isMapOpen, 
      toggleMap, 
      setTopics, 
      currentTopicName, 
      setCurrentTopicName, 
      isLoading, 
      setIsLoading, 
      currentSubtopicIndex, 
      setCurrentSubtopicIndex,
      clearKnowledgeMap
    }}>
      {children}
    </KnowledgeMapContext.Provider>
  )
}
