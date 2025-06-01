// Question Bank Types for Past Question Solver Integration

export interface Question {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options?: QuestionOption[];
  correctAnswer: string | string[]; // Can be single or multiple correct answers
  explanation: string;
  wrongAnswerExplanations?: { [key: string]: string }; // Explanations for why wrong options are incorrect
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: string; // e.g., "2019 Board Exam", "Pharmacology Midterm"
  tags?: string[];
  timeLimit?: number; // in seconds
  references?: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionBank {
  id: string;
  name: string;
  description: string;
  source: string;
  year?: string;
  subject: string;
  questions: Question[];
  totalQuestions: number;
  estimatedTimeMinutes: number;
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard';
  createdAt: Date;
  uploadedBy?: string;
}

export interface QuestionBankSession {
  id: string;
  questionBankId: string;
  currentQuestionIndex: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'in_progress' | 'completed' | 'paused';
  responses: QuestionResponse[];
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  timeSpent: number; // in seconds
  mode: 'practice' | 'timed' | 'collaborative'; // collaborative is with Carson
}

export interface QuestionResponse {
  questionId: string;
  selectedAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  confidenceLevel?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  carsonInteraction?: CarsonQuestionInteraction;
  reviewNotes?: string;
}

export interface CarsonQuestionInteraction {
  reasoningDiscussion: ConversationMessage[];
  explanationProvided: boolean;
  additionalTopicsExplored: string[];
  knowledgeGapsIdentified: string[];
  masteryLevel: 'needs_review' | 'partial' | 'good' | 'excellent';
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'carson';
  content: string;
  timestamp: Date;
}

// File upload types
export interface QuestionBankUpload {
  file: File;
  format: 'json' | 'csv' | 'xlsx' | 'xml' | 'qti'; // QTI is for standardized question formats
  mapping?: FieldMapping;
}

export interface FieldMapping {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty?: string;
}

// View modes for the question solver interface
export type QuestionSolverMode = 'upload' | 'browse' | 'solving' | 'review';

export interface QuestionSolverContext {
  mode: QuestionSolverMode;
  currentBank?: QuestionBank;
  currentSession?: QuestionBankSession;
  currentQuestion?: Question;
  availableBanks: QuestionBank[];
  recentSessions: QuestionBankSession[];
} 