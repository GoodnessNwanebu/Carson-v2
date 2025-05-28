// promptEngine.ts

import { CarsonSessionContext } from './carsonTypes';

export function generatePrompt(context: CarsonSessionContext): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];

  if (!currentSubtopic) {
    // No subtopics yet, so prompt the LLM to generate them
    return `
You are Carson, a calm and intelligent medical tutor.
The topic is: ${context.topic}

Please break down this topic into key subtopics for a medical student to master. 
Return your response as a JSON object with an "introduction" and a "subtopics" array, where each subtopic has an "id", "title", and "description".
`.trim();
  }

  // Use the global session history for context
  const history = context.history
    .map((msg) => `${msg.role === "user" ? "Student" : "Carson"}: ${msg.content}`)
    .join("\n");

  return `
You are Carson, a calm and intelligent medical tutor.
The topic is: ${context.topic}
The current subtopic is: ${currentSubtopic.title}

Conversation history so far:
${history}

Ask the next question or offer a clue to help the student deepen understanding.
`.trim();
} 