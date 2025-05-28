import { CarsonSessionContext } from './carsonTypes';

// Assessment types
export type AnswerQuality = 'excellent' | 'good' | 'partial' | 'incorrect' | 'confused';
export type NextAction = 'continue_parent' | 'ask_child' | 'give_cue' | 'explain' | 'check_understanding' | 'complete_subtopic';

export interface AssessmentResult {
  answerQuality: AnswerQuality;
  nextAction: NextAction;
  reasoning: string;
}

/**
 * Assess the quality of a user's response
 */
export function assessUserResponse(
  userResponse: string, 
  context: CarsonSessionContext
): AssessmentResult {
  // For now, we'll use keyword-based assessment
  // In production, this could be enhanced with LLM-based evaluation
  
  const userResponseLower = userResponse.toLowerCase().trim();
  
  // Simple heuristics for assessment (can be enhanced)
  const answerQuality = evaluateAnswerQuality(userResponseLower);
  const nextAction = determineNextAction(answerQuality, context);
  
  return {
    answerQuality,
    nextAction,
    reasoning: generateReasoningForAssessment(answerQuality, nextAction, context)
  };
}

function evaluateAnswerQuality(
  userResponse: string
): AnswerQuality {
  // Simple keyword-based assessment
  // In production, this would use more sophisticated NLP or LLM evaluation
  
  if (userResponse.length < 5) {
    return 'confused';
  }
  
  // Look for medical terminology and detailed explanations
  const medicalKeywords = ['pathophysiology', 'mechanism', 'treatment', 'diagnosis', 'symptoms', 'causes'];
  const hasKeywords = medicalKeywords.some(keyword => userResponse.includes(keyword));
  
  if (userResponse.length > 100 && hasKeywords) {
    return 'excellent';
  } else if (userResponse.length > 50 && hasKeywords) {
    return 'good';
  } else if (userResponse.length > 20) {
    return 'partial';
  } else {
    return 'incorrect';
  }
}

function determineNextAction(answerQuality: AnswerQuality, context: CarsonSessionContext): NextAction {
  const { currentQuestionType, questionsAskedInCurrentSubtopic, currentSubtopicState } = context;
  
  switch (currentSubtopicState) {
    case 'assessing':
      if (currentQuestionType === 'parent') {
        switch (answerQuality) {
          case 'excellent':
          case 'good':
            // Good answer to parent question
            if (questionsAskedInCurrentSubtopic < 2) {
              return 'continue_parent'; // Move to next parent question
            } else {
              return 'ask_child'; // Ask child questions to test depth
            }
          case 'partial':
            return 'give_cue'; // Give a hint
          case 'incorrect':
          case 'confused':
            return 'explain'; // Provide explanation
        }
      } else if (currentQuestionType === 'child') {
        switch (answerQuality) {
          case 'excellent':
          case 'good':
            return questionsAskedInCurrentSubtopic >= 3 ? 'complete_subtopic' : 'continue_parent';
          case 'partial':
            return 'give_cue';
          case 'incorrect':
          case 'confused':
            return 'explain';
        }
      }
      break;
      
    case 'explaining':
      // After explanation, always check understanding
      return 'check_understanding';
      
    case 'checking':
      switch (answerQuality) {
        case 'excellent':
        case 'good':
          return questionsAskedInCurrentSubtopic >= 2 ? 'complete_subtopic' : 'continue_parent';
        case 'partial':
          return 'give_cue';
        case 'incorrect':
        case 'confused':
          return 'explain'; // Re-explain if still confused
      }
      break;
  }
  
  return 'continue_parent'; // Default fallback
}

function generateReasoningForAssessment(
  answerQuality: AnswerQuality, 
  nextAction: NextAction, 
  context: CarsonSessionContext
): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  
  return `Assessment: ${answerQuality} answer to ${context.currentQuestionType} question about ${currentSubtopic?.title}. Next action: ${nextAction}. Questions asked: ${context.questionsAskedInCurrentSubtopic}`;
}

export function updateSessionAfterAssessment(
  context: CarsonSessionContext,
  assessment: AssessmentResult
): Partial<CarsonSessionContext> {
  const updates: Partial<CarsonSessionContext> = {
    questionsAskedInCurrentSubtopic: context.questionsAskedInCurrentSubtopic + 1
  };
  
  // Update subtopic state and question type based on next action
  switch (assessment.nextAction) {
    case 'continue_parent':
      updates.currentQuestionType = 'parent';
      updates.currentSubtopicState = 'assessing';
      break;
      
    case 'ask_child':
      updates.currentQuestionType = 'child';
      updates.currentSubtopicState = 'assessing';
      break;
      
    case 'give_cue':
      // Stay in current question type but provide guidance
      updates.currentSubtopicState = 'assessing';
      break;
      
    case 'explain':
      updates.currentSubtopicState = 'explaining';
      break;
      
    case 'check_understanding':
      updates.currentQuestionType = 'checkin';
      updates.currentSubtopicState = 'checking';
      break;
      
    case 'complete_subtopic':
      updates.currentSubtopicState = 'complete';
      updates.shouldTransition = true;
      break;
  }
  
  // Update subtopic-level tracking
  const shouldMarkNeedsExplanation = ['incorrect', 'confused'].includes(assessment.answerQuality);
  if (shouldMarkNeedsExplanation) {
    const currentSubtopicIndex = context.currentSubtopicIndex;
    const updatedSubtopics = [...context.subtopics];
    if (updatedSubtopics[currentSubtopicIndex]) {
      updatedSubtopics[currentSubtopicIndex] = {
        ...updatedSubtopics[currentSubtopicIndex],
        needsExplanation: true,
        questionsAsked: updatedSubtopics[currentSubtopicIndex].questionsAsked + 1
      };
      updates.subtopics = updatedSubtopics;
    }
  }
  
  return updates;
} 