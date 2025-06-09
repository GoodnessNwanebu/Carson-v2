# Phase 1 Refactor - Testing Guide

## What Changed

We've split your complex `assessUserResponse()` function into **3 focused functions** to reduce cognitive load on GPT-4o mini and improve speed + reliability.

### Old Architecture (1 complex function):
```typescript
assessUserResponse(userResponse, context) {
  // Does EVERYTHING:
  // - Classifies interaction type
  // - Assesses medical accuracy  
  // - Determines next action
  // - Generates reasoning
  // - Complex LLM calls with lots of context
}
```

### New Architecture (3 focused functions):
```typescript
// 1. FOCUSED medical assessment (fast, accurate)
assessMedicalAccuracy(userResponse, subtopic, topic, expectedConcepts)

// 2. PURE orchestration logic (no LLM, deterministic)  
determineNextAction(medicalAssessment, interaction, status, context)

// 3. CLEAN main function (separated concerns)
assessUserResponseV2(userResponse, context)
```

## How to Test

### Step 1: Update the Import
In `src/components/features/conversation/conversation.tsx`:

```typescript
// Change this line:
import { assessUserResponse, AssessmentResult, ResponseType, updateSessionAfterAssessment } from "@/lib/prompts/assessmentEngine";

// To this:
import { assessUserResponseV2 as assessUserResponse, AssessmentResult, ResponseType, updateSessionAfterAssessment } from "@/lib/prompts/assessmentEngine";
```

This aliases the new function so you don't need to change any other code!

### Step 2: Test These Scenarios

1. **Struggling Student**
   - Input: "I don't really know"
   - Expected: Emotional support + explanation
   - New benefit: Faster detection, no complex LLM analysis

2. **Confidently Wrong** 
   - Input: "The answer is definitely X" (when X is wrong)
   - Expected: Gentle correction
   - New benefit: Better detection of confident tone

3. **Partial Answer**
   - Input: "Something about heart attacks and chest pain"
   - Expected: Probe for missing concepts
   - New benefit: Specific missing concepts identified

4. **Good Answer**
   - Input: Medically accurate response with reasoning
   - Expected: Continue conversation or complete subtopic
   - New benefit: Faster assessment, more consistent

### Step 3: Monitor Performance

**Speed Improvements:**
- Medical assessment: `temperature: 0.1, maxTokens: 200` (fast + accurate)
- No complex reasoning prompts
- Deterministic orchestration logic

**Reliability Improvements:**
- Clearer prompts for GPT-4o mini
- Fallback assessment if LLM fails
- Separated concerns = easier debugging

## New Features

### 1. Confidently Wrong Detection
```typescript
// Input: "I'm sure it's X" (but X is wrong)
// Result: gentle_correction action
```

### 2. Expected Concepts
```typescript
// Automatically generates expected concepts based on subtopic:
// "Risk Factors" → ["Major risk factors", "Population at risk", "Preventable factors"]
```

### 3. Better Error Handling
```typescript
// If LLM assessment fails → fallback to rule-based assessment
// System keeps working, doesn't crash
```

## Reverting (If Needed)

If you want to go back to the old system:

```typescript
// In conversation.tsx, change back to:
import { assessUserResponse, ... } from "@/lib/prompts/assessmentEngine";
// Remove the "V2" alias
```

## Debugging

Add this to see what's happening:

```typescript
// In assessUserResponseV2, add:
console.log('Medical Assessment:', medicalAssessment);
console.log('Orchestration Result:', orchestration);
console.log('Final Result:', result);
```

## Next Steps

Once Phase 1 is working well, we can implement:
- **Phase 2**: Fresh subtopic memory + parallel processing
- **Phase 3**: Enhanced Carson personality rules 