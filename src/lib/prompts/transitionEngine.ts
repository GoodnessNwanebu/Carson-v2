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
    "Excellent! You've got a solid grasp of {currentSubtopic}. Let's now explore {nextSubtopic}. Are you ready?",
    "Great work on {currentSubtopic}! I can see you understand it well. Now let's dive into {nextSubtopic}. Shall we?",
    "You've mastered {currentSubtopic} beautifully! Time to move on to {nextSubtopic}. Ready for the next challenge?",
    "Perfect understanding of {currentSubtopic}! Let's build on that knowledge with {nextSubtopic}. Are you up for it?",
    "Outstanding work on {currentSubtopic}! You clearly have a strong foundation. Let's explore {nextSubtopic} next. Ready?"
  ],
  
  // When user struggled but now understands
  encouraging: [
    "That's much better! You've worked through {currentSubtopic} really well. Let's now tackle {nextSubtopic}. Ready?",
    "Great progress on {currentSubtopic}! You stuck with it and got there. Now let's explore {nextSubtopic}. Shall we continue?",
    "Well done pushing through {currentSubtopic}! Your persistence paid off. Time for {nextSubtopic}. Are you ready?",
    "Nice work on {currentSubtopic}! I can see the concepts are clicking now. Let's move on to {nextSubtopic}. Shall we?",
    "Excellent perseverance with {currentSubtopic}! You've really grasped it now. Ready to tackle {nextSubtopic}?"
  ],
  
  // Final subtopic completion
  celebration: [
    "Outstanding! You've mastered all the key concepts of {topic}! How are you feeling about your understanding now?",
    "Fantastic work! You've successfully worked through every aspect of {topic}. You should be proud of your progress!",
    "Excellent! You've demonstrated solid understanding across all areas of {topic}. Well done!",
    "Incredible job! You've conquered every subtopic of {topic}. Your dedication really shows!",
    "Brilliant work! You've achieved a comprehensive understanding of {topic}. That's something to celebrate!"
  ]
};

function randomSelect<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function assessUserPerformance(subtopic: Subtopic): 'excellent' | 'good' | 'struggled' {
  if (subtopic.needsExplanation) {
    return 'struggled';
  }
  if (subtopic.correctAnswers >= 3 && subtopic.questionsAsked <= 3) {
    return 'excellent';
  }
  return 'good';
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
    `🎉 Congratulations! You've successfully mastered ${topic}! Your understanding across all the key areas is impressive.`,
    `🌟 Fantastic achievement! You've worked through every aspect of ${topic} with dedication and skill.`,
    `🎯 Excellent work! You've demonstrated comprehensive understanding of ${topic}. Well done!`,
    `🚀 Outstanding! You've conquered ${topic} and should feel proud of your progress and persistence.`
  ];
  
  return randomSelect(celebrations);
}

export { assessUserPerformance }; 