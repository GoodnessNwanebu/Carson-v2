// promptEngine.ts

import { CarsonSessionContext } from './carsonTypes';
import { generateTransition, assessUserPerformance } from './transitionEngine';
import { shouldTestRetention, generateRetentionQuestion, generateMetacognitiveQuestion, generateSelfAssessmentPrompt } from './assessmentEngine';
import { detectConversationalIntent, generateConversationalResponse } from './conversational-intelligence';

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

interface GapAnalysis {
  hasSignificantGaps: boolean;
  gaps: string[];
  primaryGap: string;
  confidenceScore: number;
  remediationAttempts?: number;
  shouldAbandonRemediation?: boolean;
  gapAttempts?: { [gap: string]: number };
  currentGapIndex?: number;
  totalAttempts?: number;
  maxAttemptsPerGap?: number;
  maxTotalAttempts?: number;
}

interface ResponseContext {
  type: 'clarification_question' | 'struggle_indicator' | 'wrong_answer' | 'confidence_expression' | 'regular_response' | 'follow_up_question' | 'post_explanation_confirmation';
  confidence: number; // 0-100
  reasoning: string;
  requiresDirectAnswer: boolean;
  shouldTriggerGapAnalysis: boolean;
  suggestedAction: 'answer_directly' | 'offer_help' | 'assess_gaps' | 'continue_conversation' | 'transition' | 'check_broader_understanding' | 'conclude_gracefully';
}

export function generatePrompt(context: PromptContext): string {
  // **CRITICAL FIX**: Add comprehensive validation and defaults
  if (!context) {
    throw new Error("No context provided to generatePrompt");
  }

  // Validate and provide defaults for all critical fields
  const safeContext = {
    sessionId: context.sessionId || 'unknown',
    topic: context.topic || 'undefined',
    subtopics: context.subtopics || [],
    currentSubtopicIndex: context.currentSubtopicIndex ?? 0,
    history: context.history || [],
    currentSubtopicState: context.currentSubtopicState || 'assessing',
    currentQuestionType: context.currentQuestionType || 'parent',
    questionsAskedInCurrentSubtopic: context.questionsAskedInCurrentSubtopic ?? 0,
    correctAnswersInCurrentSubtopic: context.correctAnswersInCurrentSubtopic ?? 0,
    shouldTransition: context.shouldTransition || false,
    isComplete: context.isComplete || false,
    lastAssessment: context.lastAssessment
  };

  // Safety check for valid subtopic index
  const subtopicIndex = Math.max(0, Math.min(safeContext.currentSubtopicIndex, safeContext.subtopics.length - 1));
  const currentSubtopic = safeContext.subtopics[subtopicIndex];

  // Handle case where topic is literally "undefined" (frontend bug)
  if (safeContext.topic === 'undefined' || !safeContext.topic.trim()) {
    return `
You're Carson, a medical educator. There seems to be a technical issue - no specific topic was provided.

Please respond warmly: "It looks like there might be a technical hiccup. What medical topic would you like to explore? I'm here to help you understand anything from basic concepts to complex clinical scenarios."

Be encouraging and ready to start fresh once they provide a real topic.
`.trim();
  }

  if (!currentSubtopic) {
    // No subtopics yet, so prompt the LLM to generate them with natural response
    return `
You're Carson, an attending physician who loves teaching. A medical student just asked about: "${safeContext.topic}"

Respond like you're having coffee with a junior colleague who asked about this topic. Be genuinely enthusiastic but conversational.

CRITICAL: Always start with fundamentals, even for confident students. The basics are what separate good from great clinicians.

Your approach:
- React naturally to their topic choice (show genuine interest)  
- Start with ONE fundamental question that every student must know
- Make it conversational, not robotic
- Don't use phrases like "systematically" or "key areas" or "learning journey"
- Sound like a doctor having a conversation, not an AI tutor
- Avoid templated openings or canned phrases

Generate subtopics that follow natural medical logic for "${safeContext.topic}":

Think like an attending: What does a student actually need to understand about this topic?
- **Diseases/Conditions**: Start with what it is, then how to recognize it, then what to do about it
- **Procedures/Skills**: Start with when/why, then how, then what can go wrong
- **Symptoms/Presentations**: Start with differential thinking, then systematic workup
- **Basic Science**: Start with core mechanisms, then clinical applications
- **Pharmacology**: Start with how it works, then when to use it, then monitoring

Let the topic guide the structure - be adaptive, not templated.

Ask ONE question that gets to the heart of what every student must understand about this topic first.

Be authentic and varied in your responses - no two topics should sound the same.

Return your response as a JSON object with this structure:
{
  "cleanTopic": "standardized topic name",
  "introduction": "your conversational response with ONE fundamental question",
  "subtopics": [
    {"id": 1, "title": "First logical learning area", "description": "..."},
    {"id": 2, "title": "Second logical learning area", "description": "..."},
    {"id": 3, "title": "Third logical learning area", "description": "..."},
    // Additional subtopics that make sense for this specific topic...
  ]
}
`.trim();
  }

  // **NEW**: Handle completion choice state
  if (safeContext.currentSubtopicState === 'completion_choice') {
    const lastUserMessage = safeContext.history[safeContext.history.length - 1]?.content || '';
    
    // Check if student wants to generate notes
    if (containsNotesRequest(lastUserMessage)) {
      return `
You're Carson, and the student just asked you to generate study notes for their session on ${safeContext.topic}.

**STUDENT REQUEST**: "${lastUserMessage}"

Your response:
1. "Absolutely! Let me create some personalized notes for you."
2. "I'll capture the key points we covered and areas where you really excelled."
3. "This will take just a moment..."
4. **IMPORTANT CLOSING**: After confirming the notes, end with: "Happy to make that note for you. You've done really well today, until next time."

**IMPORTANT**: This triggers note generation. After this response, the system will automatically generate and save notes to their journal.

Be encouraging and let them know the notes will appear in their journal tab, then give the warm closing message.
`.trim();
    }
    
    // Check if student wants to study another topic
    if (containsNewTopicRequest(lastUserMessage)) {
      return `
You're Carson, and the student wants to study another topic.

**STUDENT REQUEST**: "${lastUserMessage}"

Your response:
1. "Great idea! I love seeing students eager to keep learning."
2. "To start a fresh conversation about a new topic, just click the 'New conversation' button in the sidebar."
3. "That'll give us a clean slate to dive deep into whatever interests you next."
4. "Thanks for such a great discussion about ${safeContext.topic} - you did excellent work today!"

Guide them to start fresh with the new conversation button.
`.trim();
    }
    
    // Student completed session - offer the choice
    return `
You're Carson, and the student just completed all subtopics for ${safeContext.topic}. 

**CONTEXT**: All subtopics are mastered. Time to offer completion options.

Your response:
1. "Fantastic work today! You've really mastered ${safeContext.topic}."
2. "I'm impressed with how you worked through [mention 1-2 specific concepts they handled well]."
3. "Now, would you like me to create some study notes for your journal that capture what we covered today? Or are you ready to dive into a new topic?"

Be warm, encouraging, and give them clear options: notes OR new topic.
`.trim();
  }

  // **NEW CRITICAL FEATURE**: Response Context Analysis
  const responseContext = analyzeResponseContext(safeContext);
  
  console.log(`🔍 [ResponseContext] Type: ${responseContext.type}, Action: ${responseContext.suggestedAction}, Reasoning: ${responseContext.reasoning}`);

  // **NEW**: Conversational Intelligence - Detect if student is asking a question
  if (safeContext.history.length > 0) {
    const lastUserMessage = safeContext.history[safeContext.history.length - 1];
    if (lastUserMessage?.role === 'user') {
      const conversationalIntent = detectConversationalIntent(lastUserMessage.content, safeContext);
      
      console.log(`🤖 [ConversationalAI] Intent: ${conversationalIntent.type}, Confidence: ${conversationalIntent.confidence}`);
      
      // If student is asking a clarifying question, handle it conversationally
      if (conversationalIntent.type !== 'assessment_response' && conversationalIntent.confidence > 0.8) {
        return generateConversationalPrompt(conversationalIntent, lastUserMessage.content, safeContext);
      }
    }
  }

  // **HANDLE DIFFERENT RESPONSE TYPES**
  switch (responseContext.suggestedAction) {
    case 'answer_directly':
      return `
You're Carson, answering a direct question from a medical student.

**STUDENT'S QUESTION TYPE**: ${responseContext.type}
**THEIR QUESTION**: "${safeContext.history[safeContext.history.length - 1]?.content}"

Your approach:
1. **Answer their question directly and clearly**
2. **Don't** launch into a full lecture - they asked for specific information
3. **Don't** ask if they have trouble with "fundamental understanding"
4. Give a concise, accurate answer
5. **End with a simple follow-up**: "What else would you like to know about this?" or similar

Be helpful and direct - they're asking for clarification, not remediation.

**TOPIC CONTEXT**: Currently discussing ${currentSubtopic?.title} within ${safeContext.topic}
`.trim();

    case 'offer_help':
      // **ENHANCED**: Handle immediate context first, then check for broader gaps later
      const lastCarsonQuestion = safeContext.history
        .filter(msg => msg.role === 'assistant')
        .slice(-1)[0]?.content || '';
      
      return `
You're Carson, responding to a student who just said they don't know something.

**IMMEDIATE CONTEXT**: The student couldn't answer your last question/prompt
**LAST CARSON MESSAGE**: "${lastCarsonQuestion}"
**STUDENT RESPONSE**: ${responseContext.reasoning}

Your approach:
1. **Answer the specific question they couldn't handle** - Don't make them guess anymore
2. Give a clear, direct explanation of what you just asked about
3. **End with a check**: "Does that make sense?" or "Was that clearer?"
4. **IMPORTANT**: Don't jump to gap remediation yet - handle the immediate need first

Be helpful and direct - they need the answer to what you just asked, not a broader assessment.

**CURRENT TOPIC**: ${currentSubtopic?.title} in ${safeContext.topic}
`.trim();

    case 'transition':
      // Student expressed confidence/understanding - transition smoothly
      const nextSubtopic = safeContext.subtopics[subtopicIndex + 1];
      const isLastSubtopic = subtopicIndex === (safeContext.subtopics.length - 1);
      
      if (isLastSubtopic) {
        return `
You're Carson, wrapping up the topic since the student seems to understand.

**STUDENT INDICATED**: ${responseContext.reasoning}

Your approach:
1. "Great! It sounds like you've got a solid understanding of ${safeContext.topic}."
2. Ask a synthesis question: "Before we finish, can you walk me through your approach to [relevant clinical scenario]?"
3. If they handle that well, acknowledge their mastery and offer to explore related topics

They've shown understanding - validate that and check for real comprehension.
`.trim();
      } else {
        return `
You're Carson, transitioning to the next topic since the student understands the current one.

**STUDENT INDICATED**: ${responseContext.reasoning}

Your approach:
1. "Perfect! I can see you understand ${currentSubtopic.title}."
2. "Let's move on to ${nextSubtopic?.title}"
3. Start with an engaging question about the new topic
4. Keep it conversational and natural

Smooth transition - they've demonstrated understanding.
`.trim();
      }

    case 'check_broader_understanding':
      // **NEW**: Handle post-explanation confirmation → check if gap remediation needed
      const gapAnalysisForCheck = analyzeKnowledgeGaps(safeContext, currentSubtopic);
      
      if (gapAnalysisForCheck.hasSignificantGaps) {
        return `
You're Carson, checking if the student has broader understanding gaps after you just explained something.

**CONTEXT**: Student just confirmed they understood your explanation, but you sense there might be broader gaps in ${currentSubtopic?.title}

**TOPIC**: ${safeContext.topic}
**CURRENT SUBTOPIC**: ${currentSubtopic?.title}
**SPECIFIC GAP**: ${gapAnalysisForCheck.primaryGap}

Your approach:
1. "Great! I'm glad that made sense."
2. **Gentle broader check**: "Before we move on, let me ask you this..." 
3. Ask ONE targeted question specifically about ${gapAnalysisForCheck.primaryGap} within the context of ${currentSubtopic?.title}
4. This helps confirm if they understand the bigger picture of ${safeContext.topic}

Be encouraging - you're just making sure they really have it down.

**IMPORTANT**: Keep your question focused on ${currentSubtopic?.title} of ${safeContext.topic}, not unrelated medical topics.
`.trim();
      } else {
        return `
You're Carson, continuing the conversation after the student confirmed understanding.

**CONTEXT**: Student understood your explanation about ${currentSubtopic?.title} and there are no major gaps detected.

**TOPIC**: ${safeContext.topic}
**CURRENT SUBTOPIC**: ${currentSubtopic?.title}

Your approach:
1. "Perfect! I can see you've got that concept down."
2. Continue with the natural flow of ${currentSubtopic?.title} within ${safeContext.topic}
3. Ask the next logical question specifically about ${currentSubtopic?.title} (not generic medical topics!)
4. Stay focused on the current subtopic and topic context

Keep it conversational - they're doing well with ${safeContext.topic}.

**IMPORTANT**: Ask about ${currentSubtopic?.title} OF ${safeContext.topic} specifically, not unrelated topics.
`.trim();
      }

    case 'conclude_gracefully':
      return `
You're Carson, wrapping up because the student has shown they understand ${safeContext.topic}.

They just gave you a decent synthesis. Time to acknowledge their work and finish naturally.

**YOUR CONCLUSION SHOULD:**
- Be brief and genuine (1-2 sentences max)
- Acknowledge what they demonstrated well during this conversation
- Use your natural voice - "Good stuff", "Right on", "Solid work", etc.
- Reference ${safeContext.topic} specifically 
- End warmly without asking questions

**CONVERSATION CONTEXT**: Look at what they actually struggled with or excelled at during your discussion. Make it personal to their learning journey.

**IMPORTANT**: This is the END. Don't ask follow-ups, don't suggest more topics. Just close warmly and naturally.
`.trim();

    case 'assess_gaps':
      // Enhanced gap analysis with kind tone
      const gapAnalysis = analyzeKnowledgeGaps(safeContext, currentSubtopic);
      
      if (gapAnalysis.hasSignificantGaps) {
        return `
You're Carson, helping a student who's struggling with some concepts.

**STUDENT SITUATION**: They're having trouble with parts of ${currentSubtopic?.title}

Your approach:
1. **Acknowledge what they got right first** - find something positive in their response
2. **Gently clarify the specific missing piece**: "${gapAnalysis.primaryGap}"
3. Give a clear, simple explanation (no lectures!)
4. **End with encouragement**: "Does this help clarify that part?" or "Make sense now?"

Be supportive - they're learning, not failing.

**CURRENT CONTEXT**: Student discussing ${currentSubtopic?.title} in ${safeContext.topic}
`.trim();
      } else {
        // Minimal gaps - just continue conversation
        return `
You're Carson, continuing the natural conversation flow.

**STUDENT RESPONSE TYPE**: ${responseContext.reasoning}

Your approach:
1. Acknowledge their response positively
2. Build on what they said
3. Ask a natural follow-up question about ${currentSubtopic?.title}

Keep it conversational - they're doing fine.
`.trim();
      }
      break;

    default:
      // Continue with regular conversation flow
      break;
  }

  // **NEW**: Check if we should test retention of previous learning
  const retentionTest = shouldTestRetention(safeContext);
  if (retentionTest) {
    const retentionQuestion = generateRetentionQuestion(retentionTest, safeContext);
    return `
You are Carson, a supportive medical tutor who ensures lasting mastery.

**RETENTION TEST**: Before moving forward, we need to ensure previous learning has stuck.

Use this retention question: "${retentionQuestion}"

Ask naturally and warmly - this isn't a "gotcha" moment, it's about making sure knowledge connects and persists.

Be encouraging and explain that connecting previous learning helps solidify understanding.
`.trim();
  }

  // Handle transition when shouldTransition is true
  if (safeContext.shouldTransition) {
    const subtopicIndex = safeContext.currentSubtopicIndex;
    const nextSubtopic = safeContext.subtopics[subtopicIndex + 1];
    const isLastSubtopic = subtopicIndex === (safeContext.subtopics.length - 1);
    
    if (isLastSubtopic) {
      // **ENHANCED**: Final mastery validation before completion
      return `
You're Carson, checking if the student really understands ${safeContext.topic}.

They've been through all the subtopics. Time to see if they can put it all together.

Ask something natural like: "Alright, you've covered a lot with ${safeContext.topic}. Before we wrap up - how would you explain this stuff to another med student? Like if they asked you about the key things to remember?"

Keep it conversational. You're not giving them a formal exam - you're just checking if they can synthesize what they've learned in their own words.

If they can explain it clearly and hit the main points, acknowledge they've got it and wrap up warmly.
`.trim();
    } else {
      // **CARSON FIX**: Gap-driven transition logic instead of forced metacognition
      const gapAnalysis = analyzeKnowledgeGaps(safeContext, currentSubtopic);
      
      if (gapAnalysis.shouldAbandonRemediation) {
        // Hit remediation limit - acknowledge and transition
        return `
You're Carson, acknowledging that you've tried to explain this concept but it's time to move forward.

REMEDIATION COMPLETE (${gapAnalysis.remediationAttempts} attempts made)

Your approach:
1. "I can see this concept is still challenging for you. That's okay - these things take time to click."
2. "Let's come back to this later. For now, let's move on to [next topic] which might help illuminate this concept."
3. Immediately transition to the next subtopic

No more explanations. Be supportive but decisive about moving forward.
`.trim();
      } else if (gapAnalysis.hasSignificantGaps) {
        // **DELETED OLD REMEDIATION SYSTEM**
        // Let the enhanced response context analysis handle this instead
        return `
You're Carson, responding naturally to this student.

Continue the conversation naturally. If they're struggling with something specific, just explain it clearly and move on.

Don't diagnose gaps or give clinical assessments. Just be helpful and conversational.
`.trim();
      } else {
        // Smooth transition - minimal gaps, good understanding
        const transitionMessage = generateTransition({
          currentSubtopic: currentSubtopic.title,
          nextSubtopic: nextSubtopic?.title,
          topic: safeContext.topic,
          userStruggled: currentSubtopic.needsExplanation,
          isLastSubtopic: false,
          userPerformance: assessUserPerformance(currentSubtopic)
        });
        
        return `
You're Carson, moving to the next topic because the student has solid understanding.

Use this natural transition: "${transitionMessage}"

Then dive straight into your first question about ${nextSubtopic.title} related to ${safeContext.topic}.

NO metacognitive questions - just move forward. Ask about the ${nextSubtopic.title} OF ${safeContext.topic} specifically, not generic definitions. Use real clinical scenarios when possible.
`.trim();
      }
    }
  }

  // Use the global session history for context
  const history = safeContext.history
    .map((msg) => `${msg.role === "user" ? "Student" : "Carson"}: ${msg.content}`)
    .join("\n");

  // Generate context-aware prompt based on current state and assessment
  const stateContext = generateStateContext(safeContext, currentSubtopic);
  const instruction = generateInstructionBasedOnAssessment(safeContext, currentSubtopic);

  // Get the last student answer for contextual awareness
  const lastStudentAnswer = safeContext.history
    .filter(msg => msg.role === "user")
    .slice(-1)[0]?.content || "";

  // Get Carson's last question for context
  const lastCarsonQuestion = safeContext.history
    .filter(msg => msg.role === "assistant")
    .slice(-1)[0]?.content || "";

  // **NEW**: Add metacognitive guidance for struggling students
  const strugglingGuidance = safeContext.lastAssessment?.isStruggling ? 
    `\nMETACOGNITIVE SUPPORT: Consider asking: "${generateMetacognitiveQuestion(safeContext, safeContext.lastAssessment.answerQuality as any)}"` : '';

  // **NEW**: Handle different interaction types appropriately
  const interactionType = (safeContext.lastAssessment as any)?.interactionType;
  if (interactionType && interactionType !== 'medical_response') {
    return `
You are Carson, a warm and supportive medical tutor who understands that learning involves human emotions and needs.

**INTERACTION TYPE**: ${interactionType}

Student response: "${lastStudentAnswer}"

**RESPONSE STRATEGY**: 
${safeContext.lastAssessment?.reasoning}

After addressing their ${interactionType === 'emotional_support' ? 'emotional needs' : 
                        interactionType === 'personal_casual' ? 'personal question' :
                        interactionType === 'medical_advice' ? 'boundary request' :
                        interactionType === 'challenge_authority' ? 'challenge constructively' :
                        interactionType === 'meta_learning' ? 'learning strategy question' :
                        interactionType === 'give_up' ? 'motivational needs' :
                        interactionType === 'technical_issue' ? 'technical concern' :
                        'off-topic question'}, 
gently guide them back to our learning objectives for ${safeContext.topic}.

Be authentic, warm, and consultant-like. Show you understand their human needs while maintaining focus on their medical education journey.

Current learning context: ${currentSubtopic.title} of ${safeContext.topic}
`.trim();
  }

  return `
You're Carson, responding naturally to this medical student. Don't use templates or AI-speak.

Context:
- Topic: ${safeContext.topic}
- Current subtopic: ${currentSubtopic.title}
- Student's last answer: "${lastStudentAnswer}"
- Carson's last question: "${lastCarsonQuestion}"
- Assessment: ${safeContext.lastAssessment?.answerQuality || 'N/A'}
${safeContext.lastAssessment?.specificGaps ? `- Missing pieces: ${safeContext.lastAssessment.specificGaps}` : ''}
${safeContext.lastAssessment?.isStruggling ? '- Student seems confused/struggling' : ''}

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
  
  // **NEW**: Check if we're in post-remediation phase
  const isPostRemediation = currentSubtopicState === 'checking' || 
                            (lastAssessment?.nextAction === 'explain_and_continue' && 
                             context.history.filter(msg => msg.role === 'assistant').slice(-2).some(msg => 
                               msg.content.toLowerCase().includes('explain') || 
                               msg.content.toLowerCase().includes('let me break this down')
                             ));
  
  // **NEW**: Post-remediation completion check
  if (isPostRemediation) {
    const gapAnalysis = analyzeKnowledgeGaps(context, currentSubtopic);
    
    // If gaps are now resolved, trigger automatic transition
    if (!gapAnalysis.hasSignificantGaps && gapAnalysis.confidenceScore >= 75) {
      return `
Wonderful! They've really absorbed the concepts around ${currentSubtopic.title}. 

Assessment shows:
- Their understanding has improved nicely (confidence: ${gapAnalysis.confidenceScore}%)
- The gaps we identified have been filled
- They're ready to move forward

AUTOMATIC TRANSITION: Time to explore the next subtopic together.
Use a warm transition like: "Great - you've got ${currentSubtopic.title} down now. Let's explore [next topic] together."

Keep the energy positive and build on their success.`;
    }
    
    // Still have gaps after explanation - need verification questions
    if (gapAnalysis.hasSignificantGaps) {
      const naturallyDiscussed = analyzeNaturalCoverage(context.history, gapAnalysis.gaps);
      
      return `
They're still working through some parts of ${currentSubtopic.title} after your explanation.

${generateKindRemediationGuidance(gapAnalysis.gaps, gapAnalysis.primaryGap, naturallyDiscussed)}

Remember: Ask with curiosity, not assessment. "I'm curious about..." or "What are your thoughts on..." 
If they're still uncertain, try a different angle - maybe a real example or analogy.`;
    }
  }
  
  // **ENHANCED**: Use response context analysis for better guidance
  const responseContext = analyzeResponseContext(context);
  
  // Handle clarification questions with kindness
  if (responseContext.type === 'clarification_question') {
    return `
The student just asked for clarification - this is great! They're engaged and want to understand better.

Your approach:
1. Answer their specific question directly and warmly
2. Maybe add one related point that connects to the bigger picture
3. Ask if that helps or if they'd like to explore any part further

Tone: Encouraging and conversational. "Great question! So [specific answer]..."`;
  }
  
  // Handle follow-up questions 
  if (responseContext.type === 'follow_up_question') {
    return `
Excellent - they're asking follow-up questions! This shows genuine curiosity.

Your approach:
1. Answer their question directly 
2. Acknowledge their engagement: "I love that you're digging deeper..."
3. See if this opens up any interesting connections

Keep the conversation flowing naturally.`;
  }
  
  // Handle wrong answers or confusion
  if (responseContext.type === 'wrong_answer' || responseContext.type === 'struggle_indicator') {
    const gapAnalysis = analyzeKnowledgeGaps(context, currentSubtopic);
    const naturallyDiscussed = analyzeNaturalCoverage(context.history, gapAnalysis.gaps);
    
    return `
They're working through some challenging concepts in ${currentSubtopic.title}.

${generateKindRemediationGuidance(gapAnalysis.gaps, gapAnalysis.primaryGap, naturallyDiscussed)}

Tone: Supportive and encouraging. Start with something positive about their attempt, then gently guide them to the right understanding.`;
  }
  
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
          return `They're finding ${currentSubtopic.title} challenging. Be extra gentle and break things down step by step. Show them you believe in their ability to get this.`;
        } else if (isBasicTopic) {
          return `They're understanding ${currentSubtopic.title} well! Make sure they can explain the fundamentals clearly - even strong students benefit from articulating the basics.`;
        } else {
          return `They're doing well with ${currentSubtopic.title}. You can explore a bit deeper, but keep checking that the foundation is solid.`;
        }
        
      case 'explain_and_continue':
        // **ENHANCED**: Set up for kind, thoughtful explanation
        if (isBasicTopic) {
          return `They missed something important about ${currentSubtopic.title}. Help them understand the basics in a friendly, clear way. Then check if it made sense with a gentle follow-up.`;
        } else {
          return `They need some guidance with ${currentSubtopic.title}. Share what they missed in a helpful way, then see if they've got it with a friendly question.`;
        }
        
      case 'explain_thoroughly':
        return `${currentSubtopic.title} is proving tricky for them. Take your time explaining the essentials clearly and kindly. Follow up with an encouraging question to see if it clicked.`;
        
      case 'move_to_next':
        if (isBasicTopic) {
          return `They've got the fundamentals of ${currentSubtopic.title} down! You can move forward to the next core concept, celebrating their progress.`;
        } else {
          return `Great progress on ${currentSubtopic.title}! Time to explore what comes next, building on what they've learned.`;
        }
        
      default:
        if (isBasicTopic) {
          return `Continue exploring the fundamentals of ${currentSubtopic.title} with them. Make sure they really understand these building blocks.`;
        } else {
          return `Keep exploring ${currentSubtopic.title}, but ensure all the foundational pieces are in place first.`;
        }
    }
  }
  
  // Default instruction with encouraging tone
  if (isBasicTopic) {
    return `Focus on helping them really understand ${currentSubtopic.title}. These fundamentals are so important - take the time to make sure they've got them.`;
  } else {
    return `Explore ${currentSubtopic.title} with them, but make sure you've covered all the basics first. Build understanding step by step.`;
  }
}

// **NEW**: Function to generate kind, contextual remediation guidance
function generateKindRemediationGuidance(gaps: string[], primaryGap: string, naturallyDiscussed: { [gap: string]: boolean }): string {
  if (gaps.length === 0) {
    return "Continue supporting their learning journey.";
  }
  
  const mainGap = primaryGap || gaps[0];
  const wasDiscussed = naturallyDiscussed[mainGap] || false;
  
  if (wasDiscussed) {
    return `Focus on: "${mainGap}"

Since you touched on this earlier, you could say something like:
"We talked about [concept] before, but let me help clarify the specific part about [specific detail]..."

Approach: Acknowledge + Reinforce
- Reference what you discussed before
- Focus on the specific piece they're missing
- Build on what they already understand`;
  } else {
    return `Focus on: "${mainGap}"

This is new territory for them, so you can introduce it fresh:
"Let's explore [concept] together..." or "Here's what's happening with [specific detail]..."

Approach: Gentle Introduction
- Start with what they do know
- Connect it to this new concept
- Check for understanding as you go`;
  }
}

// **NEW**: Function to analyze what was naturally covered in conversation
function analyzeNaturalCoverage(history: any[], gaps: string[]): { [gap: string]: boolean } {
  const coverage: { [gap: string]: boolean } = {};
  
  // Get Carson's recent messages
  const carsonMessages = history
    .filter(msg => msg.role === 'assistant')
    .slice(-6) // Look at last 6 Carson messages
    .map(msg => msg.content.toLowerCase());
  
  gaps.forEach(gap => {
    const gapLower = gap.toLowerCase();
    
    // Check if Carson mentioned this gap in recent conversation
    const wasDiscussed = carsonMessages.some(content => {
      // Look for key terms from the gap
      const gapTerms = gapLower.split(' ').filter(term => term.length > 3);
      const mentionedTerms = gapTerms.filter(term => content.includes(term));
      
      // If we mentioned most of the gap terms, likely discussed
      return mentionedTerms.length >= Math.min(2, gapTerms.length);
    });
    
    coverage[gap] = wasDiscussed;
  });
  
  return coverage;
}

function analyzeKnowledgeGaps(context: PromptContext, currentSubtopic: CurrentSubtopic): GapAnalysis {
  // Use existing assessment data if available
  const lastAssessment = context.lastAssessment;
  
  if (!lastAssessment) {
    return {
      hasSignificantGaps: false,
      gaps: [],
      primaryGap: '',
      confidenceScore: 0
    };
  }

  // **NEW**: Coverage Analysis - What should have been covered vs. what was covered
  const expectedConcepts = getExpectedConcepts(currentSubtopic.title, context.topic);
  const coveredConcepts = analyzeCoveredConcepts(context.history, currentSubtopic.title);
  const missedConcepts = expectedConcepts.filter(concept => 
    !coveredConcepts.some((covered: string) => 
      covered.toLowerCase().includes(concept.toLowerCase()) || 
      concept.toLowerCase().includes(covered.toLowerCase())
    )
  );

  // **ENHANCED**: Check for improvement after remediation
  const recentStudentResponses = context.history
    .filter(msg => msg.role === "user")
    .slice(-3)
    .map(msg => msg.content);

  const recentCarsonResponses = context.history
    .filter(msg => msg.role === "assistant")
    .slice(-3)
    .map(msg => msg.content);

  // **ENHANCED**: Detect if Carson recently provided explanations (natural or formal)
  const recentlyExplained = recentCarsonResponses.some(response => {
    const content = response.toLowerCase();
    return (
      // Formal explanation patterns
      content.includes('explain') ||
      content.includes('let me break this down') ||
      content.includes('here\'s how') ||
      content.includes('think of it this way') ||
      // **NEW**: Natural explanation patterns
      content.includes('let\'s clarify') ||
      content.includes('but let\'s') ||
      content.includes('actually') ||
      content.includes('more specifically') ||
      content.includes('to clarify') ||
      content.includes('what i mean is') ||
      content.includes('in other words') ||
      // Content-based indicators (Carson provided substantial explanation)
      (content.length > 200 && (
        content.includes('first') || content.includes('second') || content.includes('third') ||
        content.includes('stage') || content.includes('phase') || content.includes('step')
      ))
    );
  });

  // **NEW**: Analyze response quality improvement
  let qualityImprovement = false;
  if (recentStudentResponses.length >= 2 && recentlyExplained) {
    const latestResponse = recentStudentResponses[recentStudentResponses.length - 1];
    const previousResponse = recentStudentResponses[recentStudentResponses.length - 2];
    
    // Simple quality indicators
    const latestQuality = assessResponseQuality(latestResponse);
    const previousQuality = assessResponseQuality(previousResponse);
    
    qualityImprovement = latestQuality > previousQuality;
  }
  
  // Determine if gaps are significant based on assessment quality and indicators
  const isStruggling = lastAssessment.isStruggling || lastAssessment.answerQuality === 'confused' || lastAssessment.answerQuality === 'poor';
  const hasSpecificGaps = lastAssessment.specificGaps && lastAssessment.specificGaps.length > 0;
  const needsExplanation = currentSubtopic.needsExplanation || false;
  
  // **ENHANCED**: Factor in recent improvement
  let hasSignificantGaps = isStruggling || hasSpecificGaps || needsExplanation;
  
  // If we recently explained and see improvement, reduce gap significance
  if (recentlyExplained && qualityImprovement) {
    hasSignificantGaps = false;
  }
  
  // **ENHANCED**: Extract gaps from multiple sources
  const gaps: string[] = [];
  
  // Traditional gap detection (student confusion/struggle)
  if (hasSpecificGaps && !qualityImprovement) {
    gaps.push(lastAssessment.specificGaps!);
  }
  
  if (isStruggling && !qualityImprovement) {
    gaps.push(`fundamental understanding of ${currentSubtopic.title}`);
  }
  
  if (needsExplanation && !qualityImprovement) {
    gaps.push(`clear explanation of ${currentSubtopic.title} concepts`);
  }
  
  // **NEW**: Coverage-based gap detection (missed opportunities)
  const missedOpportunityGaps: string[] = [];
  if (missedConcepts.length > 0 && !recentlyExplained) {
    // Only surface missed concepts if Carson hasn't recently explained things
    missedOpportunityGaps.push(...missedConcepts.map(concept => `${concept} (not covered during discussion)`));
  }
  
  // **INTELLIGENT GAP PRIORITIZATION**: Combine all gap sources and prioritize
  const allGaps = [...gaps, ...missedOpportunityGaps];
  
  // Add default gap if none identified but assessment suggests issues
  if (allGaps.length === 0 && (lastAssessment.answerQuality === 'partial' || lastAssessment.answerQuality === 'unclear') && !qualityImprovement) {
    allGaps.push(`complete understanding of ${currentSubtopic.title}`);
  }
  
  // Use intelligent prioritization instead of arbitrary limits
  const prioritizedGaps = prioritizeGaps(allGaps, context, currentSubtopic);
  const finalGaps = prioritizedGaps.length > 0 ? prioritizedGaps : allGaps;
  
  const primaryGap = finalGaps.length > 0 ? finalGaps[0] : `understanding of ${currentSubtopic.title}`;
  
  // **ENHANCED**: Confidence based on assessment quality + improvement
  let confidenceScore = lastAssessment.answerQuality === 'excellent' ? 90 :
                        lastAssessment.answerQuality === 'good' ? 75 :
                        lastAssessment.answerQuality === 'partial' ? 60 : 40;
  
  // Boost confidence if we see improvement after explanation
  if (qualityImprovement) {
    confidenceScore = Math.min(90, confidenceScore + 20);
  }
  
  // **ENHANCED**: Check if we recently explained concepts (natural or formal)
  const recentMessages = context.history.slice(-4);
  const carsonExplained = recentMessages.some(msg => {
    if (msg.role !== 'assistant') return false;
    const content = msg.content.toLowerCase();
    return (
      // Formal explanation patterns  
      content.includes('let me explain') ||
      content.includes('let me break this down') ||
      content.includes('here\'s how') ||
      content.includes('the key concept') ||
      // **NEW**: Natural explanation patterns
      content.includes('let\'s clarify') ||
      content.includes('but let\'s') ||
      content.includes('actually') ||
      content.includes('more specifically') ||
      content.includes('to clarify') ||
      content.includes('what i mean is') ||
      content.includes('in other words') ||
      // Content-based indicators (substantial explanatory content)
      (content.length > 200 && (
        content.includes('first') || content.includes('second') || content.includes('third') ||
        content.includes('stage') || content.includes('phase') || content.includes('step') ||
        content.includes('because') || content.includes('this is')
      ))
    );
  });
  
  // Check for confirmation patterns in student's latest response
  const lastStudentResponse = context.history
    .filter(msg => msg.role === 'user')
    .slice(-1)[0]?.content?.toLowerCase() || '';
    
  const hasConfirmation = /\b(yes|yeah|yep|got it|understand|makes sense|i see|okay|ok|right|correct|exactly)\b/.test(lastStudentResponse);
  const showsConfidence = /\b(i think|i believe|so it's|therefore|because|that means)\b/.test(lastStudentResponse);
  
  // **NEW**: Simple confirmation-based transition
  if (carsonExplained && (hasConfirmation || showsConfidence)) {
    return {
      hasSignificantGaps: false,
      gaps: [],
      primaryGap: '',
      confidenceScore: 85, // High confidence when student confirms understanding
      remediationAttempts: 0
    };
  }
  
  // **NEW**: Enhanced gap tracking with per-gap attempt limits
  const gapAttempts: { [gap: string]: number } = analyzeGapAttempts(context.history, context.subtopics[context.currentSubtopicIndex]?.title);
  const totalAttempts: number = Object.values(gapAttempts).reduce((sum: number, attempts: number) => sum + attempts, 0);
  const maxAttemptsPerGap = 2;
  const maxTotalAttempts = 6; // Don't spend more than 6 total explanations on one subtopic
  
  // Check if we should abandon ALL remediation
  const shouldAbandonAll = totalAttempts >= maxTotalAttempts;
  if (shouldAbandonAll) {
    return {
      hasSignificantGaps: false,
      gaps: [],
      primaryGap: '',
      confidenceScore: 60,
      shouldAbandonRemediation: true,
      totalAttempts: totalAttempts,
      remediationAttempts: totalAttempts
    };
  }
  
  return {
    hasSignificantGaps: finalGaps.length > 0,
    gaps: finalGaps,
    primaryGap,
    confidenceScore
  };
}

// **NEW**: Simple response quality assessment
function analyzeGapAttempts(history: any[], subtopicTitle: string): { [gap: string]: number } {
  // Count how many times Carson has explained different concepts in this subtopic
  const attempts: { [gap: string]: number } = {};
  
  const carsonExplanations = history.filter(msg => 
    msg.role === 'assistant' && (
      msg.content.toLowerCase().includes('let me explain') ||
      msg.content.toLowerCase().includes('let me break this down') ||
      msg.content.toLowerCase().includes('let me try a different approach') ||
      msg.content.toLowerCase().includes('here\'s another way')
    )
  );
  
  // For simplicity, assume each explanation is for a different gap
  // In practice, you'd want more sophisticated parsing to identify which specific gap is being addressed
  carsonExplanations.forEach((msg, index) => {
    const gapKey = `gap_${index + 1}`;
    attempts[gapKey] = (attempts[gapKey] || 0) + 1;
  });
  
  return attempts;
}

function analyzeCoveredConcepts(history: any[], subtopicTitle: string): string[] {
  // Extract concepts that Carson has actually covered during conversation
  const coveredConcepts: string[] = [];
  
  const carsonMessages = history.filter(msg => msg.role === 'assistant');
  
  carsonMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    
    // Look for specific medical/educational concept indicators
    const conceptPatterns = [
      // Pathophysiology concepts
      /mechanism[s]?|process[es]?|pathway[s]?|cascade/g,
      /cellular|molecular|physiological/g,
      
      // Diagnosis concepts  
      /sign[s]?|symptom[s]?|presentation[s]?/g,
      /criteria|diagnosis|differential/g,
      
      // Management concepts
      /treatment[s]?|medication[s]?|therapy|intervention[s]?/g,
      /management|approach|protocol[s]?/g,
      
      // Clinical concepts
      /complication[s]?|risk[s]?|outcome[s]?/g,
      /prognosis|recovery|monitoring/g,
      
      // Specific medical terms (these would be expanded based on topic)
      /stage[s]?|phase[s]?|level[s]?|grade[s]?/g,
      /factor[s]?|cause[s]?|trigger[s]?/g
    ];
    
         conceptPatterns.forEach(pattern => {
       const matches = content.match(pattern);
       if (matches) {
         matches.forEach((match: string) => {
           if (!coveredConcepts.includes(match)) {
             coveredConcepts.push(match);
           }
         });
       }
     });
    
    // Also extract key educational phrases Carson used
    if (content.includes('important') || content.includes('key') || content.includes('critical')) {
      // Extract the concept being emphasized
      const sentences = content.split(/[.!?]+/);
             sentences.forEach((sentence: string) => {
         if ((sentence.includes('important') || sentence.includes('key') || sentence.includes('critical')) && sentence.length < 100) {
           const concept = sentence.replace(/.*(?:important|key|critical)\s+(?:is|concept|point|to understand|that)\s*/i, '').trim();
           if (concept && concept.length > 3 && concept.length < 50) {
             coveredConcepts.push(concept);
           }
         }
       });
    }
  });
  
  return coveredConcepts;
}

function assessResponseQuality(response: string): number {
  if (!response || response.length < 10) return 20;
  
  const medicalTerms = ['pathophysiology', 'diagnosis', 'treatment', 'symptoms', 'mechanism', 'patient', 'clinical', 'management', 'therapy', 'medication', 'disease', 'condition', 'syndrome'];
  const reasoningWords = ['because', 'since', 'therefore', 'due to', 'leads to', 'causes', 'results in', 'indicates', 'suggests'];
  const uncertaintyWords = ['i think', 'maybe', 'not sure', 'i guess', 'i don\'t know'];
  
  let score = 40; // Base score
  
  // Medical terminology usage
  const medicalTermCount = medicalTerms.filter(term => response.toLowerCase().includes(term)).length;
  score += medicalTermCount * 5;
  
  // Reasoning patterns
  const reasoningCount = reasoningWords.filter(word => response.toLowerCase().includes(word)).length;
  score += reasoningCount * 8;
  
  // Uncertainty penalty
  const uncertaintyCount = uncertaintyWords.filter(word => response.toLowerCase().includes(word)).length;
  score -= uncertaintyCount * 10;
  
  // Length bonus (reasonable explanations are longer)
  if (response.length > 50) score += 10;
  if (response.length > 100) score += 10;
  
  return Math.max(20, Math.min(100, score));
}

// **NEW**: Intelligent Gap Prioritization System
interface GapPriority {
  gap: string;
  priority: number;
  category: 'critical' | 'important' | 'minor';
  reasoning: string;
}

function prioritizeGaps(allGaps: string[], context: PromptContext, currentSubtopic: CurrentSubtopic): string[] {
  if (allGaps.length === 0) return [];
  
  // Score each gap based on multiple factors
  const scoredGaps: GapPriority[] = allGaps.map(gap => {
    let priority = 0;
    let category: 'critical' | 'important' | 'minor' = 'minor';
    let reasoning = '';
    
    const gapLower = gap.toLowerCase();
    const subtopicLower = currentSubtopic.title.toLowerCase();
    const topic = context.topic?.toLowerCase() || '';
    
    // **1. CLINICAL IMPACT SCORING** (0-40 points)
    if (isClinicallyRiskyGap(gapLower, subtopicLower, topic)) {
      priority += 40;
      category = 'critical';
      reasoning += 'Patient safety risk. ';
    }
    
    // **2. FOUNDATION CONCEPT SCORING** (0-30 points)
    if (isFoundationConcept(gapLower, subtopicLower)) {
      priority += 30;
      if (category !== 'critical') category = 'important';
      reasoning += 'Blocks future learning. ';
    }
    
    // **3. STUDENT CONFUSION LEVEL** (0-20 points)
    const confusionLevel = assessStudentConfusion(gap, context);
    priority += confusionLevel;
    reasoning += `Confusion level: ${confusionLevel}/20. `;
    
    // **4. FREQUENCY/RELEVANCE** (0-10 points)
    if (isFrequentlyTested(gapLower, subtopicLower)) {
      priority += 10;
      reasoning += 'High-yield concept. ';
    }
    
    return { gap, priority, category, reasoning };
  });
  
  // Sort by priority (highest first)
  scoredGaps.sort((a, b) => b.priority - a.priority);
  
  // **INTELLIGENT SELECTION LOGIC**
  const selectedGaps: string[] = [];
  
  // Always include CRITICAL gaps (up to 3)
  const criticalGaps = scoredGaps.filter(g => g.category === 'critical').slice(0, 3);
  selectedGaps.push(...criticalGaps.map(g => g.gap));
  
  // Add IMPORTANT gaps if we have cognitive space (total limit: 4-5 concepts)
  if (selectedGaps.length < 4) {
    const importantGaps = scoredGaps
      .filter(g => g.category === 'important' && !selectedGaps.includes(g.gap))
      .slice(0, 4 - selectedGaps.length);
    selectedGaps.push(...importantGaps.map(g => g.gap));
  }
  
  // Add one MINOR gap if we have room and cognitive load is low
  if (selectedGaps.length < 3) {
    const minorGaps = scoredGaps
      .filter(g => g.category === 'minor' && !selectedGaps.includes(g.gap))
      .slice(0, 1);
    selectedGaps.push(...minorGaps.map(g => g.gap));
  }
  
  return selectedGaps;
}

function isClinicallyRiskyGap(gap: string, subtopic: string, topic: string): boolean {
  const riskIndicators = [
    // Diagnosis risks
    'differential diagnosis', 'red flags', 'emergency', 'urgent', 'life threatening',
    'signs', 'symptoms', 'presentation', 'recognition',
    
    // Treatment risks  
    'contraindications', 'dosing', 'side effects', 'drug interactions',
    'management', 'treatment', 'intervention', 'medication',
    
    // Monitoring risks
    'complications', 'monitoring', 'follow up', 'adverse',
    
    // High-stakes conditions
    'cardiac', 'respiratory', 'neurological', 'sepsis', 'shock'
  ];
  
  return riskIndicators.some(indicator => 
    gap.includes(indicator) || subtopic.includes(indicator) || topic.includes(indicator)
  );
}

function isFoundationConcept(gap: string, subtopic: string): boolean {
  const foundationIndicators = [
    'pathophysiology', 'mechanism', 'basic understanding', 'fundamental',
    'definition', 'classification', 'anatomy', 'physiology',
    'etiology', 'causes', 'risk factors'
  ];
  
  return foundationIndicators.some(indicator => 
    gap.includes(indicator) || subtopic.includes(indicator)
  );
}

function assessStudentConfusion(gap: string, context: PromptContext): number {
  // Analyze recent conversation for confusion indicators related to this gap
  const recentMessages = context.history.slice(-6);
  const studentMessages = recentMessages.filter(msg => msg.role === 'user');
  
  let confusionScore = 0;
  
  studentMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    
    // Strong confusion indicators (+15)
    if (content.includes('i don\'t understand') || content.includes('i\'m confused')) {
      confusionScore += 15;
    }
    
    // Moderate confusion (+10)
    if (content.includes('not sure') || content.includes('i think') || content.includes('maybe')) {
      confusionScore += 10;
    }
    
    // Question patterns (+8)
    if (content.includes('what is') || content.includes('how does') || content.includes('why')) {
      confusionScore += 8;
    }
    
    // Uncertainty language (+5)
    if (content.includes('i guess') || content.includes('probably') || content.includes('might be')) {
      confusionScore += 5;
    }
  });
  
  return Math.min(20, confusionScore);
}

function isFrequentlyTested(gap: string, subtopic: string): boolean {
  const highYieldIndicators = [
    'diagnosis', 'treatment', 'management', 'complications',
    'first line', 'gold standard', 'most common', 'typical',
    'classic', 'key', 'important', 'essential'
  ];
  
  return highYieldIndicators.some(indicator => 
    gap.includes(indicator) || subtopic.includes(indicator)
  );
}

// Helper functions for completion choice detection
function containsNotesRequest(message: string): boolean {
  const notesKeywords = ['notes', 'note', 'journal', 'save', 'store', 'write', 'record', 'keep'];
  const lowerMessage = message.toLowerCase();
  return notesKeywords.some(keyword => lowerMessage.includes(keyword)) ||
         lowerMessage.includes('yes') || 
         lowerMessage.includes('sure') ||
         lowerMessage.includes('please');
}

function containsNewTopicRequest(message: string): boolean {
  const newTopicPatterns = [
    /new topic|different topic|another topic|something else/i,
    /study something else|learn about something else/i,
    /move on|next topic|different subject/i
  ];
  return newTopicPatterns.some(pattern => pattern.test(message));
}

function getExpectedConcepts(subtopic: string, topic: string): string[] {
  // Enhanced concept mapping based on subtopic and medical topic
  const subtopicLower = subtopic.toLowerCase();
  const topicLower = topic.toLowerCase();
  
  // General medical concept frameworks
  const generalConcepts: Record<string, string[]> = {
    'pathophysiology': ['underlying mechanism', 'cellular process', 'disease progression', 'physiological changes'],
    'diagnosis': ['clinical presentation', 'diagnostic criteria', 'differential diagnosis', 'diagnostic tests'],
    'management': ['treatment approach', 'therapeutic options', 'monitoring requirements', 'patient education'],
    'complications': ['potential risks', 'adverse outcomes', 'risk factors', 'prevention strategies'],
    'prognosis': ['expected outcomes', 'prognostic factors', 'recovery timeline', 'long-term implications']
  };
  
  // Topic-specific concept additions
  const topicSpecificConcepts: Record<string, Record<string, string[]>> = {
    'labour': {
      'stages': ['latent phase', 'active phase', 'transitional phase', 'cervical dilation', 'descent of fetus'],
      'physiology': ['uterine contractions', 'hormonal control', 'cervical changes', 'fetal positioning'],
      'management': ['pain relief options', 'monitoring fetal wellbeing', 'delivery assistance', 'third stage management']
    },
    'uterine fibroids': {
      'pathophysiology': ['smooth muscle proliferation', 'hormonal influence', 'growth factors', 'vascular supply'],
      'symptoms': ['menorrhagia', 'bulk symptoms', 'pressure effects', 'fertility impact'],
      'management': ['medical therapy', 'surgical options', 'minimally invasive procedures', 'expectant management']
    }
  };
  
  let expectedConcepts: string[] = [];
  
  // Get general concepts for the subtopic type
  for (const [key, concepts] of Object.entries(generalConcepts)) {
    if (subtopicLower.includes(key)) {
      expectedConcepts.push(...concepts);
    }
  }
  
  // Add topic-specific concepts
  if (topicSpecificConcepts[topicLower]) {
    for (const [key, concepts] of Object.entries(topicSpecificConcepts[topicLower])) {
      if (subtopicLower.includes(key)) {
        expectedConcepts.push(...concepts);
      }
    }
  }
  
  // Fallback if no specific mapping found
  if (expectedConcepts.length === 0) {
    expectedConcepts = ['key concepts', 'clinical significance', 'practical application'];
  }
  
  return expectedConcepts;
}

/**
 * Analyzes the context and type of student's last response to determine appropriate action
 */
function analyzeResponseContext(context: PromptContext): ResponseContext {
  if (!context.history || context.history.length < 2) {
    return {
      type: 'regular_response',
      confidence: 50,
      reasoning: 'No conversation history to analyze',
      requiresDirectAnswer: false,
      shouldTriggerGapAnalysis: false,
      suggestedAction: 'continue_conversation'
    };
  }

  const lastStudentMessage = context.history[context.history.length - 1];
  const studentText = lastStudentMessage?.content?.toLowerCase() || '';
  
  // 1. CLARIFICATION QUESTIONS - Single terms, question words, "what is", etc.
  const clarificationPatterns = [
    /^[a-z\s]{1,20}\?$/,  // Short questions like "pedunculated fibroids?"
    /^what'?s?\s+/,       // "what's", "what is"
    /^can you (explain|clarify|tell me)/,
    /^how do you/,
    /^why does?/,
    /^what does?\s+\w+\s+mean/,
    /^\w+\s*\?$/,         // Single word + question mark
    /^(define|explain|clarify)\s+/,
    /difference between/i,
    /what about/i
  ];

  if (clarificationPatterns.some(pattern => pattern.test(studentText))) {
    return {
      type: 'clarification_question',
      confidence: 90,
      reasoning: 'Student asking for clarification or definition',
      requiresDirectAnswer: true,
      shouldTriggerGapAnalysis: false,
      suggestedAction: 'answer_directly'
    };
  }

  // 2. STRUGGLE INDICATORS - Confusion, uncertainty, "I don't know"
  const strugglePatterns = [
    /i don'?t (know|understand|get it)/,
    /i'?m (confused|lost|not sure)/,
    /this is (hard|difficult|confusing)/,
    /i'?m struggling with/,
    /can you help me/,
    /i need help/,
    /this doesn'?t make sense/,
    /i'?m not following/,
    /can you explain (again|more|better)/,
    /still don'?t understand/
  ];

  if (strugglePatterns.some(pattern => pattern.test(studentText))) {
    return {
      type: 'struggle_indicator',
      confidence: 85,
      reasoning: 'Student explicitly expressing confusion or difficulty',
      requiresDirectAnswer: false,
      shouldTriggerGapAnalysis: true,
      suggestedAction: 'offer_help'
    };
  }

  // 3. POST-EXPLANATION CONFIRMATION - "Yes" after Carson explained something
  const previousCarsonMessage = context.history.length >= 2 ? 
    context.history[context.history.length - 2]?.content || '' : '';

  // Check if Carson just finished explaining something (ended with confirmation check)
  const carsonJustExplained = [
    /does that make sense\?/i,
    /was that clear(er)?\?/i,
    /does this help\?/i,
    /make sense now\?/i,
    /clearer now\?/i,
    /does that help\?/i,
    /understand that\?/i,
    /following me\?/i
  ].some(pattern => pattern.test(previousCarsonMessage));

  const confirmationPatterns = [
    /^(yes|yeah|yep|got it|understand|makes sense)\.?$/,
    /^(i see|i get it|that makes sense|okay|ok)\.?$/,
    /^(right|correct|exactly|absolutely)\.?$/,
    /i understand (now|that|it)/,
    /that helps/,
    /makes sense now/,
    /^thank you/,
    /^thanks/,
    /clearer now/,
    /i follow/
  ];

  if (carsonJustExplained && confirmationPatterns.some(pattern => pattern.test(studentText))) {
    return {
      type: 'post_explanation_confirmation',
      confidence: 85,
      reasoning: 'Student confirming understanding after Carson explained something',
      requiresDirectAnswer: false,
      shouldTriggerGapAnalysis: false,
      suggestedAction: 'check_broader_understanding'
    };
  }

  // 4. GENERAL CONFIDENCE EXPRESSIONS - When not post-explanation
  if (confirmationPatterns.some(pattern => pattern.test(studentText))) {
    return {
      type: 'confidence_expression',
      confidence: 80,
      reasoning: 'Student expressing understanding or agreement',
      requiresDirectAnswer: false,
      shouldTriggerGapAnalysis: false,
      suggestedAction: 'transition'
    };
  }

  // 5. FOLLOW-UP QUESTIONS - Building on previous answers
  const followUpPatterns = [
    /^(and|but|so|then|also|what if|how about)/,
    /what happens (if|when|next)/,
    /in that case/,
    /^(okay|ok),?\s+(but|and|so|what|how)/
  ];

  if (followUpPatterns.some(pattern => pattern.test(studentText))) {
    return {
      type: 'follow_up_question',
      confidence: 75,
      reasoning: 'Student asking follow-up question showing engagement',
      requiresDirectAnswer: true,
      shouldTriggerGapAnalysis: false,
      suggestedAction: 'answer_directly'
    };
  }

  // 6. WRONG ANSWERS - Only trigger for CLEAR indicators of confusion/incorrect knowledge
  const wasQuestionAsked = /\?/.test(previousCarsonMessage);
  
  if (wasQuestionAsked && studentText.length > 10) {
         // Only flag as wrong if EXTREMELY clear confusion indicators
     const extremeConfusionIndicators = [
       /i don'?t know/,
       /no idea/,
       /completely wrong/,
       /i have no clue/,
       /i'?m totally lost/,
       /that doesn'?t sound right/,
       /this makes no sense/,
       /i'?m so confused/
     ];
     
     const multipleUncertaintyWords = [
       /not sure but.*i guess/,
       /maybe.*probably.*i think/,
       /could be.*might be.*not sure/
     ];
     
     const hasExtremeConfusion = extremeConfusionIndicators.some(pattern => pattern.test(studentText));
     const hasChainedUncertainty = multipleUncertaintyWords.some(pattern => pattern.test(studentText));
     const isWayTooLong = studentText.length > 600; // Even higher threshold
     
     // VERY conservative - only trigger for truly confused responses
     if (hasExtremeConfusion || (hasChainedUncertainty && isWayTooLong)) {
      return {
        type: 'wrong_answer',
        confidence: 70,
        reasoning: 'Student showing clear confusion or multiple uncertainty indicators',
        requiresDirectAnswer: false,
        shouldTriggerGapAnalysis: true,
        suggestedAction: 'assess_gaps'
      };
    }
  }

  // 7. SYNTHESIS RESPONSE - Good comprehensive answer that should conclude conversation
  const isLastSubtopic = context.currentSubtopicIndex === (context.subtopics.length - 1);
  
  if (isLastSubtopic) {
    // Check if Carson recently asked a synthesis question
    const recentCarsonMessages = context.history
      .filter(msg => msg.role === 'assistant')
      .slice(-3) // Check last 3 Carson messages
      .map(msg => msg.content.toLowerCase());
    
    const synthesisQuestionPatterns = [
      /how would you explain.*to.*medical student/,
      /walk me through your approach/,
      /summarize.*in.*minutes/,
      /what.*key points.*would you hit/,
      /synthesize.*understanding/,
      /explain.*fellow student/,
      /before we finish/,
      /wrap.*up.*understanding/
    ];
    
    const askedSynthesisQuestion = recentCarsonMessages.some(msg => 
      synthesisQuestionPatterns.some(pattern => pattern.test(msg))
    );
    
    if (askedSynthesisQuestion) {
      // **FIXED**: More lenient synthesis analysis to avoid infinite loops
      const basicIndicators = [
        studentText.length > 50, // Reasonable response length (lowered from 150)
        context.topic && new RegExp(context.topic.split(' ').slice(0,2).join('|'), 'i').test(studentText), // Topic relevance
        !/^(already did|i did|done|no|yes)\.?$/i.test(studentText.trim()) // Not a dismissive response
      ];
      
      const advancedIndicators = [
        studentText.length > 150, // Substantial response
        /first.*second.*third|1.*2.*3/i.test(studentText), // Structured points
        /start.*then.*finally|begin.*next.*end/i.test(studentText), // Process description
        /important.*key.*essential/i.test(studentText), // Prioritization
        /because.*therefore.*so/i.test(studentText), // Causal reasoning
        /management|treatment|diagnosis|patient/i.test(studentText) // Medical concepts
      ];
      
      const basicScore = basicIndicators.filter(Boolean).length;
      const advancedScore = advancedIndicators.filter(Boolean).length;
      
      // Much more lenient: Either hit all 3 basic requirements OR have 2+ advanced indicators
      if (basicScore >= 3 || advancedScore >= 2) {
        return {
          type: 'confidence_expression',
          confidence: 95,
          reasoning: 'Student provided adequate synthesis response - ready to conclude',
          requiresDirectAnswer: false,
          shouldTriggerGapAnalysis: false,
          suggestedAction: 'conclude_gracefully'
        };
      }
      
      // **NEW**: Handle dismissive responses to avoid loops
      if (basicScore === 2 && /^(already did|i did|done)\.?$/i.test(studentText.trim())) {
        return {
          type: 'confidence_expression',
          confidence: 85,
          reasoning: 'Student indicating they already provided synthesis - conclude to avoid loop',
          requiresDirectAnswer: false,
          shouldTriggerGapAnalysis: false,
          suggestedAction: 'conclude_gracefully'
        };
      }
    }
  }

  // Default: Regular conversational response
  return {
    type: 'regular_response',
    confidence: 50,
    reasoning: 'Standard conversational response',
    requiresDirectAnswer: false,
    shouldTriggerGapAnalysis: false,
    suggestedAction: 'continue_conversation'
  };
}

/**
 * Generate conversational prompt for student questions
 */
function generateConversationalPrompt(
  intent: any,
  userMessage: string,
  context: PromptContext
): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  
  switch (intent.type) {
    case 'definition':
      return generateDefinitionPrompt(userMessage, context.topic, currentSubtopic?.title, intent.interruptedQuestion);
    
    case 'mechanism':
      return generateMechanismPrompt(userMessage, context.topic, currentSubtopic?.title, intent.interruptedQuestion);
    
    case 'timeframe':
      return generateTimeframePrompt(userMessage, context.topic, currentSubtopic?.title, intent.interruptedQuestion);
    
    case 'comparison':
      return generateComparisonPrompt(userMessage, context.topic, currentSubtopic?.title, intent.interruptedQuestion);
    
    case 'clarification':
      return generateClarificationPrompt(userMessage, context, intent.interruptedQuestion);
    
    case 'example':
      return generateExamplePrompt(userMessage, context.topic, currentSubtopic?.title, intent.interruptedQuestion);
    
    case 'off_topic':
      return generateOffTopicPrompt(userMessage, context.topic);
    
    case 'uncertain_answer':
      return generateUncertainAnswerPrompt(userMessage, context);
    
    default:
      return generateDefaultConversationalPrompt(userMessage, context);
  }
}

/**
 * Generate definition prompt
 */
function generateDefinitionPrompt(userMessage: string, topic: string, subtopic?: string, interruptedQuestion?: string): string {
  // Extract the term they're asking about
  const termMatch = userMessage.match(/what (does|is) (\w+) (mean|stand for)|what('s| is) (\w+)\?|define (\w+)/i);
  const term = termMatch ? (termMatch[2] || termMatch[5] || termMatch[6]) : 'that term';
  
  const resumeInstructions = interruptedQuestion 
    ? `\n\n**CRITICAL - EXACT QUESTION TO RESUME**: After answering their definition question, you MUST return to this EXACT question word-for-word: "${interruptedQuestion}"\n\nExample format: "Great question! [definition]... Now, back to what I was asking: ${interruptedQuestion}"`
    : '';
  
  return `
You're Carson, and the student just asked: "${userMessage}"

This is a definition question about ${term} in the context of ${topic}${subtopic ? ` (specifically ${subtopic})` : ''}.

Your response:
1. Give a clear, contextual definition of ${term}
2. Make it relevant to what you've been discussing about ${topic}
3. Keep it conversational - you're clarifying, not lecturing
4. End naturally - "Does that help?" or "What else would you like to know?"${resumeInstructions}

Stay warm and educational.
`.trim();
}

/**
 * Generate mechanism prompt
 */
function generateMechanismPrompt(userMessage: string, topic: string, subtopic?: string, interruptedQuestion?: string): string {
  const resumeInstructions = interruptedQuestion 
    ? `\n\n**CRITICAL - EXACT QUESTION TO RESUME**: After explaining the mechanism, you MUST return to this EXACT question word-for-word: "${interruptedQuestion}"\n\nExample format: "Good question about the mechanism! [explanation]... Now, let's get back to: ${interruptedQuestion}"`
    : '';
  
  return `
You're Carson, and the student just asked: "${userMessage}"

This is a mechanism/process question about ${topic}${subtopic ? ` (specifically ${subtopic})` : ''}.

Your response:
1. Explain the mechanism step-by-step in simple terms
2. Connect it to the clinical context of ${topic}
3. Use analogies if helpful
4. Keep it conversational and engaging${resumeInstructions}

Be thorough but accessible.
`.trim();
}

/**
 * Generate timeframe prompt
 */
function generateTimeframePrompt(userMessage: string, topic: string, subtopic?: string, interruptedQuestion?: string): string {
  const resumeInstructions = interruptedQuestion 
    ? `\n\n**CRITICAL - EXACT QUESTION TO RESUME**: After answering about timing, you MUST return to this EXACT question word-for-word: "${interruptedQuestion}"\n\nExample format: "That's an important timing question! [timing info]... Alright, back to our discussion: ${interruptedQuestion}"`
    : '';
  
  return `
You're Carson, and the student just asked: "${userMessage}"

This is a timing/duration question about ${topic}${subtopic ? ` (specifically ${subtopic})` : ''}.

Your response:
1. Give specific timeframes with clinical context
2. Explain why timing matters for this condition/process
3. Include relevant clinical pearls about timing
4. Keep it practical and memorable${resumeInstructions}

Make timing clinically relevant.
`.trim();
}

/**
 * Generate comparison prompt
 */
function generateComparisonPrompt(userMessage: string, topic: string, subtopic?: string, interruptedQuestion?: string): string {
  const resumeInstructions = interruptedQuestion 
    ? `\n\n**CRITICAL - EXACT QUESTION TO RESUME**: After making the comparison, you MUST return to this EXACT question word-for-word: "${interruptedQuestion}"\n\nExample format: "Excellent comparison question! [comparison details]... Okay, now back to what I was asking: ${interruptedQuestion}"`
    : '';
  
  return `
You're Carson, and the student just asked: "${userMessage}"

This is a comparison question about ${topic}${subtopic ? ` (specifically ${subtopic})` : ''}.

Your response:
1. Make a clear, structured comparison
2. Highlight the key differences that matter clinically
3. Use a table or bullet points if helpful
4. Connect to practical implications${resumeInstructions}

Make comparisons clinically meaningful.
`.trim();
}

/**
 * Generate clarification prompt
 */
function generateClarificationPrompt(userMessage: string, context: PromptContext, interruptedQuestion?: string): string {
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  
  const resumeInstructions = interruptedQuestion 
    ? `\n\n**CRITICAL - EXACT QUESTION TO RESUME**: After clarifying, you MUST return to this EXACT question word-for-word: "${interruptedQuestion}"\n\nExample format: "Let me clarify that for you! [clarification]... So, going back to my question: ${interruptedQuestion}"`
    : '';
  
  return `
You're Carson, and the student just asked: "${userMessage}"

This is a clarification request about something you recently said or discussed.

**RECENT CONTEXT**: "${lastCarsonMessage.slice(-200)}..." 

Your response:
1. Acknowledge their need for clarification warmly
2. Re-explain the concept more clearly or from a different angle
3. Use simpler terms or better analogies
4. Check for understanding${resumeInstructions}

**TOPIC CONTEXT**: ${context.topic}${currentSubtopic ? ` - ${currentSubtopic.title}` : ''}

Be patient and thorough in your clarification.
`.trim();
}

/**
 * Generate example prompt
 */
function generateExamplePrompt(userMessage: string, topic: string, subtopic?: string, interruptedQuestion?: string): string {
  const resumeInstructions = interruptedQuestion 
    ? `\n\n**CRITICAL - EXACT QUESTION TO RESUME**: After providing the example, you MUST return to this EXACT question word-for-word: "${interruptedQuestion}"\n\nExample format: "Great request for an example! [clinical example]... Now, let's return to: ${interruptedQuestion}"`
    : '';
  
  return `
You're Carson, and the student just asked: "${userMessage}"

This is a request for an example related to ${topic}${subtopic ? ` (specifically ${subtopic})` : ''}.

Your response:
1. Provide a concrete, clinical example
2. Make it realistic and memorable
3. Connect the example back to the broader concept
4. Explain why this example illustrates the point well${resumeInstructions}

Make examples vivid and clinically relevant.
`.trim();
}

/**
 * Generate off-topic prompt
 */
function generateOffTopicPrompt(userMessage: string, topic: string): string {
  return `
You're Carson, and the student just asked: "${userMessage}"

This seems off-topic from our current discussion about ${topic}.

Your response:
1. Gently acknowledge their question without being dismissive
2. Redirect back to the medical topic at hand
3. Keep it brief and friendly

Example: "I'm not sure about [their question], but let's keep our focus on ${topic} - what else would you like to know about this?"

Stay warm but guide them back to learning.
`.trim();
}

/**
 * Generate default conversational prompt
 */
function generateDefaultConversationalPrompt(userMessage: string, context: PromptContext): string {
  return `
You're Carson, and the student said: "${userMessage}"

I'm not sure exactly what they're asking, so:

Your response:
1. **Ask for clarification** - "I want to make sure I understand..."
2. **Be helpful** - "Could you rephrase that?" or "What specifically would you like to know?"
3. **Stay engaged** - show you want to help them learn
4. **Keep it brief** - just get clarity on what they need

Don't guess what they meant - just ask them to clarify so you can help properly.
`.trim();
}

function generateUncertainAnswerPrompt(userMessage: string, context: PromptContext): string {
  const currentSubtopic = context.subtopics[context.currentSubtopicIndex];
  const lastCarsonMessage = context.history
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  // Extract the uncertain answer (remove question mark)
  const uncertainAnswer = userMessage.replace('?', '').trim();
  
  return `
You're Carson, and the student just gave an uncertain answer: "${userMessage}"

**CONTEXT**: 
- You asked: "${lastCarsonMessage}"
- They responded uncertainly: "${userMessage}"
- Current topic: ${context.topic}
- Current subtopic: ${currentSubtopic?.title || 'General discussion'}

**STUDENT PSYCHOLOGY**: This student is showing uncertainty/lack of confidence. They might be:
- Guessing but not sure
- Having the right instinct but doubting themselves
- Feeling intimidated by the complexity

**YOUR RESPONSE APPROACH**:
1. **Validate first**: "You're on the right track!" or "Good thinking!"
2. **Acknowledge their answer**: Reference what they said (even if tentative)
3. **Build confidence**: Explain why their thinking makes sense
4. **Expand gently**: Add context or ask a follow-up to build on their answer
5. **Keep encouraging tone**: This is about building confidence, not just correcting

**EXAMPLE STRUCTURE**:
"You're absolutely right! [Their answer] is indeed [validation]. [Brief explanation of why they're correct]. What makes you think that's particularly challenging/important/relevant?"

**AVOID**:
- Dismissing their uncertainty
- Making them feel wrong for being tentative
- Over-explaining (keep it encouraging, not overwhelming)

Be the attending who builds confidence while teaching.
`.trim();
} 