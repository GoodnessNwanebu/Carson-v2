# Carson v2 Prompt Testing Guide

## Quick Start

You now have two prompt engines to compare:

### Enhanced Simple Prompts (Currently Active) ✨ NEW
- **File**: `src/config/prompts.ts` 
- **Set**: `useSimplePrompts: true`
- **Focus**: Carson's authentic teaching style + Google best practices + key intelligence
- **Features**: 
  - Genuine curiosity-based conversations (not gap-detection)
  - Emotional cue recognition (`classifyInteraction()`)
  - Few-shot examples and specific assessment criteria
  - Medical terminology validation
  - Lower temperature (0.3) for consistent facts
  - Concise responses (1000 tokens)
- **Best for**: Natural conversations that feel authentic while being educationally effective

### Complex Prompts 
- **File**: `src/config/prompts.ts`
- **Set**: `useSimplePrompts: false` 
- **Focus**: Rich context, detailed assessment, sophisticated logic (1,401 lines)
- **Best for**: Nuanced conversations, detailed student tracking, complex state management

## What Changed in Enhanced Simple

### New Carson Personality:
- **Before**: "Direct but warm" teacher
- **Now**: That beloved attending students remember fondly
- **Approach**: Genuinely curious about student knowledge → natural conversation → experience-based gap recognition → conversational explanation

### Google Best Practices Added:
- ✅ **Few-shot examples**: Shows Carson what excellent vs confused responses look like
- ✅ **Chain of thought assessment**: Step-by-step evaluation criteria
- ✅ **Specific criteria**: Concrete definitions for medical accuracy, completeness, etc.
- ✅ **Contextual prompts**: Rich context about Carson's teaching style

### Key Intelligence Restored:
- ✅ **Emotional detection**: Handles frustration, confusion, off-topic responses
- ✅ **Medical validation**: Prevents hallucinations
- ✅ **Interaction routing**: Proper handling of different student response types

## How to Switch

Edit `src/config/prompts.ts`:

```typescript
export const PROMPT_CONFIG = {
  useSimplePrompts: true,  // <- Enhanced simple (recommended)
  // useSimplePrompts: false,  // <- Complex system
  temperature: 0.3,        // <- Lower for medical accuracy
  maxTokens: 1000,         // <- Concise responses
}
```

## System Prompt Variants

You can also test different Carson personalities:

```typescript
export const SYSTEM_PROMPTS = {
  carson: "...",           // Current refined prompt
  experimental: "...",     // Minimal prompt for testing
}
```

Then update `src/app/api/llm/route.ts` to use `SYSTEM_PROMPTS.experimental`.

## What to Test

1. **Start with "myocardial infarction"** - See Carson's genuine curiosity
2. **Give a confused response** ("I don't really know") - Watch emotional support
3. **Give a partial answer** ("Something about heart attacks") - See gap recognition
4. **Ask off-topic** ("How are you?") - Test interaction classification
5. **Give medical inaccuracy** - See if lower temperature prevents hallucinations
6. **Test transitions** between subtopics - Notice encouraging style

## Expected Improvements

- 🎯 **More consistent** medical facts (temp 0.3)
- 💝 **More authentic** Carson personality  
- 🧠 **Smarter** emotional recognition
- 📚 **Evidence-based** prompting (Google principles)
- ⚡ **More focused** responses (1000 tokens)
- 🔍 **Better assessment** with specific criteria

## Files Modified

- ✅ `src/config/prompts.ts` - New Carson personality, lower temp/tokens
- ✅ `src/lib/prompts/promptEngine.ts` - Enhanced simple prompts with Google practices
- ✅ Enhanced simple system uses `classifyInteraction()` from complex system
- ✅ Preserved your original complex system (unchanged)

**Recommendation**: Start with enhanced simple prompts. They combine the best of both worlds while being much cleaner to iterate on. 