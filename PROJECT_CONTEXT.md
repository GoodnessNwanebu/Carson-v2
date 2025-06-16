# 🩺 Question Intelligence Platform - Project Context

## 📋 **Project Overview**
Building an AI-powered past question solver for medical students that transforms passive question consumption into active, collaborative learning.

## 🎯 **Core Vision**
- **Problem**: Medical students treat past questions passively (just checking answers)
- **Solution**: Interactive chat system that helps students understand WHY answers are correct AND why others aren't
- **Goal**: Turn past questions into a goldmine of active learning and understanding

## 🏗️ **Technical Foundation**
- **Current Stack**: Next.js 15 + TypeScript + Tailwind + Supabase + OpenAI
- **Existing Product**: Carson (AI tutor for medical students using Socratic method)
- **Repository**: carson-v2 (fully functional prototype)

## 🎨 **UX/UI Decisions Made**

### **Mobile Experience**
- ✅ **One question at a time** - prevents overwhelming scrolling
- ✅ **Question (40%) + Chat (60%)** screen split
- ✅ **Swipe navigation** between questions
- ✅ **Progress indicators** (Question 3/50)

### **Desktop Experience** 
- ✅ **Hybrid approach**: Question list sidebar + Active question + Chat
- ✅ **Quick navigation** - click any question in list
- ✅ **Context awareness** - see which questions discussed
- ✅ **Search/filter** capabilities

## 🧠 **Core Philosophy**
- ❌ **No adaptive difficulty** - same rigorous standards for all students
- ✅ **Adaptive support** - different explanations, same endpoints
- ✅ **Medical knowledge is non-negotiable** - doctors need to know everything
- ✅ **Focus on understanding** over memorization

## 🔧 **Technical Requirements for Functional Product**

### **Essential Components**
1. **OCR Pipeline**: Tesseract + Google Cloud Vision (backup)
2. **File Processing**: PyPDF2 + pdfplumber for PDFs
3. **Image Processing**: OpenCV for preprocessing
4. **Backend**: FastAPI/Python for processing + Next.js API routes
5. **Database**: Supabase (questions, chat history, user progress)
6. **AI**: OpenAI GPT-4 for question analysis and chat

### **Core Features**
- Upload question images/PDFs
- Extract and structure question text
- Beautiful question display
- Intelligent chat about each question
- Progress tracking
- Question navigation

## 📝 **Key Insights from Development**
- Medical education needs rigorous standards, not dumbed-down content
- Mobile-first design crucial (medical students study on phones)
- One-question-at-a-time prevents cognitive overload
- Chat interface should feel like talking to a senior study partner
- Focus on "why this answer" AND "why not the others"

## 🚀 **Current Status**
- ✅ Carson v2 fully functional (Socratic tutor)
- ✅ UX/UI design decisions finalized
- ✅ Technical architecture planned
- 🔄 Ready to build Question Intelligence Platform

## 🎯 **Next Steps**
- Build OCR processing pipeline
- Create question upload and display system
- Implement chat interface for questions
- Add navigation and progress tracking
- Test with real medical question banks

---

**Use this context when continuing work on the Question Intelligence Platform in future chats.** 




Quick context for new chats

# Question Intelligence Platform Context

I'm continuing work on the Question Intelligence Platform for medical students.

**Background:**
- Built Carson (AI Socratic tutor for medical students) 
- Now building past question solver with chat interface
- Tech stack: Next.js 15 + TypeScript + Supabase + OpenAI
- Repository: carson-v2 (fully functional)

**Key Decisions Made:**
- Mobile: One question at a time (prevents overload)
- Desktop: Question list + active question + chat hybrid
- No adaptive difficulty - same rigorous standards for all
- Focus on "why this answer" AND "why others aren't"

**Current Goal:** [Insert what you're working on]

Full context in PROJECT_CONTEXT.md if needed.