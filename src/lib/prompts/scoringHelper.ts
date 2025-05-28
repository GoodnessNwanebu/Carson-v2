// scoringHelper.ts

import { Subtopic } from './carsonTypes';

export function assessUnderstanding(subtopic: Subtopic): 'gap' | 'shaky' | 'understood' {
  const historyLength = subtopic.history.length;

  if (historyLength < 2) {
    return 'shaky';
  }

  const recentAnswers = subtopic.history.slice(-2).join(' ').toLowerCase();

  if (recentAnswers.includes("i don't know") || recentAnswers.includes("unsure")) {
    return 'gap';
  }

  if (recentAnswers.includes("correct") || recentAnswers.includes("yes, that makes sense")) {
    return 'understood';
  }

  return 'shaky';
} 