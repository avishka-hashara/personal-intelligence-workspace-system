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
  { value: 1, label: "Again", color: "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" },
  { value: 2, label: "Hard", color: "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" },
  { value: 3, label: "Good", color: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" },
  { value: 4, label: "Easy", color: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200" },
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
      <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
        <CreditCard className="w-8 h-8 text-slate-300" />
        <h3 className="text-sm font-bold text-slate-700">No flashcards created yet</h3>
        <p className="text-xs text-slate-400 max-w-md">
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
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950">
                FSRS Exam Ramp Active {targetExamTitle ? `(${targetExamTitle})` : ""}
              </h4>
              <p className="text-[11px] text-amber-800">
                Cards with predicted retrievability below 85% at the exam date are automatically pulled forward into your review queue.
              </p>
            </div>
          </div>
          {daysUntilExam !== undefined && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-900 shrink-0">
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
              className={`border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                hasBeenReviewed
                  ? "bg-emerald-50/20 border-emerald-200"
                  : isExamRamp
                  ? "bg-white border-amber-300 shadow-amber-50/50 ring-1 ring-amber-300/50"
                  : isDue
                  ? "bg-white border-blue-200/90 shadow-blue-50/30"
                  : "bg-white border-slate-200"
              }`}
            >
              <div>
                {/* Header with Due Badge, Exam Ramp indicator and Flip Action */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hasBeenReviewed ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Reviewed Just Now
                      </span>
                    ) : isExamRamp ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-amber-600" />
                        Exam Ramp Priority
                        {retrievability !== null && retrievability !== undefined && (
                          <span className="font-mono text-amber-700">
                            ({Math.round(retrievability * 100)}% Ret.)
                          </span>
                        )}
                      </span>
                    ) : isDue ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                        Due for Review
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    )}

                    {card.stability && Number(card.stability) > 0 && (
                      <span
                        className="text-[9px] font-medium font-mono px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200/60"
                        title={`FSRS Stability: ${card.stability}, Difficulty: ${card.difficulty || "0"}`}
                      >
                        S:{Number(card.stability).toFixed(1)}d
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFlip(card.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3 text-slate-400" />
                    <span>{isFlipped ? "Show Front" : "Reveal Answer"}</span>
                  </button>
                </div>

                {/* Card Content (Front vs Back) */}
                <div className="min-h-[90px] flex flex-col justify-center py-2">
                  {!isFlipped ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                        Question / Prompt
                      </span>
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                        {card.front}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 animate-in fade-in-50 duration-200">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block mb-1">
                          Answer / Definition
                        </span>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          {card.back}
                        </p>
                      </div>

                      {/* FSRS Rating Buttons */}
                      <div className="pt-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                          How well did you recall this?
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {RATINGS.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              disabled={isPending}
                              onClick={() => handleRate(card.id, r.value)}
                              className={`px-2 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 text-center ${r.color}`}
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
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-300" />
                  {card.nextReviewAt && !isDue
                    ? `Review ${formatDistanceToNow(new Date(card.nextReviewAt), { addSuffix: true })}`
                    : `Created ${formatDistanceToNow(new Date(card.createdAt), { addSuffix: true })}`}
                </span>

                <button
                  type="button"
                  onClick={() => toggleFlip(card.id)}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
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
