import { Subtopic } from './carsonTypes';

interface TransitionContext {
  currentSubtopic: string;
  nextSubtopic?: string;
  topic: string;
  userStruggled: boolean;
  isLastSubtopic: boolean;
  userPerformance: 'excellent' | 'good' | 'struggled';
}

const transitionTemplates = {
  // When user shows understanding
  positive: [
    "Good - you've got {currentSubtopic} down. Now let's talk about {nextSubtopic}. Ready?",
    "Right, {currentSubtopic} makes sense to you. Moving to {nextSubtopic} now.",
    "You understand {currentSubtopic}. Let's tackle {nextSubtopic} next.",
    "Solid grasp of {currentSubtopic}. Time for {nextSubtopic}.",
    "{currentSubtopic} - check. Now for {nextSubtopic}."
  ],
  
  // When user struggled but now understands
  encouraging: [
    "There we go - {currentSubtopic} clicked for you. Let's try {nextSubtopic} now.",
    "Good, {currentSubtopic} makes sense now. Moving on to {nextSubtopic}.",
    "Right, you've got {currentSubtopic} sorted. Next up: {nextSubtopic}.",
    "{currentSubtopic} is clear now. Let's see {nextSubtopic}.",
    "Okay, {currentSubtopic} makes sense. Time for {nextSubtopic}."
  ],
  
  // Final subtopic completion
  celebration: [
    "Nice work - you've covered all the key aspects of {topic}. How do you feel about it overall?",
    "Good job working through {topic}. You've hit all the important points.",
    "Solid work on {topic}. You've covered the essentials.",
    "Well done with {topic}. You've tackled all the main areas.",
    "Good - you've worked through {topic} comprehensively."
  ]
};

function randomSelect<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function assessUserPerformance(subtopic: Subtopic): 'excellent' | 'good' | 'struggled' {
  // If student needed explanations, they struggled
  if (subtopic.needsExplanation) {
    return 'struggled';
  }
  
  // Check if they answered most questions correctly and efficiently
  const successRate = subtopic.questionsAsked > 0 ? subtopic.correctAnswers / subtopic.questionsAsked : 0;
  
  if (successRate >= 0.8 && subtopic.questionsAsked <= 3) {
    return 'excellent';
  } else if (successRate >= 0.6) {
    return 'good';
  } else {
    return 'struggled';
  }
}

export function generateTransition(context: TransitionContext): string {
  if (context.isLastSubtopic) {
    return randomSelect(transitionTemplates.celebration)
      .replace('{topic}', context.topic);
  }
  
  const templateType = context.userStruggled ? 'encouraging' : 'positive';
  return randomSelect(transitionTemplates[templateType])
    .replace('{currentSubtopic}', context.currentSubtopic)
    .replace('{nextSubtopic}', context.nextSubtopic || '');
}

export function generateCelebration(topic: string): string {
  const celebrations = [
    `Good work - you've got a solid handle on ${topic} now.`,
    `Nice job working through ${topic}. You've covered all the important points.`,
    `Well done with ${topic}. You understand the important concepts.`,
    `Solid work on ${topic}. You've tackled all the main points.`
  ];
  
  return randomSelect(celebrations);
}

export { assessUserPerformance }; 