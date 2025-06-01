import { QuestionSolver } from '@/components/features/question-solver/question-solver';
import { QuestionBankProvider } from '@/components/features/question-solver/question-bank-context';

export default function QuestionSolverPage() {
  return (
    <div className="h-screen">
      <QuestionBankProvider>
        <QuestionSolver />
      </QuestionBankProvider>
    </div>
  );
} 