import { QuestionSolver } from '@/components/features/question-solver/question-solver';
import { QuestionBankProvider } from '@/components/features/question-solver/question-bank-context';

export default function QuestionSolverPage() {
  return (
    <>
      <QuestionBankProvider>
        <QuestionSolver />
      </QuestionBankProvider>
    </>
  );
} 