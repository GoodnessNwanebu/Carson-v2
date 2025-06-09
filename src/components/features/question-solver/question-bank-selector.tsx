"use client"

import React, { useState } from 'react';
import { useQuestionBank } from './question-bank-context';
import { Button } from '@/components/ui/button';
import { FileText, Upload, AlertCircle, CheckCircle, Plus, Brain, HelpCircle } from 'lucide-react';
import { QuestionBank, Question } from '@/types/questionBank';
import { cn } from '@/lib/utils';

interface UploadState {
  isUploading: boolean;
  error: string | null;
  success: boolean;
}

export function QuestionBankSelector() {
  const { availableBanks, selectBank, addQuestionBank } = useQuestionBank();
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
    success: false
  });
  const [showUpload, setShowUpload] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  const parseJSONFile = async (file: File): Promise<QuestionBank> => {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Handle different JSON structures
    let questions: Question[] = [];
    
    if (data.questions && Array.isArray(data.questions)) {
      questions = data.questions;
    } else if (Array.isArray(data)) {
      questions = data;
    } else {
      throw new Error('Invalid JSON format. Expected questions array.');
    }

    // Validate and normalize questions
    const validQuestions = questions.map((q: any, index) => {
      const questionText = q.questionText || q.question || q.text || q.title;
      if (!questionText) {
        throw new Error(`Question ${index + 1} is missing question text.`);
      }

      // Handle options
      let options: any[] = q.options || [];
      if (!options.length && q.choices) {
        options = q.choices;
      }
      if (!options.length && (q.a || q.b || q.c || q.d)) {
        options = [
          { id: 'a', text: q.a, isCorrect: false },
          { id: 'b', text: q.b, isCorrect: false },
          { id: 'c', text: q.c, isCorrect: false },
          { id: 'd', text: q.d, isCorrect: false }
        ];
      }

      // Set correct answer
      const correctAnswer = q.correctAnswer || q.correct || q.answer || 'a';
      if (options.length > 0) {
        options = options.map((opt: any) => ({
          ...opt,
          isCorrect: opt.id === correctAnswer || opt.text === correctAnswer
        }));
      }

      return {
        id: q.id || `q_${index + 1}`,
        questionText,
        questionType: 'multiple_choice' as const,
        options,
        correctAnswer,
        explanation: q.explanation || q.rationale || '',
        topic: q.topic || q.category || 'General',
        difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        source: q.source || 'Uploaded',
        tags: q.tags || []
      };
    });

    if (validQuestions.length === 0) {
      throw new Error('No valid questions found in file.');
    }

    return {
      id: `uploaded_${Date.now()}`,
      name: data.name || data.title || file.name.replace(/\.[^/.]+$/, ""),
      description: data.description || `Imported from ${file.name}`,
      source: data.source || 'Uploaded File',
      subject: data.subject || 'General',
      questions: validQuestions,
      totalQuestions: validQuestions.length,
      estimatedTimeMinutes: Math.ceil(validQuestions.length * 2),
      difficulty: 'medium' as const,
      createdAt: new Date()
    };
  };

  const parseCSVFile = async (file: File): Promise<QuestionBank> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one question.');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const questionIndex = headers.findIndex(h => h.includes('question') || h.includes('text'));
    
    if (questionIndex === -1) {
      throw new Error('CSV must have a column containing "question" or "text".');
    }

    const questions: Question[] = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const questionText = values[questionIndex];
      
      if (!questionText) {
        throw new Error(`Row ${index + 2} is missing question text.`);
      }

      // Try to find answer options (a, b, c, d columns)
      const options: any[] = [];
      const correctAnswer = values[headers.findIndex(h => h.includes('correct') || h.includes('answer'))] || 'a';
      
      ['a', 'b', 'c', 'd'].forEach(letter => {
        const optionIndex = headers.findIndex(h => h === letter || h === `option_${letter}`);
        if (optionIndex !== -1 && values[optionIndex]) {
          options.push({
            id: letter,
            text: values[optionIndex],
            isCorrect: letter === correctAnswer.toLowerCase()
          });
        }
      });

      return {
        id: `csv_q_${index + 1}`,
        questionText,
        questionType: 'multiple_choice' as const,
        options,
        correctAnswer: correctAnswer.toLowerCase(),
        explanation: values[headers.findIndex(h => h.includes('explanation'))] || '',
        topic: values[headers.findIndex(h => h.includes('topic') || h.includes('category'))] || 'General',
        difficulty: 'medium' as const,
        source: 'CSV Upload',
        tags: []
      };
    });

    return {
      id: `csv_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      description: `Imported from ${file.name}`,
      source: 'CSV Upload',
      subject: 'General',
      questions,
      totalQuestions: questions.length,
      estimatedTimeMinutes: Math.ceil(questions.length * 2),
      difficulty: 'medium' as const,
      createdAt: new Date()
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadState({ isUploading: true, error: null, success: false });

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let questionBank: QuestionBank;

      switch (fileExtension) {
        case 'json':
          questionBank = await parseJSONFile(file);
          break;
        case 'csv':
          questionBank = await parseCSVFile(file);
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}. Please use JSON or CSV files.`);
      }

      // Add to available banks
      addQuestionBank(questionBank);
      
      setUploadState({ isUploading: false, error: null, success: true });
      
      // Auto-hide upload form after success
      setTimeout(() => {
        setShowUpload(false);
        setUploadState({ isUploading: false, error: null, success: false });
      }, 2000);

    } catch (error) {
      setUploadState({
        isUploading: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
        success: false
      });
    }

    // Reset input
    event.target.value = '';
  };

  return (
    <div className="flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 overflow-y-auto"
         style={{ minHeight: '100vh' }}>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl mx-auto">
          {/* Carson Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-3 sm:gap-4 bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-sm mb-6 sm:mb-8">
              <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-lg sm:text-xl font-bold">Carson Practice</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              Question Banks
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Practice with past exam questions collaboratively with Carson. Upload your own question banks or choose from available collections.
            </p>
          </div>

          {/* Upload Section */}
          {!showUpload ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8 mb-6 sm:mb-8 relative overflow-hidden">
              {/* Carson Brand Decorative Elements */}
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12"></div>
              
              <div className="relative">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center gap-2 sm:gap-3 mb-4">
                    <div className="p-3 sm:p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">Upload Question Bank</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">Start by uploading your own question collection</p>
                  
                  <Button 
                    onClick={() => setShowUpload(true)}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-sm transition-all duration-200"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Upload Questions
                  </Button>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setShowFormats(!showFormats)}
                    className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Supported formats & examples
                  </button>
                  
                  {showFormats && (
                    <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-left">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Supported Formats:</h4>
                      <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                        <div>
                          <strong>JSON Format:</strong>
                          <pre className="mt-1 p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-xs overflow-x-auto">
{`{
  "name": "Sample Quiz",
  "questions": [
    {
      "questionText": "What is the capital of France?",
      "options": ["Paris", "London", "Berlin", "Madrid"],
      "correctAnswer": "a",
      "explanation": "Paris is the capital of France."
    }
  ]
}`}
                          </pre>
                        </div>
                        <div>
                          <strong>CSV Format:</strong>
                          <pre className="mt-1 p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-xs overflow-x-auto">
{`question,a,b,c,d,correct,explanation
"What is 2+2?","3","4","5","6","b","Basic addition"`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8 mb-6 sm:mb-8">
              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload Question Bank</h3>
                <p className="text-gray-600 dark:text-gray-300">Upload JSON or CSV files containing your questions</p>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-6 sm:p-8 text-center hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                    disabled={uploadState.isUploading}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={cn(
                      "cursor-pointer flex flex-col items-center gap-3",
                      uploadState.isUploading && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {uploadState.isUploading ? 'Uploading...' : 'Choose File'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        JSON or CSV files up to 10MB
                      </p>
                    </div>
                  </label>
                </div>

                {uploadState.error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-900 dark:text-red-100">Upload Error</h4>
                        <p className="text-sm text-red-800 dark:text-red-200 mt-1">{uploadState.error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {uploadState.success && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <p className="font-semibold text-green-900 dark:text-green-100">Upload Successful!</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 sm:gap-4">
                  <Button
                    onClick={() => setShowUpload(false)}
                    variant="ghost"
                    className="flex-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 border-0"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Available Banks */}
          {availableBanks.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center">
                Available Question Banks
              </h2>
              
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableBanks.map((bank) => (
                  <div
                    key={bank.id}
                    className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8 hover:shadow-md transition-all duration-200 cursor-pointer group"
                    onClick={() => selectBank(bank)}
                  >
                    <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {bank.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {bank.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center text-sm">
                      <div>
                        <div className="font-bold text-blue-600 dark:text-blue-400">{bank.totalQuestions}</div>
                        <div className="text-gray-500 dark:text-gray-400">Questions</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600 dark:text-blue-400">~{bank.estimatedTimeMinutes}m</div>
                        <div className="text-gray-500 dark:text-gray-400">Time</div>
                      </div>
                      <div>
                        <div className={cn(
                          "font-bold capitalize",
                          bank.difficulty === 'easy' ? 'text-green-600 dark:text-green-400' :
                          bank.difficulty === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        )}>
                          {bank.difficulty}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">Level</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {availableBanks.length === 0 && !showUpload && (
            <div className="text-center py-12 sm:py-16">
              <div className="inline-flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Brain className="w-8 h-8 sm:w-12 sm:h-12 text-blue-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                Ready to practice with Carson?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                Upload your first question bank to start practicing collaboratively with Carson's AI guidance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 