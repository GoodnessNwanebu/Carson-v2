// promptEngine.ts

import { CarsonSessionContext } from './carsonTypes';
import { generateTransition, assessUserPerformance } from './transitionEngine';
import { shouldTestRetention, generateRetentionQuestion, generateMetacognitiveQuestion, generateSelfAssessmentPrompt } from './assessmentEngine';

interface PromptContext extends CarsonSessionContext {
  lastAssessment?: {
    answerQuality: string;
    nextAction: string;
    reasoning: string;
    isStruggling?: boolean;
    specificGaps?: string;
  };
}

interface CurrentSubtopic {
  title: string;
  needsExplanation?: boolean;
}

export function generatePrompt(context: PromptContext): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];

  if (!currentSubtopic) {
    // No subtopics yet, so prompt the LLM to generate them with natural response
    return `
You're Carson, an attending physician who loves teaching. A medical student just asked about: "${context.topic}"

Respond like you're having coffee with a junior colleague who asked about this topic. Be genuinely enthusiastic but conversational.

CRITICAL: Always start with fundamentals, even for confident students. The basics are what separate good from great clinicians.

Your approach:
- React naturally to their topic choice (show genuine interest)  
- Start with ONE fundamental question that every student must know
- Make it conversational, not robotic
- Don't use phrases like "systematically" or "key areas" or "learning journey"
- Sound like a doctor having a conversation, not an AI tutor
- Avoid templated openings or canned phrases

Generate subtopics that follow this hierarchy:
1. Core definition/pathophysiology (ALWAYS first)
2. Basic categories/classification (ALWAYS second) 
3. Essential diagnostics (ALWAYS third)
4. Then more advanced topics based on complexity

Ask ONE question about the most fundamental concept. Even good students need to prove they understand the basics.

Be authentic and varied in your responses - no two topics should sound the same.

Return your response as a JSON object with this structure:
{
  "cleanTopic": "standardized topic name",
  "introduction": "your conversational response with ONE fundamental question",
  "subtopics": [
    {"id": 1, "title": "Core Definition & Pathophysiology", "description": "..."},
    {"id": 2, "title": "Basic Classification", "description": "..."},
    {"id": 3, "title": "Essential Diagnostics", "description": "..."},
    // Additional subtopics...
  ]
}
`.trim();
  }

  // **NEW**: Check if we should test retention of previous learning
  const retentionTest = shouldTestRetention(context);
  if (retentionTest) {
    const retentionQuestion = generateRetentionQuestion(retentionTest, context);
    return `
You are Carson, a supportive medical tutor who ensures lasting mastery.

**RETENTION TEST**: Before moving forward, we need to ensure previous learning has stuck.

Use this retention question: "${retentionQuestion}"

Ask naturally and warmly - this isn't a "gotcha" moment, it's about making sure knowledge connects and persists.

Be encouraging and explain that connecting previous learning helps solidify understanding.
`.trim();
  }

  // Check if we should transition to next subtopic
  if (context.shouldTransition) {
    const nextSubtopic = context.subtopics[context.currentSubtopicIndex + 1];
    const isLastSubtopic = context.currentSubtopicIndex === context.subtopics.length - 1;
    
    if (isLastSubtopic) {
      // **ENHANCED**: Final mastery validation before completion
      return `
You're Carson, checking if the student really understands ${context.topic}.

They've been through all the subtopics. Before wrapping up, see if they can:
1. Synthesize: "How would you explain ${context.topic} to a medical student in 2-3 minutes?"
2. Apply: "Walk me through your approach to a complex ${context.topic} case"
3. Self-reflect: "What aspect of ${context.topic} do you feel most confident about? Least confident?"

Only after they show they can synthesize and apply should you acknowledge they've got it.

Keep it natural - you're a doctor checking if a student really knows their stuff.
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
You're Carson, moving to the next topic.

Use this transition: "${transitionMessage}"

Before diving into ${nextSubtopic.title}, check their understanding:
"${generateSelfAssessmentPrompt(currentSubtopic.title)}"

Then ask your first question about ${nextSubtopic.title} related to ${context.topic}.

Ask about the ${nextSubtopic.title} OF ${context.topic} specifically, not generic definitions. Use real clinical scenarios when possible.
`.trim();
    }
  }

  // Use the global session history for context
  const history = context.history
    .map((msg) => `${msg.role === "user" ? "Student" : "Carson"}: ${msg.content}`)
    .join("\n");

  // Generate context-aware prompt based on current state and assessment
  const stateContext = generateStateContext(context, currentSubtopic);
  const instruction = generateInstructionBasedOnAssessment(context, currentSubtopic);

  // Get the last student answer for contextual awareness
  const lastStudentAnswer = context.history
    .filter(msg => msg.role === "user")
    .slice(-1)[0]?.content || "";

  // Get Carson's last question for context
  const lastCarsonQuestion = context.history
    .filter(msg => msg.role === "assistant")
    .slice(-1)[0]?.content || "";

  // **NEW**: Add metacognitive guidance for struggling students
  const strugglingGuidance = context.lastAssessment?.isStruggling ? 
    `\nMETACOGNITIVE SUPPORT: Consider asking: "${generateMetacognitiveQuestion(context, context.lastAssessment.answerQuality as any)}"` : '';

  // **NEW**: Handle different interaction types appropriately
  const interactionType = (context.lastAssessment as any)?.interactionType;
  if (interactionType && interactionType !== 'medical_response') {
    return `
You are Carson, a warm and supportive medical tutor who understands that learning involves human emotions and needs.

**INTERACTION TYPE**: ${interactionType}

Student response: "${lastStudentAnswer}"

**RESPONSE STRATEGY**: 
${context.lastAssessment?.reasoning}

After addressing their ${interactionType === 'emotional_support' ? 'emotional needs' : 
                        interactionType === 'personal_casual' ? 'personal question' :
                        interactionType === 'medical_advice' ? 'boundary request' :
                        interactionType === 'challenge_authority' ? 'challenge constructively' :
                        interactionType === 'meta_learning' ? 'learning strategy question' :
                        interactionType === 'give_up' ? 'motivational needs' :
                        interactionType === 'technical_issue' ? 'technical concern' :
                        'off-topic question'}, 
gently guide them back to our learning objectives for ${context.topic}.

Be authentic, warm, and consultant-like. Show you understand their human needs while maintaining focus on their medical education journey.

Current learning context: ${currentSubtopic.title} of ${context.topic}
`.trim();
  }

  return `
You're Carson, responding naturally to this medical student. Don't use templates or AI-speak.

Context:
- Topic: ${context.topic}
- Current subtopic: ${currentSubtopic.title}
- Student's last answer: "${lastStudentAnswer}"
- Carson's last question: "${lastCarsonQuestion}"
- Assessment: ${context.lastAssessment?.answerQuality || 'N/A'}
${context.lastAssessment?.specificGaps ? `- Missing pieces: ${context.lastAssessment.specificGaps}` : ''}
${context.lastAssessment?.isStruggling ? '- Student seems confused/struggling' : ''}

What to do:
${instruction}

Recent conversation:
${history.slice(-400)}

Respond like a real doctor having a conversation. Ask ONE question max. If they don't know something, just explain it clearly.
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
  
  return baseContext;
}

function generateInstructionBasedOnAssessment(context: PromptContext, currentSubtopic: CurrentSubtopic): string {
  const { currentSubtopicState, currentQuestionType, questionsAskedInCurrentSubtopic, lastAssessment } = context;
  
  // Check if student was struggling in last assessment
  const isStudentStruggling = lastAssessment?.isStruggling || lastAssessment?.answerQuality === 'confused';
  
  // ALWAYS prioritize fundamentals - even confident students must prove basic understanding
  const isBasicTopic = currentSubtopic.title.toLowerCase().includes('definition') || 
                       currentSubtopic.title.toLowerCase().includes('pathophysiology') ||
                       currentSubtopic.title.toLowerCase().includes('classification') ||
                       currentSubtopic.title.toLowerCase().includes('diagnostic');
  
  // If we have assessment results, use them to guide the instruction
  if (lastAssessment) {
    switch (lastAssessment.nextAction) {
      case 'continue_parent':
        if (isStudentStruggling) {
          return `They're confused about ${currentSubtopic.title}. Be gentle and supportive. Break it down to the basics.`;
        } else if (isBasicTopic) {
          return `They understand ${currentSubtopic.title} but make sure they can explain it clearly. Even good students need to nail the fundamentals.`;
        } else {
          return `They're getting ${currentSubtopic.title}. You can ask something a bit more challenging, but don't skip essential pieces.`;
        }
        
      case 'explain_and_continue':
        if (isBasicTopic) {
          return `They missed something fundamental about ${currentSubtopic.title}. Explain the basics clearly, then check with a simpler question.`;
        } else {
          return `They need help with ${currentSubtopic.title}. Explain what they missed, then ask a follow-up to reinforce it.`;
        }
        
      case 'explain_thoroughly':
        return `They really don't understand ${currentSubtopic.title}. Give a clear explanation focusing on the essentials. Don't overwhelm them.`;
        
      case 'move_to_next':
        if (isBasicTopic) {
          return `They've got the basics of ${currentSubtopic.title}. You can move to the next fundamental topic, but make sure all basics are covered first.`;
        } else {
          return `They've got ${currentSubtopic.title} down. Time to move forward, but remember - fundamentals before advanced stuff.`;
        }
        
      default:
        if (isBasicTopic) {
          return `Continue with fundamental questions about ${currentSubtopic.title}. Even good students must prove they understand the basics.`;
        } else {
          return `Ask about ${currentSubtopic.title}, but make sure all fundamental concepts have been covered first.`;
        }
    }
  }
  
  // Default instruction emphasizing fundamentals
  if (isBasicTopic) {
    return `Focus on fundamental understanding of ${currentSubtopic.title}. This is critical knowledge that every student must know.`;
  } else {
    return `Ask about ${currentSubtopic.title}, but make sure you've covered all the basics first. Advanced topics build on fundamentals.`;
  }
} 