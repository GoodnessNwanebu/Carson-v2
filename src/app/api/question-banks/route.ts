import { NextRequest, NextResponse } from "next/server";
import { Question, QuestionBank, QuestionOption } from "@/types/questionBank";

// In a real implementation, this would connect to a database
// For now, we'll use in-memory storage for demo purposes
let questionBanks: QuestionBank[] = [
  {
    id: '1',
    name: '2019 Medical Board Exam',
    description: 'Comprehensive board exam covering all major medical topics',
    source: 'Medical Board',
    year: '2019',
    subject: 'General Medicine',
    questions: [
      {
        id: 'q1',
        questionText: 'Which of the following is the most common cause of bacterial meningitis in adults?',
        questionType: 'multiple_choice',
        options: [
          { id: 'a', text: 'Streptococcus pneumoniae', isCorrect: true },
          { id: 'b', text: 'Neisseria meningitidis', isCorrect: false },
          { id: 'c', text: 'Haemophilus influenzae', isCorrect: false },
          { id: 'd', text: 'Listeria monocytogenes', isCorrect: false }
        ],
        correctAnswer: 'a',
        explanation: 'Streptococcus pneumoniae is the most common cause of bacterial meningitis in adults, accounting for approximately 50% of cases.',
        wrongAnswerExplanations: {
          'b': 'Neisseria meningitidis is more common in adolescents and young adults',
          'c': 'Haemophilus influenzae is rare in adults due to vaccination',
          'd': 'Listeria monocytogenes typically affects immunocompromised patients and elderly'
        },
        topic: 'Infectious Diseases',
        subtopic: 'Meningitis',
        difficulty: 'medium',
        source: '2019 Medical Board Exam',
        references: ['Harrison\'s Principles of Internal Medicine, 20th Edition']
      },
      {
        id: 'q2',
        questionText: 'A 65-year-old patient presents with sudden onset severe headache described as "worst headache of my life". What is the most likely diagnosis?',
        questionType: 'multiple_choice',
        options: [
          { id: 'a', text: 'Migraine headache', isCorrect: false },
          { id: 'b', text: 'Tension headache', isCorrect: false },
          { id: 'c', text: 'Subarachnoid hemorrhage', isCorrect: true },
          { id: 'd', text: 'Cluster headache', isCorrect: false }
        ],
        correctAnswer: 'c',
        explanation: 'The sudden onset of severe headache described as "worst headache of my life" is classic for subarachnoid hemorrhage, often due to ruptured aneurysm.',
        wrongAnswerExplanations: {
          'a': 'Migraine typically has gradual onset and associated symptoms',
          'b': 'Tension headache is usually bilateral and pressure-like, not sudden severe',
          'd': 'Cluster headache is unilateral with autonomic symptoms'
        },
        topic: 'Neurology',
        subtopic: 'Headache',
        difficulty: 'easy',
        source: '2019 Medical Board Exam',
        references: ['Adams and Victor\'s Principles of Neurology, 11th Edition']
      }
    ],
    totalQuestions: 2,
    estimatedTimeMinutes: 10,
    difficulty: 'medium',
    createdAt: new Date(),
  }
];

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ questionBanks });
  } catch (error) {
    console.error('Error fetching question banks:', error);
    return NextResponse.json({ error: "Failed to fetch question banks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const source = formData.get('source') as string;
    const subject = formData.get('subject') as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse the uploaded file
    const questionBank = await parseQuestionBankFile(file, {
      name: name || file.name,
      description: description || '',
      source: source || 'User Upload',
      subject: subject || 'General'
    });

    // Add to our storage (in real app, save to database)
    questionBanks.push(questionBank);

    return NextResponse.json({ questionBank });
  } catch (error) {
    console.error('Error uploading question bank:', error);
    return NextResponse.json({ error: "Failed to upload question bank" }, { status: 500 });
  }
}

async function parseQuestionBankFile(
  file: File, 
  metadata: { name: string; description: string; source: string; subject: string }
): Promise<QuestionBank> {
  const content = await file.text();
  let questions: Question[] = [];

  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    try {
      const jsonData = JSON.parse(content);
      questions = parseJSONQuestions(jsonData);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    questions = parseCSVQuestions(content);
  } else {
    throw new Error('Unsupported file format. Please use JSON or CSV.');
  }

  const questionBank: QuestionBank = {
    id: Date.now().toString(),
    name: metadata.name,
    description: metadata.description,
    source: metadata.source,
    subject: metadata.subject,
    questions,
    totalQuestions: questions.length,
    estimatedTimeMinutes: Math.ceil(questions.length * 2), // 2 minutes per question
    difficulty: 'mixed',
    createdAt: new Date(),
  };

  return questionBank;
}

function parseJSONQuestions(data: any): Question[] {
  if (!Array.isArray(data.questions)) {
    throw new Error('JSON must contain a "questions" array');
  }

  return data.questions.map((q: any, index: number) => ({
    id: q.id || `q${index + 1}`,
    questionText: q.questionText || q.question,
    questionType: q.questionType || 'multiple_choice',
    options: q.options?.map((opt: any, optIndex: number) => ({
      id: opt.id || String.fromCharCode(97 + optIndex), // a, b, c, d
      text: opt.text || opt.option,
      isCorrect: opt.isCorrect || false
    })),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || '',
    wrongAnswerExplanations: q.wrongAnswerExplanations || {},
    topic: q.topic || 'General',
    subtopic: q.subtopic,
    difficulty: q.difficulty || 'medium',
    source: q.source || data.source || 'Unknown',
    tags: q.tags || [],
    references: q.references || []
  }));
}

function parseCSVQuestions(content: string): Question[] {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map((line, index) => {
    const values = line.split(',').map(v => v.trim());
    const questionData: any = {};
    
    headers.forEach((header, i) => {
      questionData[header] = values[i] || '';
    });

    // Parse options if they exist
    const options: QuestionOption[] = [];
    ['optionA', 'optionB', 'optionC', 'optionD'].forEach((key, i) => {
      if (questionData[key]) {
        options.push({
          id: String.fromCharCode(97 + i), // a, b, c, d
          text: questionData[key],
          isCorrect: questionData.correctAnswer?.toLowerCase() === String.fromCharCode(97 + i)
        });
      }
    });

    return {
      id: questionData.id || `q${index + 1}`,
      questionText: questionData.questionText || questionData.question,
      questionType: 'multiple_choice' as const,
      options: options.length > 0 ? options : undefined,
      correctAnswer: questionData.correctAnswer || 'a',
      explanation: questionData.explanation || '',
      wrongAnswerExplanations: {},
      topic: questionData.topic || 'General',
      subtopic: questionData.subtopic,
      difficulty: (questionData.difficulty as any) || 'medium',
      source: questionData.source || 'CSV Import',
      tags: questionData.tags ? questionData.tags.split(';') : [],
      references: questionData.references ? questionData.references.split(';') : []
    };
  });
} 