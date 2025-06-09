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
    currentQuestionType: context.currentQuestionType || 'follow_up',
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

They've been through all the subtopics. Before wrapping up, see if they can:
1. Synthesize: "How would you explain ${safeContext.topic} to a medical student in 2-3 minutes?"
2. Apply: "Walk me through your approach to a complex ${safeContext.topic} case"
3. Self-reflect: "What aspect of ${safeContext.topic} do you feel most confident about? Least confident?"

Only after they show they can synthesize and apply should you acknowledge they've got it.

Keep it natural - you're a doctor checking if a student really knows their stuff.
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
        // Present gaps and offer remediation
        const attemptNumber = (gapAnalysis.remediationAttempts || 0) + 1;
        const tryDifferentApproach = attemptNumber > 1 ? "\n**NOTE**: This is attempt #" + attemptNumber + " - try a different explanation approach (analogy, example, simpler terms)." : "";
        
        return `
You're Carson, a knowledge guide who identifies and helps fill learning gaps.

GAPS IDENTIFIED in ${currentSubtopic.title}:
${gapAnalysis.gaps.map(gap => `• ${gap}`).join('\n')}

Your approach:
1. "I noticed you're still unclear about ${gapAnalysis.primaryGap}. This is important for understanding ${safeContext.topic}."
2. Provide a clear, focused explanation of the gap
3. **CRITICAL**: End with a simple confirmation question: "Do you understand this now?" or "Does that make sense?"
4. If they say yes/confirm understanding → transition to next subtopic immediately
5. If they're still confused → try a different explanation approach

**REMEDIATION LIMIT**: Maximum 2 explanation attempts per gap. After that, acknowledge the gap and move on.${tryDifferentApproach}

Keep it supportive - you're helping them identify what they need to master.
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
Excellent! They've filled the gaps in ${currentSubtopic.title}. 

Assessment shows:
- Understanding improved (confidence: ${gapAnalysis.confidenceScore}%)
- No significant gaps remaining
- Ready for progression

AUTOMATIC TRANSITION: Move to next subtopic with smooth transition.
Use: "Great - you've got ${currentSubtopic.title} down now. Let's move on to [next topic]."
Then immediately ask about the next subtopic.

No additional checking needed - they've demonstrated understanding.`;
    }
    
    // Still have gaps after explanation - need verification questions
    if (gapAnalysis.hasSignificantGaps) {
      return `
They still have gaps after your explanation of ${currentSubtopic.title}.

Remaining gaps: ${gapAnalysis.gaps.join(', ')}

Your approach:
1. Ask a targeted question to check if they understood your explanation
2. Focus on the main gap: "${gapAnalysis.primaryGap}"
3. If they get it right, move forward
4. If still struggling, try a different explanation approach

Don't repeat the same explanation - try a new angle or simpler example.`;
    }
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
          return `They're confused about ${currentSubtopic.title}. Be gentle and supportive. Break it down to the basics.`;
        } else if (isBasicTopic) {
          return `They understand ${currentSubtopic.title} but make sure they can explain it clearly. Even good students need to nail the fundamentals.`;
        } else {
          return `They're getting ${currentSubtopic.title}. You can ask something a bit more challenging, but don't skip essential pieces.`;
        }
        
      case 'explain_and_continue':
        // **ENHANCED**: Set up for post-remediation checking
        if (isBasicTopic) {
          return `They missed something fundamental about ${currentSubtopic.title}. Explain the basics clearly, then ask a follow-up question to verify they understood your explanation.`;
        } else {
          return `They need help with ${currentSubtopic.title}. Explain what they missed, then ask a verification question to ensure the gap is filled.`;
        }
        
      case 'explain_thoroughly':
        return `They really don't understand ${currentSubtopic.title}. Give a clear explanation focusing on the essentials. Follow up with a simple question to check comprehension.`;
        
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
  
  // Extract gaps from existing assessment data
  const gaps: string[] = [];
  
  if (hasSpecificGaps && !qualityImprovement) {
    gaps.push(lastAssessment.specificGaps!);
  }
  
  if (isStruggling && !qualityImprovement) {
    gaps.push(`fundamental understanding of ${currentSubtopic.title}`);
  }
  
  if (needsExplanation && !qualityImprovement) {
    gaps.push(`clear explanation of ${currentSubtopic.title} concepts`);
  }
  
  // Default gap if none identified but assessment suggests issues
  if (gaps.length === 0 && (lastAssessment.answerQuality === 'partial' || lastAssessment.answerQuality === 'unclear') && !qualityImprovement) {
    gaps.push(`complete understanding of ${currentSubtopic.title}`);
  }
  
  const primaryGap = gaps.length > 0 ? gaps[0] : `understanding of ${currentSubtopic.title}`;
  
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
    hasSignificantGaps,
    gaps,
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

function getExpectedConcepts(subtopic: string, topic: string): string[] {
  // Return expected concepts based on subtopic and topic
  // This is a simplified version - could be expanded with more sophisticated mapping
  const conceptMap: Record<string, string[]> = {
    'pathophysiology': ['mechanism', 'process', 'cellular changes', 'physiological impact'],
    'diagnosis': ['signs', 'symptoms', 'diagnostic criteria', 'differential diagnosis'],
    'management': ['treatment options', 'medications', 'interventions', 'monitoring'],
    'complications': ['potential risks', 'adverse outcomes', 'prevention strategies'],
    'prognosis': ['outcomes', 'recovery timeline', 'prognostic factors']
  };
  
  const subtopicLower = subtopic.toLowerCase();
  for (const [key, concepts] of Object.entries(conceptMap)) {
    if (subtopicLower.includes(key)) {
      return concepts;
    }
  }
  
  return ['basic understanding', 'clinical relevance', 'key principles'];
} 