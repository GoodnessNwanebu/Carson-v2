// carsonTypes.ts

export type UnderstandingLevel = 'gap' | 'shaky' | 'understood';
export type SubtopicStatus = 'unassessed' | UnderstandingLevel;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Subtopic {
  id: string;
  title: string;
  status: SubtopicStatus;
  history: Message[];
}

export interface CarsonSessionContext {
  sessionId: string;
  topic: string;
  subtopics: Subtopic[];
  currentSubtopicIndex: number;
  history: Message[];
} 