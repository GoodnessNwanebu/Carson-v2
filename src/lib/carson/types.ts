// Core Types for Carson v3 Engine Architecture

export interface SessionContext {
  sessionId: string;
  topic: string;
  currentSubtopic: string;
  studentId?: string;
  createdAt: Date;
  lastUpdated: Date;
  subtopics: Subtopic[];
  conversationHistory: Turn[];
  gapStack: SubtopicState;
  slideContext?: SlideContext;
}

export interface Turn {
  id: string;
  role: 'student' | 'carson';
  content: string;
  timestamp: Date;
  metadata?: {
    subtopic: string;
    intent?: IntentType;
    assessment?: AssessmentResult;
    gaps?: Gap[];
  };
}

export interface Subtopic {
  id: string;
  title: string;
  description: string;
  order?: number;
  expectedConcepts?: string[];
  conceptWeights?: Record<string, number>; // concept -> importance (0-1)
  completed?: boolean;
  completionCriteria?: string[];
  // New StudyPath related fields
  primaryGaps: Set<string>;
  completedConcepts: Set<string>;
  currentFocus: string | null;
  isCompleted: boolean;
  difficulty?: 'fundamental' | 'intermediate' | 'advanced';
  estimatedDuration?: number; // minutes
  prerequisites?: string[];
  clinicalRelevance?: 'high' | 'medium' | 'low';
  category?: 'pathophysiology' | 'diagnosis' | 'treatment' | 'complications' | 'prevention';
}

export interface SubtopicState {
  primaryGaps: Set<string>;           // ALL missing core concepts
  currentFocus: string | null;        // What we're discussing now
  completedConcepts: Set<string>;     // Concepts student has demonstrated
  subtopicId: string;
}

export interface Gap {
  concept: string;
  type: 'in_scope' | 'out_of_scope';
  severity: 'critical' | 'important' | 'minor';
  targetSubtopic?: string; // for out_of_scope gaps
  attempts: number;        // remediation attempts
}

export interface AssessmentResult {
  status: 'correct' | 'partial' | 'incorrect' | 'off_topic';
  conceptsIdentified: string[];
  conceptsCorrect: string[];
  conceptsMissing: string[];
  confidence: number; // 0-1
  reasoning: string;
}

export interface ConversationStrategy {
  action: 'continue' | 'remediate' | 'transition' | 'acknowledge_curiosity';
  focus?: string;           // specific concept to focus on
  remediationType?: 'analogy' | 'step-by-step' | 'clinical-example' | 'simplify';
  nextSubtopic?: string;    // for transitions
}

export interface IntentType {
  classification: 'on_topic' | 'related_curiosity' | 'off_topic_curiosity';
  confidence: number;
  reasoning: string;
}

export interface SlideContext {
  relevantContent: string[];
  source: 'generic' | 'student_slides';
  lastUpdated?: Date;
}

// Engine Response Types
export interface OrchestrationResult {
  response: string;
  updatedContext: SessionContext;
  nextAction?: ConversationStrategy;
}

export interface ConversationContext {
  sessionContext: SessionContext;
  currentTurn: Turn;
  assessment: AssessmentResult;
  strategy: ConversationStrategy;
  gaps: Gap[];
}

// Configuration
export interface CarsonConfig {
  maxRemediationAttempts: number;
  gapSeverityThresholds: {
    critical: number;
    important: number;
  };
  completionThreshold: number; // % of concepts needed to complete subtopic
}

export interface StudyPath {
  topic: string;
  subtopics: Subtopic[];
  totalEstimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningObjectives: string[];
  createdAt: Date;
  lastUpdated: Date;
}

export const DEFAULT_CONFIG: CarsonConfig = {
  maxRemediationAttempts: 3,
  gapSeverityThresholds: {
    critical: 0.8,
    important: 0.6,
  },
  completionThreshold: 0.8,
}; 