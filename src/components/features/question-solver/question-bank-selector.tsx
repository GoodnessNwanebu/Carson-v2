"use client"

import React, { useState } from 'react';
import { QuestionBank } from '@/types/questionBank';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Calendar, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function QuestionBankSelector() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [availableBanks, setAvailableBanks] = useState<QuestionBank[]>([
    {
      id: '1',
      name: '2019 Medical Board Exam',
      description: 'Comprehensive board exam covering all major medical topics',
      source: 'Medical Board',
      year: '2019',
      subject: 'General Medicine',
      questions: [],
      totalQuestions: 120,
      estimatedTimeMinutes: 240,
      difficulty: 'hard',
      createdAt: new Date('2019-01-01'),
    },
    {
      id: '2',
      name: 'Pharmacology Midterm 2023',
      description: 'Focused on drug mechanisms and clinical applications',
      source: 'University Medical School',
      year: '2023',
      subject: 'Pharmacology',
      questions: [],
      totalQuestions: 50,
      estimatedTimeMinutes: 90,
      difficulty: 'medium',
      createdAt: new Date('2019-01-01'),
    }
  ]);

  const parseJSONFile = async (file: File): Promise<any> => {
    const text = await file.text();
    return JSON.parse(text);
  };

  const parseCSVFile = async (file: File): Promise<any> => {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const questions = lines.slice(1).filter(line => line.trim()).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const question: any = { id: `q_${index + 1}` };
      
      headers.forEach((header, i) => {
        question[header] = values[i] || '';
      });
      
      return question;
    });
    
    return { questions };
  };

  const parsePDFFile = async (file: File): Promise<any> => {
    try {
      // Dynamically import pdfjs-dist to avoid SSR issues
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set up the worker for PDF.js
      if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdf.numPages;
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      if (!fullText.trim()) {
        throw new Error('No text content found in PDF. The PDF might be image-based or corrupted.');
      }
      
      // Extract questions using various patterns
      const questions = extractQuestionsFromText(fullText);
      
      if (questions.length === 0) {
        throw new Error('No questions found in PDF. Please ensure the PDF contains properly formatted questions.');
      }
      
      return { 
        questions,
        title: file.name.replace('.pdf', ''),
        source: 'PDF Import',
        totalPages: numPages,
        extractedText: fullText.slice(0, 500) + '...' // Preview of extracted text
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to parse PDF: ${error}`);
    }
  };

  const extractQuestionsFromText = (text: string): any[] => {
    const questions: any[] = [];
    
    // Multiple question patterns to detect different formats
    const patterns = [
      // Pattern 1: "1. Question text?" or "Question 1: Text?"
      /(?:^|\n)(?:(?:Question\s*)?(\d+)[\.\:\)]\s*(.+?)(?=(?:\n(?:Question\s*)?\d+[\.\:\)]|\n[A-E][\.\)]\s*|\n\n|\n(?:Answer|Explanation|Solution)|\n$|$)))/gim,
      
      // Pattern 2: Questions with multiple choice options
      /(?:^|\n)(?:(\d+)[\.\:\)]\s*(.+?)(?:\n[A-E][\.\)]\s*.+?)*(?=\n\d+[\.\:\)]|\n\n|$))/gim,
      
      // Pattern 3: Questions starting with capital letters and ending with question marks
      /(?:^|\n)([A-Z].+?\?)/gm,
      
      // Pattern 4: Lines that look like questions (contain question words)
      /(?:^|\n)(.+?(?:what|how|why|when|where|which|who|describe|explain|define|list|identify).+?\?)/gi
    ];

    let questionId = 1;
    
    for (const pattern of patterns) {
      let match;
      const usedTexts = new Set();
      
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0].trim();
        const questionNumber = match[1] || questionId.toString();
        const questionText = match[2] || match[1] || fullMatch;
        
        if (!questionText || questionText.length < 10 || usedTexts.has(questionText)) {
          continue;
        }
        
        usedTexts.add(questionText);
        
        // Extract options if they follow the question
        const optionsMatch = fullMatch.match(/\n[A-E][\.\)]\s*(.+)/g);
        const options = optionsMatch ? optionsMatch.map(opt => opt.replace(/^[A-E][\.\)]\s*/, '').trim()) : [];
        
        questions.push({
          id: `pdf_q_${questionId}`,
          question: questionText.trim(),
          options: options.length > 0 ? options : undefined,
          type: options.length > 0 ? 'multiple-choice' : 'open-ended',
          number: questionNumber,
          source: 'pdf'
        });
        
        questionId++;
        
        if (questions.length >= 100) break; // Limit to prevent excessive processing
      }
      
      if (questions.length > 0) break; // Use first successful pattern
    }
    
    // If no structured questions found, try to split by question marks
    if (questions.length === 0) {
      const sentences = text.split(/[.!?]+/).filter(s => 
        s.trim().length > 20 && 
        /(?:what|how|why|when|where|which|who|describe|explain|define|list|identify)/i.test(s)
      );
      
      sentences.slice(0, 20).forEach((sentence, index) => {
        questions.push({
          id: `pdf_q_${index + 1}`,
          question: sentence.trim() + '?',
          type: 'open-ended',
          number: (index + 1).toString(),
          source: 'pdf'
        });
      });
    }
    
    return questions;
  };

  const processFile = async (): Promise<QuestionBank | null> => {
    if (!selectedFile) return null;

    let parsedData: any;
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    try {
      switch (fileExtension) {
        case 'json':
          parsedData = await parseJSONFile(selectedFile);
          break;
        case 'csv':
          parsedData = await parseCSVFile(selectedFile);
          break;
        case 'pdf':
          parsedData = await parsePDFFile(selectedFile);
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Extract or generate question bank metadata
      const questions = parsedData.questions || parsedData.data || [];
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No valid questions found in the file');
      }

      // Validate question structure
      const validQuestions = questions.filter(q => 
        q.question || q.text || q.prompt || q.title
      );

      if (validQuestions.length === 0) {
        throw new Error('No valid question structure found');
      }

      // Estimate difficulty based on question complexity
      const avgLength = validQuestions.reduce((sum, q) => {
        const questionText = q.question || q.text || q.prompt || q.title || '';
        return sum + questionText.length;
      }, 0) / validQuestions.length;

      const difficulty = avgLength > 200 ? 'hard' : avgLength > 100 ? 'medium' : 'easy';

      // Create new question bank
      const newBank: QuestionBank = {
        id: `imported_${Date.now()}`,
        name: parsedData.name || parsedData.title || selectedFile.name.replace(/\.[^/.]+$/, ""),
        description: parsedData.description || `Imported question bank from ${selectedFile.name}${fileExtension === 'pdf' ? ` (${parsedData.totalPages} pages)` : ''}`,
        source: parsedData.source || 'Imported File',
        year: parsedData.year || new Date().getFullYear().toString(),
        subject: parsedData.subject || 'General',
        questions: validQuestions,
        totalQuestions: validQuestions.length,
        estimatedTimeMinutes: Math.ceil(validQuestions.length * 2), // 2 minutes per question
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        createdAt: new Date(),
      };

      return newBank;
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        setSelectedFile(file);
        setProcessingStatus('idle');
        setErrorMessage('');
      } catch (error) {
        console.warn('File selection error:', error);
      }
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProcessingStatus('processing');
    setErrorMessage('');

    try {
      const newBank = await processFile();
      if (newBank) {
        setAvailableBanks(prev => [newBank, ...prev]);
        setProcessingStatus('success');
        
        // Reset after 3 seconds
        setTimeout(() => {
          setSelectedFile(null);
          setProcessingStatus('idle');
        }, 3000);
      }
    } catch (error) {
      setProcessingStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartPracticing = (bankId: string) => {
    // Here you would navigate to the question practice interface
    console.log('Starting practice with bank:', bankId);
    // Example: router.push(`/question-solver/practice/${bankId}`);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        setSelectedFile(files[0]);
        setProcessingStatus('idle');
        setErrorMessage('');
      }
    } catch (error) {
      console.warn('File drop error:', error);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Upload Section - Enhanced */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-gray-900 text-center sm:text-left">Upload Question Bank</h1>
          
          <div 
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 sm:p-12 text-center hover:border-gray-300 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".json,.csv,.pdf,.xlsx,.xml"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={isProcessing}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 text-gray-300" />
              <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-3 text-gray-900">
                Drop your question bank file here or click to browse
              </h3>
              <p className="text-gray-500 mb-4 sm:mb-6 text-sm sm:text-base">
                Supports JSON, CSV, PDF, Excel, and QTI formats
              </p>
              <Button 
                size="lg" 
                className="px-6 sm:px-8 h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-none"
                disabled={isProcessing}
              >
                Choose File
              </Button>
            </label>
          </div>
          
          {selectedFile && (
            <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedFile.name}</p>
                  <p className="text-xs sm:text-sm text-gray-600">Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                  
                  {/* Processing Status */}
                  {processingStatus === 'processing' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-600">
                        {selectedFile.name.endsWith('.pdf') ? 'Parsing PDF and extracting questions...' : 'Processing file...'}
                      </span>
                    </div>
                  )}
                  
                  {processingStatus === 'success' && (
                    <div className="flex items-center gap-2 mt-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Successfully imported!</span>
                    </div>
                  )}
                  
                  {processingStatus === 'error' && (
                    <div className="flex items-center gap-2 mt-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600">{errorMessage}</span>
                    </div>
                  )}
                </div>
                
                <Button 
                  className="w-full sm:w-auto sm:ml-4 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  onClick={handleProcessFile}
                  disabled={isProcessing || processingStatus === 'success'}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {selectedFile.name.endsWith('.pdf') ? 'Parsing PDF...' : 'Processing...'}
                    </>
                  ) : processingStatus === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Imported
                    </>
                  ) : (
                    'Process & Import'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Available Banks - Clean Grid */}
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-gray-900 text-center sm:text-left">Available Question Banks</h2>
          <div className="grid gap-4 sm:gap-6">
            {availableBanks.map((bank) => (
              <div key={bank.id} className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-gray-300">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-8">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{bank.name}</h3>
                      <div className="flex gap-2">
                        <span className={`inline-flex self-start sm:self-auto px-3 py-1 rounded-full text-xs font-medium ${
                          bank.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          bank.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {bank.difficulty}
                        </span>
                        {bank.id.startsWith('imported_') && (
                          <span className="inline-flex self-start sm:self-auto px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Imported
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-600 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">{bank.description}</p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 text-xs sm:text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{bank.totalQuestions} questions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>~{bank.estimatedTimeMinutes} min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{bank.year}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto px-6 sm:px-10 h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 text-white border-0 font-semibold text-sm sm:text-base"
                    onClick={() => handleStartPracticing(bank.id)}
                  >
                    Start Practicing
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 