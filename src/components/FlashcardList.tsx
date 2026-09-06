"use client";

import { useState, useTransition } from "react";
import type { flashcards } from "@/server/db/schema";
import {
  CreditCard,
  RotateCw,
  Sparkles,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { reviewFlashcard, type DueFlashcardItem } from "@/server/actions/study";

export type FlashcardItem = typeof flashcards.$inferSelect | DueFlashcardItem;

interface FlashcardListProps {
  cards: FlashcardItem[];
  examMode?: boolean;
  targetExamTitle?: string;
  daysUntilExam?: number;
}

const RATINGS = [
  { value: 1, label: "Again", color: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  { value: 2, label: "Hard", color: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: 3, label: "Good", color: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { value: 4, label: "Easy", color: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
];

export function FlashcardList({
  cards: initialCards,
  examMode = false,
  targetExamTitle,
  daysUntilExam,
}: FlashcardListProps) {
  const [cards, setCards] = useState<FlashcardItem[]>(initialCards);
  const [flippedCardIds, setFlippedCardIds] = useState<{ [id: string]: boolean }>({});
  const [isPending, startTransition] = useTransition();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const toggleFlip = (id: string) => {
    setFlippedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleRate = (cardId: string, rating: number) => {
    setReviewedIds((prev) => new Set(prev).add(cardId));
    setFlippedCardIds((prev) => ({ ...prev, [cardId]: false }));

    startTransition(async () => {
      const res = await reviewFlashcard(cardId, rating);
      if (res && res.success && res.card) {
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, ...res.card } : c))
        );
      }
    });
  };

  const now = new Date();

  if (cards.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2">
        <CreditCard className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No flashcards created yet</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-md">
          Add question-and-answer pairs above to test your active recall and spaced repetition.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Exam Mode Banner if active */}
      {examMode && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                FSRS Exam Ramp Active {targetExamTitle ? `(${targetExamTitle})` : ""}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Cards with predicted retrievability below 85% at the exam date are automatically pulled forward into your review queue.
              </p>
            </div>
          </div>
          {daysUntilExam !== undefined && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0">
              {daysUntilExam}d to Exam
            </span>
          )}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => {
          const isFlipped = !!flippedCardIds[card.id];
          const hasBeenReviewed = reviewedIds.has(card.id);
          const isDue =
            (card as any).isDue ??
            (!card.nextReviewAt || new Date(card.nextReviewAt) <= now);
          const isExamRamp = (card as any).dueReason === "exam_ramp";
          const retrievability = (card as any).retrievabilityAtExam;

          return (
            <div
              key={card.id}
              className={`border rounded-2xl p-5 shadow-subtle hover:shadow-float transition-all flex flex-col justify-between ${
                hasBeenReviewed
                  ? "bg-emerald-500/5 dark:bg-emerald-950/10 border-emerald-500/20"
                  : isExamRamp
                  ? "bg-white dark:bg-zinc-900 border-amber-400/50 dark:border-amber-500/30 ring-1 ring-amber-400/20"
                  : isDue
                  ? "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  : "bg-white dark:bg-zinc-900 border-zinc-200/70 dark:border-zinc-800/70"
              }`}
            >
              <div>
                {/* Header with Due Badge, Exam Ramp indicator and Flip Action */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hasBeenReviewed ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Reviewed Just Now
                      </span>
                    ) : isExamRamp ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-500" />
                        Exam Ramp Priority
                        {retrievability !== null && retrievability !== undefined && (
                          <span className="font-mono text-amber-600 dark:text-amber-400">
                            ({Math.round(retrievability * 100)}% Ret.)
                          </span>
                        )}
                      </span>
                    ) : isDue ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                        Due for Review
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                        Scheduled
                      </span>
                    )}

                    {card.stability && Number(card.stability) > 0 && (
                      <span
                        className="text-[9px] font-medium font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60"
                        title={`FSRS Stability: ${card.stability}, Difficulty: ${card.difficulty || "0"}`}
                      >
                        S:{Number(card.stability).toFixed(1)}d
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFlip(card.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3 text-zinc-400" />
                    <span>{isFlipped ? "Show Front" : "Reveal Answer"}</span>
                  </button>
                </div>

                {/* Card Content (Front vs Back) */}
                <div className="min-h-[90px] flex flex-col justify-center py-2">
                  {!isFlipped ? (
                    <div>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 block mb-1">
                        Question / Prompt
                      </span>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                        {card.front}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 rounded-xl p-3.5 animate-in fade-in-50 duration-200">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                          Answer / Definition
                        </span>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                          {card.back}
                        </p>
                      </div>

                      {/* FSRS Rating Buttons */}
                      <div className="pt-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                          How well did you recall this?
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {RATINGS.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              disabled={isPending}
                              onClick={() => handleRate(card.id, r.value)}
                              className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 text-center hover:scale-[1.02] active:scale-[0.98] ${r.color}`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Metadata */}
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-1 text-[11px] font-mono">
                  <Clock className="w-3 h-3 text-zinc-300 dark:text-zinc-600" />
                  {card.nextReviewAt && !isDue
                    ? `Review ${formatDistanceToNow(new Date(card.nextReviewAt), { addSuffix: true })}`
                    : `Created ${formatDistanceToNow(new Date(card.createdAt), { addSuffix: true })}`}
                </span>

                <button
                  type="button"
                  onClick={() => toggleFlip(card.id)}
                  className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {isFlipped ? "Flip to Front" : "Flip to Back"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FlashcardList;
