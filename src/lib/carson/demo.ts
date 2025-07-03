// Carson v3 Demo - Test the engine architecture
// This demonstrates how all engines work together

import { Carson, SessionPersistence } from './index';

/**
 * Demo conversation to test Carson v3 engines
 */
export async function demoConversation() {
  console.log('🎯 Starting Carson v3 Demo Conversation');
  console.log('=====================================\n');
  
  try {
    // Student starts a conversation about preeclampsia
    console.log('👤 Student: "Can you help me understand preeclampsia risk factors?"');
    
    const turn1 = await Carson.processTurn(
      "Can you help me understand preeclampsia risk factors?"
    );
    
    console.log('\n🤖 Carson:', turn1.response);
    console.log('\n📊 Session Stats:', Carson.getSessionStats(turn1.updatedContext));
    
    // Student gives a partial answer
    console.log('\n👤 Student: "I think diabetes and high blood pressure are risk factors"');
    
    const turn2 = await Carson.processTurn(
      "I think diabetes and high blood pressure are risk factors",
      turn1.updatedContext.sessionId
    );
    
    console.log('\n🤖 Carson:', turn2.response);
    console.log('\n📊 Session Stats:', Carson.getSessionStats(turn2.updatedContext));
    
    // Student asks about a missing concept
    console.log('\n👤 Student: "What about previous pregnancies?"');
    
    const turn3 = await Carson.processTurn(
      "What about previous pregnancies?",
      turn2.updatedContext.sessionId
    );
    
    console.log('\n🤖 Carson:', turn3.response);
    console.log('\n📊 Session Stats:', Carson.getSessionStats(turn3.updatedContext));
    
    // Show final session state
    console.log('\n🔍 Final Session State:');
    console.log('Gap Stack:', {
      primaryGaps: Array.from(turn3.updatedContext.gapStack.primaryGaps),
      completedConcepts: Array.from(turn3.updatedContext.gapStack.completedConcepts),
      currentFocus: turn3.updatedContext.gapStack.currentFocus
    });
    
    console.log('\n💾 Session saved to localStorage with ID:', turn3.updatedContext.sessionId);
    
    // Show storage info
    const storageInfo = SessionPersistence.getStorageInfo();
    console.log('\n💾 Storage Info:', storageInfo);
    
    return turn3.updatedContext.sessionId;
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

/**
 * Demo session loading and continuation
 */
export async function demoContinueConversation(sessionId: string) {
  console.log('\n\n🔄 Continuing Previous Conversation');
  console.log('===================================\n');
  
  try {
    // Load existing session
    const session = Carson.loadSession(sessionId);
    if (!session) {
      console.log('❌ Session not found');
      return;
    }
    
    console.log('📖 Loaded session:', {
      sessionId: session.sessionId,
      topic: session.topic,
      turns: session.conversationHistory.length
    });
    
    // Continue conversation
    console.log('\n👤 Student: "Are there any other important risk factors I should know about?"');
    
    const turn = await Carson.processTurn(
      "Are there any other important risk factors I should know about?",
      sessionId
    );
    
    console.log('\n🤖 Carson:', turn.response);
    console.log('\n📊 Session Stats:', Carson.getSessionStats(turn.updatedContext));
    
  } catch (error) {
    console.error('Continue demo failed:', error);
  }
}

/**
 * Demo all available sessions
 */
export function demoSessionList() {
  console.log('\n\n📝 All Available Sessions');
  console.log('=========================\n');
  
  const sessions = Carson.getAllSessions();
  
  if (sessions.length === 0) {
    console.log('No sessions found');
    return;
  }
  
  sessions.forEach((session, index) => {
    console.log(`${index + 1}. ${session.sessionId}`);
    console.log(`   Topic: ${session.topic}`);
    console.log(`   Last Updated: ${session.lastUpdated.toLocaleString()}`);
    console.log('');
  });
}

/**
 * Demo ToneLayer functionality
 */
export async function demoToneLayer() {
  console.log('\n\n🎭 ToneLayer Demo - Carson\'s Personality Engine');
  console.log('===============================================\n');
  
  const { ToneLayer } = await import('./tone-layer');
  
  console.log('🎨 Testing tone corrections (harsh → Carson):');
  
  const testResponses = [
    {
      title: "Direct correction",
      harsh: "You're wrong about that. You missed the key risk factors.",
    },
    {
      title: "Condescending language", 
      harsh: "That's incorrect. Obviously you need to consider hypertension.",
    },
    {
      title: "Accusatory tone",
      harsh: "You failed to mention diabetes and clearly forgot about age factors.",
    },
    {
      title: "Medical jargon",
      harsh: "Patient presents with hypertensive disorders upon examination in order to assess risk.",
    }
  ];
  
  testResponses.forEach((test, index) => {
    const improved = ToneLayer.applyCarsonTone(test.harsh);
    console.log(`\n${index + 1}. ${test.title}:`);
    console.log(`   Before: "${test.harsh}"`);
    console.log(`   Carson: "${improved}"`);
  });
  
  console.log('\n📊 Tone validation example:');
  const badResponse = "That's wrong. You obviously missed hypertension and failed to consider diabetes.";
  const goodResponse = "I'm curious about your thinking on hypertension. What about diabetes as a risk factor?";
  
  const badValidation = ToneLayer.validateTone(badResponse);
  const goodValidation = ToneLayer.validateTone(goodResponse);
  
  console.log('\n❌ Bad response:', badResponse);
  console.log('   Carson Score:', badValidation.carsonScore.toFixed(2));
  console.log('   Issues:', badValidation.issues.slice(0, 2));
  
  console.log('\n✅ Good response:', goodResponse);
  console.log('   Carson Score:', goodValidation.carsonScore.toFixed(2));
  console.log('   Valid:', goodValidation.isValid);
  
  console.log('\n🎯 ToneLayer ensures Carson maintains his supportive, curious personality!');
}

/**
 * Demo StudyPathBuilder functionality
 */
export async function demoStudyPathBuilder() {
  console.log('\n\n🏗️ StudyPathBuilder Demo - Knowledge Map Foundation');
  console.log('==================================================\n');
  
  const { StudyPathBuilder } = await import('./study-path-builder');
  
  console.log('🎯 Testing study path generation for different topic types:');
  
  const testTopics = [
    { name: 'Preeclampsia', type: 'Medical Condition' },
    { name: 'Cardiovascular System', type: 'Body System' },
    { name: 'Cardiac Catheterization', type: 'Medical Procedure' },
    { name: 'Medical Ethics', type: 'General Topic' }
  ];
  
  for (const topic of testTopics) {
    console.log(`\n📚 ${topic.type}: "${topic.name}"`);
    console.log('─'.repeat(50));
    
    const studyPath = StudyPathBuilder.generateStudyPath(topic.name, {
      maxSubtopics: 5
    });
    
    console.log(`Total Duration: ${studyPath.totalEstimatedDuration} minutes`);
    console.log(`Difficulty Level: ${studyPath.difficulty}`);
    console.log(`Subtopics (${studyPath.subtopics.length}):`);
    
    studyPath.subtopics.forEach((subtopic, index) => {
      console.log(`  ${index + 1}. ${subtopic.title}`);
      console.log(`     ${subtopic.description}`);
      console.log(`     ${subtopic.difficulty} • ${subtopic.estimatedDuration}min • ${subtopic.category}`);
      console.log(`     Gaps: ${Array.from(subtopic.primaryGaps).slice(0, 3).join(', ')}...`);
    });
  }
  
  console.log('\n🎨 Advanced options demo:');
  const advancedPath = StudyPathBuilder.generateStudyPath('Diabetes Mellitus', {
    maxSubtopics: 4,
    focusAreas: ['treatment', 'complications'],
    learningObjectives: ['Master diabetes management', 'Understand complications']
  });
  
  console.log(`\n📈 Advanced Diabetes Study Path:`);
  console.log(`   Focus Areas: treatment, complications`);
  console.log(`   Generated ${advancedPath.subtopics.length} focused subtopics`);
  
  advancedPath.subtopics.forEach((subtopic, index) => {
    console.log(`   ${index + 1}. ${subtopic.title} (${subtopic.category})`);
  });
  
  console.log('\n🔍 Study path validation:');
  const validation = StudyPathBuilder['validateStudyPath'](advancedPath);
  console.log(`   Educational Quality: ${(validation.educationalQuality * 100).toFixed(0)}%`);
  console.log(`   Progression Logic: ${(validation.progressionLogic * 100).toFixed(0)}%`);
  console.log(`   Valid: ${validation.isValid}`);
  
  console.log('\n🎯 StudyPathBuilder creates educationally sound learning progressions!');
}

/**
 * Run complete demo
 */
export async function runCompleteDemo() {
  try {
    // Clear previous sessions for clean demo
    console.log('🧹 Clearing previous demo sessions...\n');
    SessionPersistence.clearAllSessions();
    
    // Run demo conversation
    const sessionId = await demoConversation();
    
    if (sessionId) {
      // Continue conversation
      await demoContinueConversation(sessionId);
      
      // Show session list
      demoSessionList();
      
      // Demo ToneLayer
      await demoToneLayer();
      
      // Demo StudyPathBuilder
      await demoStudyPathBuilder();
    }
    
    console.log('\n✅ Demo completed successfully!');
    console.log('\nYou can now:');
    console.log('- Check localStorage for saved session data');
    console.log('- Continue the conversation by calling Carson.processTurn()');
    console.log('- Load any session using Carson.loadSession(sessionId)');
    console.log('- Test ToneLayer with ToneLayer.applyCarsonTone(text)');
    console.log('- Generate study paths with StudyPathBuilder.generateStudyPath(topic)');
    
  } catch (error) {
    console.error('Complete demo failed:', error);
  }
}

// Export for manual testing
export { Carson } from './index';

// Export individual demo functions for testing
export { demoToneLayer, demoStudyPathBuilder }; 