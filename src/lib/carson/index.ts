// Carson v3 Engine Architecture - Main Exports

// Core Types
export * from './types';

// Engines
export { SessionOrchestrator } from './session-orchestrator';
export { AssessmentEngine } from './assessment-engine';
export { GapAnalysisEngine } from './gap-analysis-engine';
export { ConversationEngine } from './conversation-engine';
export { ToneLayer } from './tone-layer';
export { StudyPathBuilder } from './study-path-builder';
export type { ToneContext, ToneValidation } from './tone-layer';
export type { StudyPathOptions, SubtopicBlueprint, StudyPathValidation } from './study-path-builder';

// Persistence
export { SessionPersistence } from './persistence';

// Main interface for easy integration
export { SessionOrchestrator as Carson } from './session-orchestrator'; 