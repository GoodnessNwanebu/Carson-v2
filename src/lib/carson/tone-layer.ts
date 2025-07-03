// Tone Layer - Ensures Carson's consistent personality and voice
// This is crucial for maintaining authentic Carson interactions

import { ConversationStrategy, AssessmentResult } from './types';

export interface ToneContext {
  strategy: ConversationStrategy;
  assessment?: AssessmentResult;
  isFirstResponse?: boolean;
  isRemediation?: boolean;
  studentStruggling?: boolean;
}

export interface ToneValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  carsonScore: number; // 0-1 score of how "Carson-like" the response is
}

export class ToneLayer {
  
  /**
   * Apply Carson's personality and tone to any response
   * This is the main interface for ensuring consistent voice
   */
  static applyCarsonTone(
    rawResponse: string, 
    context?: ToneContext
  ): string {
    console.log('🎭 Applying Carson tone to response');
    
    try {
      // Step 1: Basic tone corrections
      let tonedResponse = this.applyBasicToneCorrections(rawResponse);
      
      // Step 2: Ensure Carson's questioning style
      tonedResponse = this.ensureQuestioningStyle(tonedResponse, context);
      
      // Step 3: Add Carson's characteristic phrases
      tonedResponse = this.addCarsonCharacteristics(tonedResponse, context);
      
      // Step 4: Ensure supportive language
      tonedResponse = this.ensureSupportiveLanguage(tonedResponse, context);
      
      // Step 5: Adjust formality level
      tonedResponse = this.adjustFormality(tonedResponse);
      
      // Step 6: Final validation and cleanup
      tonedResponse = this.finalCleanup(tonedResponse);
      
      console.log('✅ Tone application complete');
      return tonedResponse;
      
    } catch (error) {
      console.error('Tone application failed:', error);
      return this.applyFallbackTone(rawResponse);
    }
  }

  /**
   * Validate if a response matches Carson's tone and personality
   */
  static validateTone(response: string, context?: ToneContext): ToneValidation {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let carsonScore = 1.0;
    
    // Check for harsh or judgmental language
    const harshPatterns = [
      { pattern: /\b(wrong|incorrect|bad|terrible|awful|stupid|dumb)\b/gi, 
        issue: 'Contains harsh language', 
        suggestion: 'Use softer alternatives like "let\'s explore that" or "I\'m curious about"' },
      { pattern: /\byou (missed|forgot|failed|didn't)\b/gi, 
        issue: 'Accusatory language', 
        suggestion: 'Reframe as exploration: "What about..." or "Let\'s also consider..."' },
      { pattern: /\b(obviously|clearly|of course)\b/gi, 
        issue: 'Condescending language', 
        suggestion: 'Remove assumptions about what should be obvious' }
    ];
    
    harshPatterns.forEach(({ pattern, issue, suggestion }) => {
      if (pattern.test(response)) {
        issues.push(issue);
        suggestions.push(suggestion);
        carsonScore -= 0.2;
      }
    });
    
    // Check for Carson's questioning style
    const hasQuestions = /\?/.test(response);
    const hasCuriosity = /\b(curious|wonder|thinking|explore)\b/i.test(response);
    
    if (!hasQuestions && !hasCuriosity) {
      issues.push('Lacks Carson\'s questioning/curious style');
      suggestions.push('Add questions or phrases like "I\'m curious..." or "What do you think about..."');
      carsonScore -= 0.3;
    }
    
    // Check for appropriate length (Carson doesn't lecture)
    if (response.length > 500) {
      issues.push('Response too long - Carson keeps things conversational');
      suggestions.push('Break into shorter, more digestible pieces with questions');
      carsonScore -= 0.2;
    }
    
    // Check for supportive acknowledgment
    const hasAcknowledgment = /\b(good|great|excellent|interesting|helpful|nice)\b/i.test(response);
    if (!hasAcknowledgment && context?.assessment?.status !== 'incorrect') {
      issues.push('Missing positive acknowledgment');
      suggestions.push('Start with acknowledgment of what the student got right');
      carsonScore -= 0.1;
    }
    
    // Ensure score doesn't go below 0
    carsonScore = Math.max(0, carsonScore);
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      carsonScore
    };
  }

  /**
   * Apply basic tone corrections (remove harsh language)
   */
  private static applyBasicToneCorrections(response: string): string {
    const corrections = [
      // Replace harsh direct corrections
      { from: /\byou're wrong\b/gi, to: "let's explore that further" },
      { from: /\bthat's incorrect\b/gi, to: "I'm curious about your thinking there" },
      { from: /\byou missed\b/gi, to: "let's also consider" },
      { from: /\byou forgot\b/gi, to: "what about" },
      { from: /\byou failed to\b/gi, to: "we haven't yet discussed" },
      { from: /\byou didn't mention\b/gi, to: "I wonder about" },
      
      // Replace lecturing language
      { from: /\bobviously\b/gi, to: "" },
      { from: /\bclearly\b/gi, to: "" },
      { from: /\bof course\b/gi, to: "" },
      { from: /\byou should know\b/gi, to: "it's worth considering" },
      { from: /\byou need to understand\b/gi, to: "let's explore" },
      
      // Replace absolute statements
      { from: /\balways remember\b/gi, to: "it's helpful to think about" },
      { from: /\bnever forget\b/gi, to: "keep in mind" },
      { from: /\byou must\b/gi, to: "it would be good to" }
    ];
    
    let correctedResponse = response;
    corrections.forEach(({ from, to }) => {
      correctedResponse = correctedResponse.replace(from, to);
    });
    
    return correctedResponse;
  }

  /**
   * Ensure response includes Carson's questioning style
   */
  private static ensureQuestioningStyle(
    response: string, 
    context?: ToneContext
  ): string {
    
    // If response already has questions, it's probably fine
    if (/\?/.test(response)) {
      return response;
    }
    
    // Add appropriate questioning based on context
    const questionStarters = [
      "I'm curious",
      "What do you think about",
      "How would you approach",
      "What comes to mind when",
      "I wonder"
    ];
    
    // For remediation, use gentler questions
    if (context?.isRemediation || context?.studentStruggling) {
      const gentleQuestions = [
        " What's your thinking on that?",
        " How does that sound to you?",
        " What are your thoughts?",
        " Does that make sense?"
      ];
      
      return response + gentleQuestions[Math.floor(Math.random() * gentleQuestions.length)];
    }
    
    return response;
  }

  /**
   * Add Carson's characteristic phrases and expressions
   */
  private static addCarsonCharacteristics(
    response: string, 
    context?: ToneContext
  ): string {
    
    // Carson's characteristic phrases
    const carsonPhrases = {
      curiosity: ["I'm curious", "I wonder", "What's your sense of", "Help me understand"],
      encouragement: ["That's a good start", "I like your thinking", "Interesting perspective"],
      exploration: ["Let's explore", "Let's dig into", "Let's think about", "Consider"],
      acknowledgment: ["I hear you saying", "You're touching on", "You've identified"]
    };
    
    // Add opening acknowledgment if appropriate
    if (context?.assessment?.status === 'partial' || context?.assessment?.status === 'correct') {
      const acknowledgments = carsonPhrases.acknowledgment;
      const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
      
      // Only add if response doesn't already start with acknowledgment
      if (!/^(good|great|excellent|interesting|nice|i see|i hear)/i.test(response.trim())) {
        response = `${randomAck} some important points. ${response}`;
      }
    }
    
    return response;
  }

  /**
   * Ensure language is supportive and non-judgmental
   */
  private static ensureSupportiveLanguage(
    response: string, 
    context?: ToneContext
  ): string {
    
    // Add supportive framing for difficult concepts
    if (context?.isRemediation) {
      const supportivePrefixes = [
        "This can be tricky to think through, so let's",
        "These concepts can be complex, so",
        "This is a nuanced topic, so let's",
        "No worries if this feels complicated -"
      ];
      
      // Add supportive framing if response seems direct
      if (response.startsWith("Let's") || response.startsWith("Consider")) {
        const prefix = supportivePrefixes[Math.floor(Math.random() * supportivePrefixes.length)];
        response = response.replace(/^(Let's|Consider)/, prefix.toLowerCase());
      }
    }
    
    return response;
  }

  /**
   * Adjust formality level to match Carson's conversational style
   */
  private static adjustFormality(response: string): string {
    const formalityAdjustments = [
      // Make contractions more natural
      { from: /\bdo not\b/g, to: "don't" },
      { from: /\bcannot\b/g, to: "can't" },
      { from: /\bwill not\b/g, to: "won't" },
      { from: /\bI would\b/g, to: "I'd" },
      { from: /\blet us\b/g, to: "let's" },
      
      // Soften medical jargon when appropriate
      { from: /\bpatient presents with\b/gi, to: "patient has" },
      { from: /\bupon examination\b/gi, to: "when we examine" },
      { from: /\bin order to\b/gi, to: "to" }
    ];
    
    let adjustedResponse = response;
    formalityAdjustments.forEach(({ from, to }) => {
      adjustedResponse = adjustedResponse.replace(from, to);
    });
    
    return adjustedResponse;
  }

  /**
   * Final cleanup and formatting
   */
  private static finalCleanup(response: string): string {
    // Remove double spaces and fix punctuation
    let cleaned = response
      .replace(/\s+/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/\s+,/g, ',')
      .replace(/\s+\?/g, '?')
      .replace(/\s+!/g, '!')
      .trim();
    
    // Ensure proper capitalization after periods
    cleaned = cleaned.replace(/\.\s+([a-z])/g, (match, letter) => 
      '. ' + letter.toUpperCase()
    );
    
    // Ensure response ends with proper punctuation
    if (!/[.!?]$/.test(cleaned)) {
      // Add question mark if it seems like a question
      if (/\b(what|how|why|where|when|which|who|could|would|should|can|will|do|does|did|is|are|was|were)\b/i.test(cleaned.split(' ').slice(-5).join(' '))) {
        cleaned += '?';
      } else {
        cleaned += '.';
      }
    }
    
    return cleaned;
  }

  /**
   * Apply fallback tone when main processing fails
   */
  private static applyFallbackTone(response: string): string {
    // Very basic fallback - just remove obvious harsh language
    return response
      .replace(/wrong/gi, 'different')
      .replace(/incorrect/gi, 'not quite what I was thinking')
      .replace(/you missed/gi, 'let\'s also consider')
      .replace(/you forgot/gi, 'what about');
  }

  /**
   * Get tone suggestions for different contexts
   */
  static getToneSuggestions(context: ToneContext): string[] {
    const suggestions: string[] = [];
    
    if (context.isFirstResponse) {
      suggestions.push('Start with warm acknowledgment');
      suggestions.push('Express genuine curiosity about their thinking');
      suggestions.push('Set a collaborative tone');
    }
    
    if (context.isRemediation) {
      suggestions.push('Be extra supportive and patient');
      suggestions.push('Normalize the difficulty of the concept');
      suggestions.push('Use "let\'s" language for collaboration');
    }
    
    if (context.studentStruggling) {
      suggestions.push('Acknowledge their effort');
      suggestions.push('Break down concepts into smaller pieces');
      suggestions.push('Use encouraging language');
    }
    
    if (context.strategy.action === 'transition') {
      suggestions.push('Celebrate their understanding');
      suggestions.push('Create smooth bridge to next topic');
      suggestions.push('Maintain momentum and enthusiasm');
    }
    
    return suggestions;
  }

  /**
   * Enhanced tone application for specific conversation strategies
   */
  static applyStrategySpecificTone(
    response: string,
    strategy: ConversationStrategy,
    assessment?: AssessmentResult
  ): string {
    
    const context: ToneContext = {
      strategy,
      assessment,
      isRemediation: strategy.action === 'remediate',
      studentStruggling: assessment?.confidence !== undefined && assessment.confidence < 0.4
    };
    
    return this.applyCarsonTone(response, context);
  }
} 