// carsonTypes.ts

export type UnderstandingLevel = 'gap' | 'shaky' | 'understood';
export type SubtopicStatus = 'unassessed' | UnderstandingLevel;

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface Subtopic {
  id: string;
  title: string;
  status: SubtopicStatus;
  history: Message[];
  questionsAsked: number;
  correctAnswers: number;
  needsExplanation: boolean;
  
  // **NEW**: Triaging model status storage
  triagingStatus?: {
    hasInitialAssessment: boolean;
    gapAnalysis?: {
      criticalGaps: string[];
      importantGaps: string[];
      minorGaps: string[];
      strengthAreas: string[];
    };
    addressedGaps: string[];
    acknowledgedGaps: string[];
    questionsUsed: number;
    hasTestedApplication: boolean;
  };
}

export interface CarsonSessionContext {
  sessionId: string;
  topic: string;
  subtopics: Subtopic[];
  currentSubtopicIndex: number;
  
  // Current subtopic state tracking
  currentSubtopicState: 'assessing' | 'explaining' | 'checking' | 'complete' | 'completion_choice';
  currentQuestionType: 'parent' | 'child' | 'checkin';
  questionsAskedInCurrentSubtopic: number;
  correctAnswersInCurrentSubtopic: number;
  
  // Transition handling
  shouldTransition: boolean;
  isComplete: boolean;
  
  // Assessment tracking
  lastAssessment?: any; // Will be properly typed when assessment system is imported
  
  // Message history
  history: Message[];
} 