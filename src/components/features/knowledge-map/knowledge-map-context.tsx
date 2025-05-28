"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

// Topic status types
export type TopicStatus = "red" | "yellow" | "green" | "unassessed"

// Topic interface
export interface Topic {
  id: string
  name: string
  status: TopicStatus
}

// Knowledge map context type
interface KnowledgeMapContextType {
  topics: Topic[]
  updateTopicStatus: (id: string, status: TopicStatus) => void
  isMapOpen: boolean
  toggleMap: () => void
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>
  currentTopicName: string
  setCurrentTopicName: React.Dispatch<React.SetStateAction<string>>
  isLoading: boolean
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
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
  // Initial topics for heart failure
  const [topics, setTopics] = useState<Topic[]>([])
  const [currentTopicName, setCurrentTopicName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // State for knowledge map panel visibility
  const [isMapOpen, setIsMapOpen] = useState(false)

  // Function to update a topic's status
  const updateTopicStatus = (id: string, status: TopicStatus) => {
    setTopics((prevTopics) => prevTopics.map((topic) => (topic.id === id ? { ...topic, status } : topic)))
  }

  // Function to toggle the knowledge map panel
  const toggleMap = () => {
    setIsMapOpen((prev) => !prev)
  }

  return (
    <KnowledgeMapContext.Provider value={{ topics, updateTopicStatus, isMapOpen, toggleMap, setTopics, currentTopicName, setCurrentTopicName, isLoading, setIsLoading }}>
      {children}
    </KnowledgeMapContext.Provider>
  )
}
