// Assessment Engine - Scoped evaluation within current subtopic
// Avoids the scope creep issues from Carson v2

import { AssessmentResult, Subtopic, ConversationContext } from './types';

export class AssessmentEngine {
  
  /**
   * Assess student response within the scope of current subtopic only
   * This prevents the engine from chasing off-topic concepts
   */
  static async assessWithinScope(
    studentResponse: string,
    currentSubtopic: Subtopic,
    conversationContext?: ConversationContext
  ): Promise<AssessmentResult> {
    
    console.log(`🧠 Assessing response within subtopic: ${currentSubtopic.title}`);
    
    try {
      // Build assessment prompt with strict scope constraints
      const assessmentPrompt = this.buildAssessmentPrompt(
        studentResponse,
        currentSubtopic,
        conversationContext
      );
      
      // Make LLM call for assessment (we'll use a simple implementation for now)
      const llmResponse = await this.callLLMForAssessment(assessmentPrompt);
      
      // Parse LLM response into structured assessment
      const assessment = this.parseAssessmentResponse(llmResponse, currentSubtopic);
      
      console.log(`📊 Assessment complete:`, {
        status: assessment.status,
        conceptsIdentified: assessment.conceptsIdentified,
        confidence: assessment.confidence
      });
      
      return assessment;
      
    } catch (error) {
      console.error('Assessment failed:', error);
      
      // Fallback assessment to prevent system breakdown
      return this.createFallbackAssessment(studentResponse, currentSubtopic);
    }
  }

  /**
   * Build a focused assessment prompt that only evaluates within subtopic scope
   */
  private static buildAssessmentPrompt(
    studentResponse: string,
    subtopic: Subtopic,
    context?: ConversationContext
  ): string {
    
    const expectedConcepts = subtopic.expectedConcepts.join(', ');
    const contextHistory = context?.sessionContext.conversationHistory
      .slice(-3) // Last 3 turns for context
      .map(turn => `${turn.role}: ${turn.content}`)
      .join('\n') || '';

    return `You are Carson, an expert medical educator. Assess this student response ONLY within the scope of ${subtopic.title}.

CURRENT SUBTOPIC: ${subtopic.title}
EXPECTED CONCEPTS FOR THIS SUBTOPIC: ${expectedConcepts}

RECENT CONVERSATION CONTEXT:
${contextHistory}

STUDENT RESPONSE TO ASSESS:
"${studentResponse}"

IMPORTANT CONSTRAINTS:
- ONLY evaluate concepts relevant to "${subtopic.title}"
- DO NOT assess concepts from other subtopics, even if mentioned
- If student mentions off-topic concepts, note them but don't evaluate understanding
- Focus on the expected concepts for this specific subtopic

Please provide your assessment in this exact JSON format:
{
  "status": "correct" | "partial" | "incorrect" | "off_topic",
  "conceptsIdentified": ["concept1", "concept2"],
  "conceptsCorrect": ["concept1"],
  "conceptsMissing": ["concept2", "concept3"],
  "confidence": 0.85,
  "reasoning": "Brief explanation of assessment"
}

Assessment:`;
  }

  /**
   * Call LLM for assessment (simplified implementation)
   * In production, this would use your preferred LLM service
   */
  private static async callLLMForAssessment(prompt: string): Promise<string> {
    // For now, we'll use a placeholder that simulates an LLM call
    // You'll replace this with actual LLM integration (OpenAI, Claude, etc.)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock response - in real implementation, this would be the LLM response
    return `{
  "status": "partial",
  "conceptsIdentified": ["hypertension", "diabetes"],
  "conceptsCorrect": ["hypertension"],
  "conceptsMissing": ["previous_preeclampsia", "multiple_gestation"],
  "confidence": 0.75,
  "reasoning": "Student correctly identified hypertension as a risk factor but missed several other key risk factors."
}`;
  }

  /**
   * Parse LLM response into structured AssessmentResult
   */
  private static parseAssessmentResponse(
    llmResponse: string,
    subtopic: Subtopic
  ): AssessmentResult {
    
    try {
      // Extract JSON from LLM response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.status || !parsed.conceptsIdentified || !parsed.confidence) {
        throw new Error('Missing required fields in assessment response');
      }
      
      // Filter concepts to only include those relevant to current subtopic
      const scopedConceptsIdentified = this.filterConceptsToScope(
        parsed.conceptsIdentified,
        subtopic
      );
      
      const scopedConceptsCorrect = this.filterConceptsToScope(
        parsed.conceptsCorrect || [],
        subtopic
      );
      
      const scopedConceptsMissing = this.filterConceptsToScope(
        parsed.conceptsMissing || [],
        subtopic
      );

      return {
        status: parsed.status,
        conceptsIdentified: scopedConceptsIdentified,
        conceptsCorrect: scopedConceptsCorrect,
        conceptsMissing: scopedConceptsMissing,
        confidence: Math.max(0, Math.min(1, parsed.confidence)), // Clamp 0-1
        reasoning: parsed.reasoning || 'Assessment completed'
      };
      
    } catch (error) {
      console.error('Failed to parse assessment response:', error);
      return this.createFallbackAssessment('', subtopic);
    }
  }

  /**
   * Filter concepts to only include those within subtopic scope
   */
  private static filterConceptsToScope(
    concepts: string[],
    subtopic: Subtopic
  ): string[] {
    return concepts.filter(concept => 
      subtopic.expectedConcepts.some(expected => 
        expected.toLowerCase().includes(concept.toLowerCase()) ||
        concept.toLowerCase().includes(expected.toLowerCase())
      )
    );
  }

  /**
   * Create fallback assessment when LLM fails
   */
  private static createFallbackAssessment(
    studentResponse: string,
    subtopic: Subtopic
  ): AssessmentResult {
    
    // Simple keyword matching as fallback
    const responseWords = studentResponse.toLowerCase().split(/\s+/);
    const matchedConcepts = subtopic.expectedConcepts.filter(concept =>
      responseWords.some(word => 
        concept.toLowerCase().includes(word) || 
        word.includes(concept.toLowerCase())
      )
    );

    return {
      status: matchedConcepts.length > 0 ? 'partial' : 'incorrect',
      conceptsIdentified: matchedConcepts,
      conceptsCorrect: matchedConcepts,
      conceptsMissing: subtopic.expectedConcepts.filter(c => !matchedConcepts.includes(c)),
      confidence: 0.3, // Low confidence for fallback
      reasoning: 'Fallback assessment due to system error'
    };
  }

  /**
   * Quick validation method to check if assessment seems reasonable
   */
  static validateAssessment(assessment: AssessmentResult): boolean {
    return (
      assessment.confidence >= 0 && assessment.confidence <= 1 &&
      ['correct', 'partial', 'incorrect', 'off_topic'].includes(assessment.status) &&
      Array.isArray(assessment.conceptsIdentified) &&
      Array.isArray(assessment.conceptsCorrect) &&
      Array.isArray(assessment.conceptsMissing)
    );
  }
} 