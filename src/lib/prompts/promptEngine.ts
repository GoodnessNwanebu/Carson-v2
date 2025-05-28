// promptEngine.ts

import { CarsonSessionContext } from './carsonTypes';
import { generateTransition, assessUserPerformance } from './transitionEngine';

interface PromptContext extends CarsonSessionContext {
  lastAssessment?: {
    answerQuality: string;
    nextAction: string;
    reasoning: string;
  };
}

interface CurrentSubtopic {
  title: string;
  needsExplanation?: boolean;
}

export function generatePrompt(context: PromptContext): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];

  if (!currentSubtopic) {
    // No subtopics yet, so prompt the LLM to generate them with intent-aware response
    return `
You are Carson, a calm and intelligent medical tutor.
The student's message: "${context.topic}"

First, analyze the student's intent:

INTENT 1 - DIRECT QUESTION: If they're asking "What is X?" or "What are X?" or similar direct questions
- Provide a clear, concise explanation (2-3 sentences)
- Then offer to guide them through deeper learning
- Example: "AKI stands for Acute Kidney Injury - it's when your kidneys suddenly stop working properly, usually within hours or days. This can be really serious because your kidneys filter waste from your blood. Would you like me to guide you through understanding AKI more deeply? I can break it down into key areas and help you master each one."

INTENT 2 - LEARNING GOAL: If they say "I want to understand X" or "Help me with X" or express a learning goal
- Use the conversational approach: acknowledge they're in the right place, mention why the topic is important, explain your teaching method, ask if they're ready
- Example: "Hey, you're in the right place! AKI is really important for understanding kidney function and critical care medicine. I'll ask you some leading questions to see what you know and guide you toward full understanding. Ready to dive in?"

INTENT 3 - SPECIFIC QUESTION: If they ask about a specific aspect like "What causes X?" or "How do you diagnose X?"
- Answer their specific question clearly
- Then offer broader exploration
- Example: "The main causes of AKI include... Would you like to explore AKI more comprehensively? I can guide you through all the key areas you need to know."

After your intent-appropriate response, break down this topic into 4-6 key subtopics for a medical student to master.

Return your response as a JSON object with:
- "introduction": Your intent-appropriate response
- "subtopics": Array where each subtopic has "id", "title", and "description"

Make it warm, encouraging, and specific to their topic and intent.
`.trim();
  }

  // Check if we should transition to next subtopic
  if (context.shouldTransition) {
    const nextSubtopic = context.subtopics[context.currentSubtopicIndex + 1];
    const isLastSubtopic = context.currentSubtopicIndex === context.subtopics.length - 1;
    
    if (isLastSubtopic) {
      // Session complete - celebration time!
      return `
You are Carson, a calm and intelligent medical tutor.

The student has successfully completed all subtopics for ${context.topic}. 
Generate a celebration message acknowledging their achievement and ask if they'd like to:
1. Review any specific subtopic
2. Try clinical vignettes related to ${context.topic}
3. Start a new topic

Use an encouraging, proud tone that makes the student feel accomplished.
`.trim();
    } else {
      // Transition to next subtopic
      const transitionMessage = generateTransition({
        currentSubtopic: currentSubtopic.title,
        nextSubtopic: nextSubtopic?.title,
        topic: context.topic,
        userStruggled: currentSubtopic.needsExplanation,
        isLastSubtopic: false,
        userPerformance: assessUserPerformance(currentSubtopic)
      });
      
      return `
You are Carson, a calm and intelligent medical tutor.

Use this exact transition message: "${transitionMessage}"

Then begin asking the first question about: ${nextSubtopic.title}

The question should be fundamental and accessible - start with basic understanding before moving to complex concepts.
`.trim();
    }
  }

  // Use the global session history for context
  const history = context.history
    .map((msg) => `${msg.role === "user" ? "Student" : "Carson"}: ${msg.content}`)
    .join("\n");

  // Get the last Carson message to understand what was asked
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === "assistant")
    .slice(-1)[0]?.content || "";

  // Generate context-aware prompt based on current state and assessment
  const stateContext = generateStateContext(context, currentSubtopic);
  const instruction = generateInstructionBasedOnAssessment(context, currentSubtopic);

  return `
You are Carson, a calm and intelligent medical tutor.
The topic is: ${context.topic}
The current subtopic is: ${currentSubtopic.title}

${stateContext}

Your last message to the student was: "${lastCarsonMessage}"

IMPORTANT: Before responding, determine if the student is:
1. ANSWERING your question - Assess their response and continue the learning flow
2. ASKING A NEW QUESTION about the current topic - Answer it and integrate into the learning journey
3. ASKING ABOUT A DIFFERENT TOPIC - Briefly acknowledge, then guide back or offer to switch topics
4. ASKING FOR CLARIFICATION - Explain the term/concept and continue current flow
5. EXPRESSING CONFUSION/NEED HELP - Provide support and adjust your approach

Conversation history so far:
${history}

${instruction}

Remember: Be flexible and responsive to the student's actual needs, not just your planned questions.
`.trim();
}

function generateStateContext(context: PromptContext, currentSubtopic: CurrentSubtopic): string {
  const { currentSubtopicState, questionsAskedInCurrentSubtopic, correctAnswersInCurrentSubtopic, lastAssessment } = context;
  
  let baseContext = '';
  
  switch (currentSubtopicState) {
    case 'assessing':
      baseContext = `You are currently assessing the student's understanding of ${currentSubtopic.title}. 
Questions asked so far: ${questionsAskedInCurrentSubtopic}
Correct answers: ${correctAnswersInCurrentSubtopic}`;
      break;
      
    case 'explaining':
      baseContext = `The student is struggling with ${currentSubtopic.title}. You are providing explanations and guidance.`;
      break;
      
    case 'checking':
      baseContext = `You have explained ${currentSubtopic.title}. Now you're checking if the student understands through follow-up questions.`;
      break;
      
    default:
      baseContext = `You are working on ${currentSubtopic.title} with the student.`;
  }
  
  if (lastAssessment) {
    baseContext += `\n\nLast assessment: ${lastAssessment.reasoning}`;
  }
  
  return baseContext;
}

function generateInstructionBasedOnAssessment(context: PromptContext, currentSubtopic: CurrentSubtopic): string {
  const { currentSubtopicState, currentQuestionType, questionsAskedInCurrentSubtopic, lastAssessment } = context;
  
  // If we have assessment results, use them to guide the instruction
  if (lastAssessment) {
    switch (lastAssessment.nextAction) {
      case 'continue_parent':
        const questionLevel = questionsAskedInCurrentSubtopic === 0 ? 'fundamental' : 
                             questionsAskedInCurrentSubtopic === 1 ? 'intermediate' : 'advanced';
        return `Ask the next ${questionLevel} parent question about ${currentSubtopic.title}. 
${questionLevel === 'fundamental' ? 'Start with basic concepts to build confidence.' : 
  questionLevel === 'intermediate' ? 'Test deeper understanding and application.' : 
  'Challenge with clinical scenarios or complex reasoning.'}

Acknowledge their previous answer positively before asking the new question.`;

      case 'ask_child':
        return `Great! The student showed good understanding of the parent question. 
Now ask a child question that tests deeper understanding or explores a related concept within ${currentSubtopic.title}.
This should build on their correct answer and challenge them to think more deeply.

Acknowledge their good work first, then ask the follow-up question.`;

      case 'give_cue':
        return `The student's answer was partially correct but needs guidance. 
Provide a helpful cue or hint to guide them toward the complete answer. 
You can:
- Ask a leading question that points them in the right direction
- Give a gentle hint about what they're missing
- Rephrase the question in a different way
- Provide a relevant analogy or example

Be encouraging and supportive. Don't give the full answer yet.`;

      case 'explain':
        return `The student is struggling with this concept. Provide a clear, layered explanation of ${currentSubtopic.title}.
Start with the basics and build up complexity gradually.
Use analogies, clinical correlations, and examples where helpful.
Be encouraging and reassuring - this is a safe space to learn.

After your explanation, ask if it makes sense and if they have any questions.`;

      case 'check_understanding':
        return `You've just provided an explanation. Now ask a check-in question to verify the student understood your explanation.
The question should test the same concept but be framed positively to give them confidence.
Make it clear this is to help solidify their understanding, not to test them again.`;

      case 'complete_subtopic':
        return `The student has demonstrated solid understanding of ${currentSubtopic.title}. 
Acknowledge their success and prepare to move to the next subtopic.
This should trigger the transition logic.`;
    }
  }
  
  // Fallback to original logic if no assessment available
  switch (currentSubtopicState) {
    case 'assessing':
      if (currentQuestionType === 'parent') {
        const questionLevel = questionsAskedInCurrentSubtopic === 0 ? 'fundamental' : 
                             questionsAskedInCurrentSubtopic === 1 ? 'intermediate' : 'advanced';
        return `Ask a ${questionLevel} question about ${currentSubtopic.title}. 
${questionLevel === 'fundamental' ? 'Start with basic concepts to build confidence.' : 
  questionLevel === 'intermediate' ? 'Test deeper understanding and application.' : 
  'Challenge with clinical scenarios or complex reasoning.'}`;
      } else {
        return `Ask a follow-up question to test deeper understanding of the concept just discussed.`;
      }
      
    case 'explaining':
      return `Provide a clear, layered explanation of the concept the student is struggling with. 
Use analogies and clinical correlations where helpful. Be encouraging and supportive.`;
      
    case 'checking':
      return `Ask a check-in question to verify the student understood your explanation. 
Frame it positively and give them confidence to try again.`;
      
    default:
      return `Continue the conversation naturally, adapting to the student's needs.`;
  }
} 