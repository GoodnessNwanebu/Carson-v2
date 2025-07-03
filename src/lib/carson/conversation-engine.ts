// Conversation Engine - Single LLM call with comprehensive context
// Generates Carson's responses based on assessment, gaps, and strategy

import { 
  ConversationContext, 
  ConversationStrategy, 
  AssessmentResult, 
  Gap,
  SessionContext
} from './types';
import { ToneLayer } from './tone-layer';

export class ConversationEngine {
  
  /**
   * Generate Carson's response using comprehensive context
   * Single LLM call with all necessary information
   */
  static async generateResponse(context: ConversationContext): Promise<string> {
    console.log(`💬 Generating Carson response for strategy: ${context.strategy.action}`);
    
    try {
      // Build comprehensive prompt with all context
      const prompt = this.buildConversationPrompt(context);
      
      // Make single LLM call
      const response = await this.callLLMForConversation(prompt);
      
      // Apply sophisticated Carson tone using ToneLayer
      const finalResponse = ToneLayer.applyStrategySpecificTone(
        response, 
        context.strategy, 
        context.assessment
      );
      
      console.log(`✅ Response generated (${finalResponse.length} chars)`);
      
      return finalResponse;
      
    } catch (error) {
      console.error('Response generation failed:', error);
      
      // Try to apply Carson tone to fallback response
      const fallbackResponse = this.createFallbackResponse(context);
      
      try {
        return ToneLayer.applyCarsonTone(fallbackResponse);
      } catch (toneError) {
        console.error('Tone application also failed:', toneError);
        return this.applyFallbackTone(fallbackResponse);
      }
    }
  }

  /**
   * Build comprehensive conversation prompt with all context
   */
  private static buildConversationPrompt(context: ConversationContext): string {
    const { sessionContext, currentTurn, assessment, strategy, gaps } = context;
    
    // Recent conversation history for context
    const recentHistory = sessionContext.conversationHistory
      .slice(-5) // Last 5 turns
      .map(turn => `${turn.role}: ${turn.content}`)
      .join('\n');
    
    // Current subtopic info
    const currentSubtopic = sessionContext.subtopics.find(
      s => s.id === sessionContext.currentSubtopic
    );
    
    // Gap stack information
    const gapStackInfo = this.formatGapStackInfo(sessionContext);
    
    // Strategy-specific instructions
    const strategyInstructions = this.getStrategyInstructions(strategy, gaps);
    
    return `You are Carson, a calm, curious, and supportive medical educator. You help students learn through guided discovery rather than lecturing.

CURRENT CONTEXT:
Topic: ${sessionContext.topic}
Subtopic: ${currentSubtopic?.title || 'Unknown'}
Current Focus: ${sessionContext.gapStack.currentFocus || 'General discussion'}

RECENT CONVERSATION:
${recentHistory}

STUDENT'S LATEST MESSAGE:
"${currentTurn.content}"

ASSESSMENT OF STUDENT'S RESPONSE:
Status: ${assessment.status}
Concepts Identified: ${assessment.conceptsIdentified.join(', ') || 'None'}
Concepts Correct: ${assessment.conceptsCorrect.join(', ') || 'None'}
Concepts Missing: ${assessment.conceptsMissing.join(', ') || 'None'}
Confidence: ${assessment.confidence}
Reasoning: ${assessment.reasoning}

GAP STACK STATUS:
${gapStackInfo}

CONVERSATION STRATEGY:
${strategyInstructions}

CARSON'S PERSONALITY GUIDELINES:
- Be genuinely curious about the student's thinking
- Ask follow-up questions to deepen understanding
- Acknowledge what they got right before addressing gaps
- Use "I'm curious..." or "What do you think about..." to explore concepts
- Never make the student feel judged or inadequate
- Guide discovery rather than directly providing answers
- Use clinical examples when helpful
- Keep responses conversational, not lecture-like

Generate Carson's response:`;
  }

  /**
   * Format gap stack information for prompt
   */
  private static formatGapStackInfo(sessionContext: SessionContext): string {
    const { gapStack } = sessionContext;
    const primaryGapsArray = Array.from(gapStack.primaryGaps);
    const completedArray = Array.from(gapStack.completedConcepts);
    
    return `
Primary Gaps Remaining: ${primaryGapsArray.join(', ') || 'None'}
Completed Concepts: ${completedArray.join(', ') || 'None'}
Current Focus: ${gapStack.currentFocus || 'None'}
Completion: ${completedArray.length}/${primaryGapsArray.length + completedArray.length} concepts`;
  }

  /**
   * Get strategy-specific instructions for the LLM
   */
  private static getStrategyInstructions(
    strategy: ConversationStrategy,
    gaps: Gap[]
  ): string {
    
    switch (strategy.action) {
      case 'continue':
        return `Continue exploring the topic. ${strategy.focus ? 
          `Focus the conversation towards: ${strategy.focus}` : 
          'Guide the student to explore missing concepts naturally.'
        }`;
        
      case 'remediate':
        const remediationInstructions = this.getRemediationInstructions(strategy.remediationType);
        return `Remediate understanding of: ${strategy.focus}
        ${remediationInstructions}`;
        
      case 'transition':
        return `The student has demonstrated good understanding of this subtopic. 
        Transition smoothly to: ${strategy.nextSubtopic || 'the next topic'}
        Summarize what they've learned well before moving forward.`;
        
      case 'acknowledge_curiosity':
        return `The student asked about something off-topic. 
        Briefly acknowledge their curiosity, provide a short answer if appropriate, 
        then guide them back to the current subtopic.`;
        
      default:
        return 'Continue the educational conversation naturally.';
    }
  }

  /**
   * Get specific instructions for different remediation types
   */
  private static getRemediationInstructions(
    remediationType?: 'analogy' | 'step-by-step' | 'clinical-example' | 'simplify'
  ): string {
    
    switch (remediationType) {
      case 'analogy':
        return 'Use an analogy or metaphor to help explain the concept.';
      case 'step-by-step':
        return 'Break down the concept into smaller, logical steps.';
      case 'clinical-example':
        return 'Use a relevant clinical example or case to illustrate the concept.';
      case 'simplify':
        return 'Simplify the explanation and use more basic terms.';
      default:
        return 'Help the student understand the concept through guided questions.';
    }
  }

  /**
   * Call LLM for conversation generation (simplified implementation)
   */
  private static async callLLMForConversation(prompt: string): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response - in real implementation, this would be your LLM service
    return `That's a good start! I can see you've identified some important risk factors like hypertension and diabetes. 

I'm curious - when you think about pregnancy-related risk factors, what comes to mind? For instance, has the patient had any previous pregnancies, and if so, how did those go?

Understanding a patient's obstetric history can reveal some crucial risk factors that we haven't discussed yet.`;
  }

  /**
   * Apply basic fallback tone when ToneLayer fails
   * This is a simplified backup to ensure responses are never harsh
   */
  private static applyFallbackTone(response: string): string {
    // Basic fallback - just remove obvious harsh language
    const toneChecks = [
      { bad: /you're wrong/gi, good: "let's explore that further" },
      { bad: /that's incorrect/gi, good: "I'm curious about your thinking there" },
      { bad: /you missed/gi, good: "let's also consider" },
      { bad: /you forgot/gi, good: "what about" }
    ];
    
    let tonedResponse = response;
    toneChecks.forEach(check => {
      tonedResponse = tonedResponse.replace(check.bad, check.good);
    });
    
    return tonedResponse;
  }

  /**
   * Create fallback response when LLM fails
   */
  private static createFallbackResponse(context: ConversationContext): string {
    const { strategy, assessment } = context;
    
    // Simple fallback based on strategy
    switch (strategy.action) {
      case 'continue':
        return "That's interesting! Can you tell me more about your thinking on this topic?";
      case 'remediate':
        return `I'd like to explore ${strategy.focus} a bit more. What do you think about that concept?`;
      case 'transition':
        return "You've shown good understanding here. Let's move on to the next aspect of this topic.";
      default:
        return "Can you help me understand your thinking a bit better?";
    }
  }

  /**
   * Validate generated response for quality
   */
  static validateResponse(response: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (response.length < 20) {
      issues.push('Response too short');
    }
    
    if (response.length > 500) {
      issues.push('Response too long');
    }
    
    if (!response.includes('?') && !response.includes('curious')) {
      issues.push('Response lacks Carson\'s questioning style');
    }
    
    // Check for harsh language
    const harshPatterns = [/stupid/i, /wrong/i, /bad/i, /terrible/i];
    if (harshPatterns.some(pattern => pattern.test(response))) {
      issues.push('Response contains harsh language');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
} 