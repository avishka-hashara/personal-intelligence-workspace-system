"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { useUIStore } from "@/store/uiStore";
import { useTaskStore } from "@/store/taskStore";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  X,
  Send,
  Square,
  Bot,
  User,
  Trash2,
  Lightbulb,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

const SUGGESTIONS = [
  "What are my highest priority tasks for today?",
  "Help me create a revision schedule for upcoming exams",
  "Generate 5 active recall flashcards on Data Structures",
  "How should I structure my notes for a new course?",
];

function getMessageText(message: any): string {
  if (typeof message.content === "string" && message.content) {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text || "")
      .join("");
  }
  return "";
}

interface ParsedToolInvocation {
  toolName: string;
  toolCallId: string;
  state?: string;
  args?: any;
  output?: any;
  result?: any;
}

function getMessageToolInvocations(message: any): ParsedToolInvocation[] {
  const list: ParsedToolInvocation[] = [];
  const seenIds = new Set<string>();

  // 1. Direct toolInvocations array if present
  if (Array.isArray(message.toolInvocations)) {
    for (const t of message.toolInvocations) {
      const id = t.toolCallId || t.id || `${t.toolName}-${list.length}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const out = t.output !== undefined ? t.output : t.result;
        list.push({
          toolName: t.toolName || (typeof t.type === "string" && t.type.startsWith("tool-") ? t.type.replace("tool-", "") : "tool"),
          toolCallId: id,
          state: t.state,
          args: t.args || t.input,
          output: out,
          result: out,
        });
      }
    }
  }

  // 2. Parts array (AI SDK v7 UIMessage parts)
  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.type === "tool-invocation") {
        const t = part.toolInvocation || part;
        const id = t.toolCallId || t.id || `${t.toolName}-${list.length}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const out = t.output !== undefined ? t.output : t.result !== undefined ? t.result : part.output;
          list.push({
            toolName: t.toolName || "tool",
            toolCallId: id,
            state: t.state,
            args: t.args || t.input,
            output: out,
            result: out,
          });
        }
      } else if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        const toolName = part.type.replace("tool-", "");
        const id = part.toolCallId || `${toolName}-${list.length}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const out = part.output !== undefined ? part.output : (part as any).result;
          list.push({
            toolName,
            toolCallId: id,
            state: part.state,
            args: part.input || (part as any).args,
            output: out,
            result: out,
          });
        }
      } else if (part.type === "dynamic-tool") {
        const id = part.toolCallId || `${part.toolName}-${list.length}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const out = (part as any).output !== undefined ? (part as any).output : (part as any).result;
          list.push({
            toolName: part.toolName || "tool",
            toolCallId: id,
            state: part.state,
            args: part.input || (part as any).args,
            output: out,
            result: out,
          });
        }
      }
    }
  }

  return list;
}

export function Copilot() {
  const router = useRouter();
  const { isCopilotOpen, setCopilotOpen } = useUIStore();
  const { upsertTask } = useTaskStore();
  const [input, setInput] = useState("");
  const processedTaskIdsRef = useRef<Set<string>>(new Set());

  const {
    messages,
    sendMessage,
    stop,
    status,
    setMessages,
    error,
  } = useChat();

  const isLoading = status === "submitted" || status === "streaming";
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync tasks created or completed by Copilot directly into client Zustand store & refresh Server Components
  useEffect(() => {
    for (const msg of messages) {
      const toolInvocations = getMessageToolInvocations(msg);
      for (const t of toolInvocations) {
        const out = t.output || t.result;
        if (
          (t.toolName === "createTask" || t.toolName === "completeTask") &&
          out?.task &&
          !processedTaskIdsRef.current.has(`${t.toolName}-${out.task.id}-${out.task.status}`)
        ) {
          processedTaskIdsRef.current.add(`${t.toolName}-${out.task.id}-${out.task.status}`);
          upsertTask(out.task);
          router.refresh();
        }
      }
    }
  }, [messages, upsertTask, router]);

  // Auto-scroll to bottom as messages stream
  useEffect(() => {
    if (isCopilotOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isCopilotOpen, isLoading]);

  // Close Copilot on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCopilotOpen) {
        setCopilotOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCopilotOpen, setCopilotOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    sendMessage({ text: trimmed });
  };

  const handleSuggestionClick = (text: string) => {
    sendMessage({ text });
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isCopilotOpen && (
        <div
          onClick={() => setCopilotOpen(false)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-50 md:hidden transition-opacity"
        />
      )}

      {/* Slide-Over Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isCopilotOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900">Workspace Copilot</h2>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Academic & Productivity Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                title="Clear conversation"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCopilotOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center py-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  How can I help you today?
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  I can help break down courses, generate flashcards, structure notes, or optimize your daily task schedule.
                </p>
              </div>

              {/* Starter Suggestions */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>Suggested Prompts</span>
                </div>

                <div className="space-y-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-xs font-medium text-slate-700 hover:text-indigo-950 flex items-center justify-between group cursor-pointer"
                    >
                      <span className="line-clamp-1">{suggestion}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message: any) => {
                const isUser = message.role === "user";
                const textContent = getMessageText(message);
                const toolInvocations = getMessageToolInvocations(message);

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] ${
                        isUser
                          ? "rounded-2xl px-4 py-3 text-xs leading-relaxed bg-slate-900 text-white shadow-xs rounded-br-xs"
                          : "flex flex-col gap-1.5"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{textContent}</p>
                      ) : (
                        <>
                          {textContent ? (
                            <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed bg-slate-100/90 text-slate-900 border border-slate-200/80 rounded-bl-xs">
                              <div className="prose prose-slate prose-xs max-w-none space-y-2">
                                <ReactMarkdown>{textContent}</ReactMarkdown>
                              </div>
                            </div>
                          ) : null}

                          {/* Tool Invocations */}
                          {toolInvocations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {toolInvocations.map((tool: any, idx: number) => {
                                const isCall =
                                  tool.state === "call" ||
                                  tool.state === "input-streaming" ||
                                  tool.state === "input-available";
                                const isError =
                                  tool.state === "output-error" ||
                                  Boolean(
                                    tool.output?.error ||
                                    tool.result?.error ||
                                    tool.output?.success === false ||
                                    tool.result?.success === false
                                  );

                                if (tool.toolName === "createTask") {
                                  return (
                                    <div
                                      key={tool.toolCallId || `tool-create-${idx}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-2xs transition-all ${
                                        isError
                                          ? "bg-rose-50 text-rose-700 border-rose-200"
                                          : "bg-slate-100 text-slate-700 border-slate-200"
                                      }`}
                                    >
                                      <span>{isError ? "⚠️" : "🛠️"}</span>
                                      <span>
                                        {isCall
                                          ? "Creating task..."
                                          : isError
                                          ? "Failed to create task"
                                          : "Created task"}
                                      </span>
                                      {isCall && (
                                        <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-0.5" />
                                      )}
                                    </div>
                                  );
                                }

                                if (tool.toolName === "completeTask") {
                                  return (
                                    <div
                                      key={tool.toolCallId || `tool-complete-${idx}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-2xs transition-all ${
                                        isError
                                          ? "bg-rose-50 text-rose-700 border-rose-200"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      }`}
                                    >
                                      <span>{isError ? "⚠️" : "✅"}</span>
                                      <span>
                                        {isCall
                                          ? "Completing task..."
                                          : isError
                                          ? "Failed to complete task"
                                          : "Marked task as done"}
                                      </span>
                                      {isCall && (
                                        <Loader2 className="w-3 h-3 animate-spin text-emerald-500 ml-0.5" />
                                      )}
                                    </div>
                                  );
                                }

                                if (tool.toolName === "searchKnowledge") {
                                  return (
                                    <div
                                      key={tool.toolCallId || `tool-search-${idx}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-2xs transition-all ${
                                        isError
                                          ? "bg-rose-50 text-rose-700 border-rose-200"
                                          : "bg-slate-100 text-slate-700 border-slate-200"
                                      }`}
                                    >
                                      <span>{isError ? "⚠️" : "🔍"}</span>
                                      <span>
                                        {isCall
                                          ? "Searching knowledge graph..."
                                          : isError
                                          ? "Search failed"
                                          : "Searched knowledge graph"}
                                      </span>
                                      {isCall && (
                                        <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-0.5" />
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={tool.toolCallId || `tool-generic-${idx}`}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-2xs transition-all ${
                                      isError
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    <span>⚙️</span>
                                    <span>{tool.toolName}</span>
                                    {isCall && (
                                      <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-0.5" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Fallback if neither text nor tools have arrived yet during stream */}
                          {!textContent && toolInvocations.length === 0 && (
                            <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed bg-slate-100/90 text-slate-500 border border-slate-200/80 rounded-bl-xs flex items-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              <span>Thinking...</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="bg-slate-100 border border-slate-200/80 rounded-2xl rounded-bl-xs px-4 py-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error.message || "Failed to reach AI service"}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Footer Form */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot anything..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shrink-0"
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </aside>
    </>
  );
}

export default Copilot;
