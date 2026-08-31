"use client";

import { useState } from "react";
import {
  Sparkles,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  HelpCircle,
  ArrowRight,
  Award,
  Clock,
  FileCode,
  Tag,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface QuizQuestionData {
  stem: string;
  options: string[];
  answer_index: number;
  explanation: string;
  source_chunk_id: string;
}

interface QuizViewProps {
  syllabusItemId: string;
  topicTitle?: string;
  courseTitle?: string;
  onClose?: () => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizView({
  syllabusItemId,
  topicTitle = "Topic Practice",
  courseTitle,
  onClose,
}: QuizViewProps) {
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionData[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [index: number]: number }>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);

  // Generate AI Quiz
  const handleGenerateQuiz = async () => {
    setLoading(true);
    setError(null);
    setSelectedAnswers({});
    setCurrentIdx(0);
    setIsCompleted(false);

    try {
      const res = await fetch("/api/v1/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syllabus_item_id: syllabusItemId,
          question_count: questionCount,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate quiz");
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions were generated. Please try again.");
      }

      setQuestions(data.questions);
    } catch (err: any) {
      console.error("Quiz generation error:", err);
      setError(err?.message || "Something went wrong while generating the quiz.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Option Selection
  const handleSelectOption = (optionIndex: number) => {
    // If current question is already answered, don't allow changing
    if (selectedAnswers[currentIdx] !== undefined) return;

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIdx]: optionIndex,
    }));
  };

  // Move to next question or complete
  const handleNext = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  // Retake current quiz
  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentIdx(0);
    setIsCompleted(false);
  };

  // Calculate Score
  const totalAnswered = Object.keys(selectedAnswers).length;
  const correctCount = questions.reduce((acc, q, idx) => {
    return selectedAnswers[idx] === q.answer_index ? acc + 1 : acc;
  }, 0);
  const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const currentQ = questions[currentIdx];
  const hasAnsweredCurrent = currentQ && selectedAnswers[currentIdx] !== undefined;
  const currentSelectedOption = currentQ ? selectedAnswers[currentIdx] : undefined;
  const isCurrentCorrect = currentQ && currentSelectedOption === currentQ.answer_index;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              {topicTitle}
            </h3>
            {courseTitle && (
              <span className="text-[11px] font-medium text-slate-400">
                {courseTitle} • AI Active Recall
              </span>
            )}
          </div>
        </div>

        {questions.length > 0 && !isCompleted && !loading && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              Q{currentIdx + 1} of {questions.length}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Score: {correctCount}/{totalAnswered}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="py-6 flex-1 flex flex-col justify-center">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Initial State: Ready to Generate */}
        {questions.length === 0 && !loading && (
          <div className="text-center py-8 px-4 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="max-w-md space-y-1.5">
              <h4 className="text-base font-bold text-slate-900">
                Practice Active Recall Quiz
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Generate an AI-powered multiple-choice quiz grounded in your course materials,
                notes, and semantic concept chunks for <strong className="text-slate-700 font-semibold">{topicTitle}</strong>.
              </p>
            </div>

            {/* Question Count Selector */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs font-medium text-slate-500">Questions:</span>
              {[3, 5, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    questionCount === count
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerateQuiz}
              className="mt-3 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Generate Quiz with AI-07b</span>
            </button>
          </div>
        )}

        {/* 2. Loading State */}
        {loading && (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Retrieving context chunks & formulating questions...
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              AI-07b is analyzing conceptual boundaries and generating plausible active-recall distractors.
            </p>
          </div>
        )}

        {/* 3. Active Quiz Question View */}
        {questions.length > 0 && !isCompleted && !loading && currentQ && (
          <div className="space-y-5 animate-in fade-in-50 duration-200">
            {/* Progress Bar */}
            <Progress
              value={((currentIdx + 1) / questions.length) * 100}
              className="h-1.5 bg-slate-100"
            />

            {/* Question Stem */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 block mb-1">
                Question {currentIdx + 1}
              </span>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {currentQ.stem}
              </p>
            </div>

            {/* Option Choices */}
            <div className="space-y-2.5">
              {currentQ.options.map((opt, optIdx) => {
                const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
                const isSelected = currentSelectedOption === optIdx;
                const isCorrect = optIdx === currentQ.answer_index;

                let optionStyle = "bg-white border-slate-200 hover:border-slate-300 text-slate-800";
                let badgeStyle = "bg-slate-100 text-slate-600";

                if (hasAnsweredCurrent) {
                  if (isCorrect) {
                    optionStyle = "bg-emerald-50/90 border-emerald-300 text-emerald-950 font-semibold";
                    badgeStyle = "bg-emerald-500 text-white";
                  } else if (isSelected && !isCorrect) {
                    optionStyle = "bg-rose-50/90 border-rose-300 text-rose-950 font-semibold";
                    badgeStyle = "bg-rose-500 text-white";
                  } else {
                    optionStyle = "bg-white border-slate-200 text-slate-400 opacity-60";
                    badgeStyle = "bg-slate-100 text-slate-400";
                  }
                } else if (isSelected) {
                  optionStyle = "bg-indigo-50 border-indigo-400 text-indigo-950";
                  badgeStyle = "bg-indigo-600 text-white";
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={hasAnsweredCurrent}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs flex items-start gap-3 transition-all cursor-pointer disabled:cursor-default ${optionStyle}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${badgeStyle}`}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 leading-relaxed">{opt}</span>

                    {hasAnsweredCurrent && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {hasAnsweredCurrent && isSelected && !isCorrect && (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation & Citation Box (Appears after answer is selected) */}
            {hasAnsweredCurrent && (
              <div
                className={`p-4 rounded-xl border space-y-2 animate-in fade-in-50 duration-200 ${
                  isCurrentCorrect
                    ? "bg-emerald-50/50 border-emerald-200/80"
                    : "bg-amber-50/50 border-amber-200/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isCurrentCorrect ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    {isCurrentCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Correct!</span>
                      </>
                    ) : (
                      <>
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Explanation</span>
                      </>
                    )}
                  </span>

                  {/* Citation Tag */}
                  {currentQ.source_chunk_id && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 shadow-2xs"
                      title={`Verified by semantic chunk: ${currentQ.source_chunk_id}`}
                    >
                      <Tag className="w-2.5 h-2.5 text-slate-400" />
                      <span>Source: {currentQ.source_chunk_id.slice(0, 8)}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {currentQ.explanation}
                </p>

                {/* Advance Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>
                      {currentIdx + 1 < questions.length ? "Next Question" : "View Results"}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Quiz Summary & Mastery Score */}
        {isCompleted && (
          <div className="text-center py-6 space-y-6 animate-in fade-in-50 duration-200">
            <div className="inline-flex flex-col items-center justify-center p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-2xs ${
                  percentage >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : percentage >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                <Award className="w-7 h-7" />
              </div>

              <h4 className="text-xl font-extrabold text-slate-900">
                {percentage}% Score
              </h4>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                You got {correctCount} out of {questions.length} questions correct
              </p>

              <span
                className={`inline-block mt-3 px-3 py-1 rounded-full text-[11px] font-bold border ${
                  percentage >= 80
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : percentage >= 50
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {percentage >= 80
                  ? "🎯 High Concept Retention"
                  : percentage >= 50
                  ? "⚡ Review Recommended"
                  : "📖 Relearning Required"}
              </span>
            </div>

            {/* Breakdown of Questions */}
            <div className="text-left space-y-3 max-h-64 overflow-y-auto pr-1">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Question Review
              </h5>
              {questions.map((q, idx) => {
                const userAns = selectedAnswers[idx];
                const isCorrect = userAns === q.answer_index;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      isCorrect
                        ? "bg-emerald-50/40 border-emerald-200/70"
                        : "bg-rose-50/40 border-rose-200/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {idx + 1}. {q.stem}
                      </span>
                      {isCorrect ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                          Correct
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full shrink-0">
                          Missed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      <strong>Correct Answer:</strong> {q.options[q.answer_index]}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Same Quiz</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateQuiz}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Generate New Quiz</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizView;
