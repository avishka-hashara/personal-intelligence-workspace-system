"use client";

import { useState } from "react";
import type { flashcards } from "@/server/db/schema";
import {
  CreditCard,
  RotateCw,
  Sparkles,
  Clock,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export type FlashcardItem = typeof flashcards.$inferSelect;

interface FlashcardListProps {
  cards: FlashcardItem[];
}

export function FlashcardList({ cards }: FlashcardListProps) {
  const [flippedCardIds, setFlippedCardIds] = useState<{ [id: string]: boolean }>({});

  const toggleFlip = (id: string) => {
    setFlippedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card) => {
        const isFlipped = !!flippedCardIds[card.id];
        const isDue = !card.nextReviewAt || new Date(card.nextReviewAt) <= now;

        return (
          <div
            key={card.id}
            className={`border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
              isDue
                ? "bg-white border-amber-200/90 shadow-amber-50/30"
                : "bg-white border-slate-200"
            }`}
          >
            <div>
              {/* Header with Due Badge and Flip Action */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isDue
                      ? "bg-amber-100 text-amber-900 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {isDue ? "Due for Review" : "Scheduled"}
                </span>

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
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 animate-in fade-in-50 duration-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block mb-1">
                      Answer / Definition
                    </span>
                    <p className="text-sm font-medium text-slate-800 leading-relaxed">
                      {card.back}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Metadata */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-slate-300" />
                Created {formatDistanceToNow(new Date(card.createdAt), { addSuffix: true })}
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
  );
}

export default FlashcardList;
