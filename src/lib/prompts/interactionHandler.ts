import { CarsonSessionContext } from './carsonTypes';

/**
 * Interaction Classification and Handling
 * Sophisticated detection of different types of student interactions
 */

export type InteractionType = 
  | 'medical_response'      // Normal learning/assessment
  | 'emotional_support'     // Student frustrated/stressed
  | 'off_topic'            // Questions outside current topic
  | 'personal_casual'      // Personal questions about Carson
  | 'medical_advice'       // Seeking personal medical advice
  | 'challenge_authority'  // Disagreeing with Carson
  | 'meta_learning'        // Study strategies/exam questions
  | 'give_up'             // Avoidance/wanting to quit
  | 'technical_issue'     // Platform/technical problems
  | 'conversational'      // General conversational responses

export interface InteractionClassification {
  type: InteractionType;
  confidence: number;
  suggestedResponse?: string;
  requiresAssessment: boolean;
}

/**
 * Classify student interaction type before assessment
 */
export function classifyInteraction(
  userResponse: string, 
  context: CarsonSessionContext
): InteractionClassification {
  const response = userResponse.toLowerCase().trim();
  
  // Emotional/Frustrated responses
  const emotionalPatterns = [
    /^(this is (too )?hard|i can'?t do this|i'?m (so )?confused)/,
    /^(i hate|i don'?t like|this sucks|this is boring)/,
    /^(i'?m (so )?(stressed|frustrated|overwhelmed))/,
    /^(i feel (so )?(stupid|dumb|lost))/,
    /^(i'?m never going to|i can'?t understand)/,
    /^(i give up|i quit|i'?m done)/
  ];
  
  if (emotionalPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'emotional_support',
      confidence: 0.9,
      requiresAssessment: false,
      suggestedResponse: generateConfusionSupport(response, context.topic, context.subtopics[context.currentSubtopicIndex]?.title)
    };
  }
  
  // Give up/Avoidance
  const giveUpPatterns = [
    /^(let'?s skip|can we skip|i don'?t want to)/,
    /^(this is boring|can we do something else)/,
    /^(i'?m done|let'?s move on|next topic)/
  ];
  
  if (giveUpPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'give_up',
      confidence: 0.8,
      requiresAssessment: false,
      suggestedResponse: generateMotivationalResponse(context)
    };
  }
  
  // Personal/Casual questions
  const personalPatterns = [
    /^(are you|what'?s your|how'?s your|do you have)/,
    /^(are you a real doctor|what'?s your background)/,
    /^(how are you|good morning|hello)/,
    /^(nice to meet you|thanks for helping)/
  ];
  
  if (personalPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'personal_casual',
      confidence: 0.7,
      requiresAssessment: false,
      suggestedResponse: generatePersonalResponse()
    };
  }
  
  // Medical advice seeking
  const advicePatterns = [
    /^(i have|my symptoms|should i take|can you diagnose)/,
    /^(what should i do|is this normal|am i)/,
    /^(i'?m experiencing|i feel|my doctor said)/
  ];
  
  if (advicePatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'medical_advice',
      confidence: 0.9,
      requiresAssessment: false,
      suggestedResponse: generateBoundaryResponse()
    };
  }
  
  // Challenge authority
  const challengePatterns = [
    /^(i think you'?re wrong|that'?s not right|my professor said)/,
    /^(i disagree|that'?s incorrect|my textbook says)/,
    /^(are you sure|i don'?t think so)/
  ];
  
  if (challengePatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'challenge_authority',
      confidence: 0.8,
      requiresAssessment: false,
      suggestedResponse: generateAuthorityResponse()
    };
  }
  
  // Meta-learning questions
  const metaPatterns = [
    /^(how should i study|what'?s the best way|will this be on)/,
    /^(how long will|when will|should i memorize)/,
    /^(study tips|any advice|how do i remember)/
  ];
  
  if (metaPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'meta_learning',
      confidence: 0.8,
      requiresAssessment: false,
      suggestedResponse: generateMetaLearningResponse(context)
    };
  }
  
  // Technical issues
  const technicalPatterns = [
    /^(my voice|the app|i can'?t see|it'?s not working)/,
    /^(technical|sound|audio|screen)/,
    /^(slow|loading|crashed)/
  ];
  
  if (technicalPatterns.some(pattern => pattern.test(response))) {
    return {
      type: 'technical_issue',
      confidence: 0.9,
      requiresAssessment: false,
      suggestedResponse: generateTechnicalResponse()
    };
  }
  
  // Off-topic medical questions
  if (isOffTopicMedical(response, context.topic)) {
    return {
      type: 'off_topic',
      confidence: 0.7,
      requiresAssessment: false,
      suggestedResponse: generateRedirectionResponse(context)
    };
  }
  
  // Default to medical response if none match
  return {
    type: 'medical_response',
    confidence: 0.6,
    requiresAssessment: true
  };
}

/**
 * Check if response is conversational rather than medical
 */
export function isConversationalResponse(userResponse: string, lastCarsonMessage?: string): boolean {
  const response = userResponse.toLowerCase().trim();
  const carsonMessage = lastCarsonMessage?.toLowerCase() || '';
  
  // If Carson just asked if they're ready, treat confirmations as conversational
  const isReadinessQuestion = carsonMessage.includes('ready') || 
                             carsonMessage.includes('shall we') || 
                             carsonMessage.includes('let\'s') ||
                             carsonMessage.includes('begin') ||
                             carsonMessage.includes('start');
  
  // Readiness confirmations - only if Carson asked about readiness
  const readinessPatterns = [
    /^(yes|yeah|yep|sure|okay|ok|alright|ready)/,
    /ready/,
    /(let'?s go|let'?s start|let'?s begin)/,
    /^(i'?m ready|am ready)/
  ];
  
  if (isReadinessQuestion) {
    const isReadinessResponse = readinessPatterns.some(pattern => pattern.test(response));
    if (isReadinessResponse) return true;
  }
  
  // Clarification and context requests - these are conversational, not medical answers
  const clarificationPatterns = [
    /^(what|how|when|where|why)\s/,
    /^(can you|could you|please)/,
    /^(sorry|excuse me)/,
    // Context and scope questions
    /in the context of/,
    /about (.*?)\?$/,
    /related to/,
    /specifically/,
    /you mean/,
    /are you asking/,
    /do you want me to/
  ];
  
  // Help requests that aren't struggling
  const isHelpRequest = /^(help|explain|clarify)/.test(response) && !isStruggling(userResponse);
  
  // Very short responses without medical context (but not struggling responses)
  const isVeryShort = response.length < 6 && !isStruggling(userResponse);
  
  return clarificationPatterns.some(pattern => pattern.test(response)) || isHelpRequest || isVeryShort;
}

/**
 * Check if user response indicates struggling
 */
export function isStruggling(userResponse: string): boolean {
  const response = userResponse.toLowerCase().trim();
  
  // Explicit struggling statements
  const directStruggling = [
    /^(i don'?t know|not sure|no idea|unsure|i'?m not sure)/,
    /^(confused|lost|stuck)/,
    /^(help|i need help)/,
    /don'?t understand/,
    /not following/,
    /makes no sense/,
    /too hard/,
    /difficult/
  ];
  
  // Deflection patterns - trying to avoid answering
  const deflectionPatterns = [
    /^(can you give me a hint|hint|clue)/,
    /^(what do you think|what would you say)/,
    /^(i'?m not sure, but|maybe|perhaps)/,
    /^(could it be|is it|might it be)/,
    /^(i think it might|it could be|possibly)/
  ];
  
  // Vague/evasive answers that indicate lack of knowledge
  const vaguePatterns = [
    /^(it'?s related to|something about|has to do with)/,
    /^(the|a|some)\s+\w+$/,  // Very short, generic answers like "the kidney"
    /^(um|uh|well|so)/,      // Filler words indicating uncertainty
    /^(i think|i believe|i guess)/,
  ];
  
  // Question reversals - fishing for answers
  const fishingPatterns = [
    /\?$/,                   // Ends with question mark (answering with a question)
    /^(is it|does it|can it|would it)/,
    /right\?$/,              // "It's prerenal, right?"
    /correct\?$/
  ];
  
  // Very short responses (often indicate confusion)
  const isTooShort = response.length < 8 && !/^(yes|no|yeah|nope)$/.test(response);
  
  return directStruggling.some(pattern => pattern.test(response)) ||
         deflectionPatterns.some(pattern => pattern.test(response)) ||
         vaguePatterns.some(pattern => pattern.test(response)) ||
         fishingPatterns.some(pattern => pattern.test(response)) ||
         isTooShort;
}

// Helper functions for generating responses
function generateConfusionSupport(userResponse: string, topic: string, subtopic?: string): string {
  const response = userResponse.toLowerCase().trim();
  
  let supportType = 'general';
  
  // Direct struggling - lowest confidence, needs most support
  if (/^(i don'?t know|not sure|no idea|unsure|i'?m not sure)/.test(response) ||
      /^(confused|lost|stuck)/.test(response) ||
      /don'?t understand|not following|makes no sense/.test(response)) {
    supportType = 'completely_lost';
  }
  // Deflection patterns - partial knowledge, seeking help
  else if (/^(can you give me a hint|hint|clue)/.test(response) ||
           /^(help|i need help)/.test(response)) {
    supportType = 'needs_guidance';
  }
  // Fishing patterns - has some knowledge, seeking validation
  else if (/\?$/.test(response) || // Ends with question mark
           /^(is it|could it be|might it be|does it|can it|would it)/.test(response) ||
           /right\?$|correct\?$/.test(response)) {
    supportType = 'seeking_validation';
  }
  // Uncertainty markers - partial knowledge but unsure
  else if (/^(i'?m not sure, but|maybe|perhaps)/.test(response) ||
           /^(i think it might|it could be|possibly)/.test(response) ||
           /^(i think|i believe|i guess)/.test(response)) {
    supportType = 'uncertain_knowledge';
  }
  // Vague responses - some understanding but lack specifics
  else if (/^(it'?s related to|something about|has to do with)/.test(response) ||
           /^(the|a|some)\s+\w+$/.test(response) ||
           /^(um|uh|well|so)/.test(response)) {
    supportType = 'vague_knowledge';
  }
  // Very short responses - likely confused
  else if (response.length < 8 && !/^(yes|no|yeah|nope)$/.test(response)) {
    supportType = 'minimal_response';
  }
  
  const supportResponses = {
    completely_lost: [
      `Totally fair - ${subtopic || topic} is genuinely complex stuff. No one expects you to just know this.`,
      `Good to be honest about it. ${subtopic || topic} trips up a lot of people initially.`,
      `Yeah, ${subtopic || topic} isn't intuitive. Let me walk you through it.`
    ],
    
    seeking_validation: [
      `You're thinking about it the right way. That's exactly how you should approach ${subtopic || topic}.`,
      `Good instinct with that question. You're working through ${subtopic || topic} logically.`,
      `Right approach - asking the right questions about ${subtopic || topic}.`
    ],
    
    uncertain_knowledge: [
      `You're in the right ballpark with ${subtopic || topic}. Let me help you pin it down.`,
      `Close - you've got pieces of ${subtopic || topic} but let me fill in the gaps.`,
      `You're thinking about ${subtopic || topic} correctly, just need to connect the dots.`
    ],
    
    needs_guidance: [
      `Sure. So with ${subtopic || topic}, the key thing to remember is this.`,
      `Absolutely. Here's how I think about ${subtopic || topic}.`,
      `Of course. ${subtopic || topic} basically works like this.`
    ],
    
    vague_knowledge: [
      `Right general area. Now let's get specific about how ${subtopic || topic} actually works.`,
      `Good connection. Let me help you get more precise about ${subtopic || topic}.`,
      `You've got the broad concept. Now for the specifics of ${subtopic || topic}.`
    ],
    
    minimal_response: [
      `No problem. ${subtopic || topic} can be a lot to process at first.`,
      `Fair enough. Let me give you the key points about ${subtopic || topic}.`,
      `All good. Here's what you need to know about ${subtopic || topic}.`
    ],
    
    general: [
      `Alright, so ${subtopic || topic} is basically this.`,
      `Okay, let me explain ${subtopic || topic}.`,
      `Right, so here's how ${subtopic || topic} works.`
    ]
  };
  
  const responses = supportResponses[supportType as keyof typeof supportResponses];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateMotivationalResponse(context: CarsonSessionContext): string {
  const currentTopic = context.topic || "this topic";
  return `Look, ${currentTopic} can definitely feel like a lot at first. But here's the thing - you've already shown you understand some key concepts. Want to try a different angle? Maybe we can look at this through a real case that shows why this stuff actually matters.`;
}

function generatePersonalResponse(): string {
  const responses = [
    "I'm Carson - just an AI that's been trained to think like a doctor. Not actually human, but I've been designed to help you work through medical concepts the way a good attending would.",
    "Thanks for asking! I'm an AI, but I've been built to approach medical education like a real physician mentor would. My goal is helping you think through cases and concepts.",
    "I'm Carson - an AI designed to work with medical students. While I'm not human, I try to approach teaching the way good doctors do - direct, honest, and focused on helping you understand."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateBoundaryResponse(): string {
  return "I can't give you personal medical advice - that's not what I'm here for. I'm designed for medical education and learning. If you've got health concerns, definitely talk to a real doctor. But I'm happy to help you understand medical concepts and work through cases!";
}

function generateAuthorityResponse(): string {
  const responses = [
    "Fair point - medicine definitely has areas where sources disagree or approaches differ. What specifically did your professor say? Let's compare the different perspectives and see where they align or diverge.",
    "Good that you're thinking critically about this. Different sources sometimes emphasize different aspects. Tell me more about what you heard elsewhere - let's work through the differences.",
    "Interesting - that's actually a good sign that you're engaging with multiple sources. What was the alternative take? Medicine often has nuances worth exploring."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateMetaLearningResponse(context: CarsonSessionContext): string {
  const responses = [
    "Good question about study approach. For this kind of material, I'd focus on understanding mechanisms first, then building up to applications. Active recall - testing yourself rather than just reading - tends to stick better. What's been working for you so far?",
    "Smart to think about learning strategy. For medical topics, connecting to real cases usually helps retention. Also, trying to explain concepts to someone else is a great test of understanding. Want to try that approach with what we're covering?",
    "That's actually really important to think about. For complex medical concepts, building frameworks first, then adding details, usually works well. We can practice that approach together as we go through this."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateTechnicalResponse(): string {
  return "Sorry you're having tech issues. Try refreshing or checking your connection if things aren't working smoothly. Voice not working? No problem - just type. The important thing is we can keep going with whatever works best for you.";
}

function generateRedirectionResponse(context: CarsonSessionContext): string {
  const currentTopic = context.topic || "our current topic";
  return `Interesting question, and I can see how that connects to medical thinking. Right now we're working through ${currentTopic}, and I want to make sure you really get this before we move on. Once we've got a solid foundation here, we can definitely explore other areas. Sound good?`;
}

function isOffTopicMedical(response: string, currentTopic?: string): boolean {
  if (!currentTopic) return false;
  
  const medicalTerms = ['diagnosis', 'treatment', 'symptom', 'disease', 'condition', 'patient', 'clinical'];
  const containsMedicalTerms = medicalTerms.some(term => response.includes(term));
  const mentionsCurrentTopic = currentTopic.split(' ').some(word => 
    response.toLowerCase().includes(word.toLowerCase())
  );
  
  return containsMedicalTerms && !mentionsCurrentTopic && response.length > 20;
} 