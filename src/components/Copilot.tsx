"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  SquarePen,
  PanelLeft,
  PanelLeftClose,
  MessageSquare,
} from "lucide-react";
import {
  getChatSessions,
  getChatMessages,
  deleteChatSession,
  ChatSession,
} from "@/server/actions/copilot";

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
          toolName:
            t.toolName ||
            (typeof t.type === "string" && t.type.startsWith("tool-")
              ? t.type.replace("tool-", "")
              : "tool"),
          toolCallId: id,
          state: t.state,
          args: t.args || t.input,
          output: out,
          result: out,
        });
      }
    }
  }

  // 2. Parts array (AI SDK UIMessage parts)
  if (Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.type === "tool-invocation") {
        const t = part.toolInvocation || part;
        const id = t.toolCallId || t.id || `${t.toolName}-${list.length}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const out =
            t.output !== undefined
              ? t.output
              : t.result !== undefined
              ? t.result
              : part.output;
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

function groupSessionsByTime(sessions: ChatSession[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

  const today: ChatSession[] = [];
  const previous7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const s of sessions) {
    const time = new Date(s.updatedAt).getTime();
    if (time >= todayStart) {
      today.push(s);
    } else if (time >= sevenDaysAgo) {
      previous7Days.push(s);
    } else {
      older.push(s);
    }
  }

  return { today, previous7Days, older };
}

export function Copilot() {
  const router = useRouter();
  const { isCopilotOpen, setCopilotOpen, pageContext } = useUIStore();
  const { upsertTask } = useTaskStore();
  const [input, setInput] = useState("");
  const processedTaskIdsRef = useRef<Set<string>>(new Set());

  // Persistent Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const refreshSessions = useCallback(async () => {
    const list = await getChatSessions();
    setSessions(list);
  }, []);

  useEffect(() => {
    if (isCopilotOpen) {
      refreshSessions();
    }
  }, [isCopilotOpen, refreshSessions]);

  const {
    messages,
    sendMessage,
    stop,
    status,
    setMessages,
    error,
  } = useChat({
    onFinish() {
      refreshSessions().then(() => {
        // If we didn't have an active session ID (new chat), pick the latest created session
        getChatSessions().then((latestSessions) => {
          if (latestSessions.length > 0) {
            setActiveSessionId((prev) => prev || latestSessions[0].id);
          }
        });
      });
    },
  });

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

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId || isLoading) return;
    setActiveSessionId(sessionId);
    setIsHistoryLoading(true);
    try {
      const history = await getChatMessages(sessionId);
      const formatted = history.map((msg) => {
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ type: "text", text: msg.content });
        }
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
          for (const tc of msg.toolCalls) {
            parts.push({
              type: "tool-invocation",
              toolInvocation: tc,
            });
          }
        }
        return {
          id: msg.id,
          role: msg.role as any,
          content: msg.content || "",
          parts,
          toolInvocations: msg.toolCalls || undefined,
        };
      });
      setMessages(formatted as any);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleNewChat = () => {
    if (isLoading) return;
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteChatSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      handleNewChat();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    sendMessage({ text: trimmed }, { body: { pageContext, sessionId: activeSessionId } });
  };

  const handleSuggestionClick = (text: string) => {
    sendMessage({ text }, { body: { pageContext, sessionId: activeSessionId } });
  };

  const grouped = groupSessionsByTime(sessions);

  return (
    <>
      {/* Backdrop for mobile */}
      {isCopilotOpen && (
        <div
          onClick={() => setCopilotOpen(false)}
          className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-xs z-50 md:hidden transition-opacity"
        />
      )}

      {/* Slide-Over Panel */}
      <aside
        className={`fixed top-0 right-0 bottom-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl border-l border-zinc-200/80 dark:border-zinc-800/80 shadow-float z-50 flex transition-all duration-300 ease-in-out ${
          isCopilotOpen ? "translate-x-0" : "translate-x-full"
        } ${isSidebarOpen ? "w-full sm:w-[720px]" : "w-full sm:w-[460px]"}`}
      >
        {/* Left-hand History Sidebar */}
        {isSidebarOpen && (
          <div className="w-[260px] shrink-0 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/50 flex flex-col h-full">
            {/* Sidebar Top Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  History
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNewChat}
                  title="New Chat"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <SquarePen className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  title="Collapse sidebar"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sidebar Body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  No previous chats yet
                </div>
              ) : (
                <>
                  {grouped.today.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Today
                      </div>
                      {grouped.today.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSession(s.id)}
                          className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                            activeSessionId === s.id
                              ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          <span className="truncate pr-3">{s.title || "New Chat"}</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            title="Delete thread"
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 rounded transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {grouped.previous7Days.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Previous 7 Days
                      </div>
                      {grouped.previous7Days.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSession(s.id)}
                          className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                            activeSessionId === s.id
                              ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          <span className="truncate pr-3">{s.title || "New Chat"}</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            title="Delete thread"
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 rounded transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {grouped.older.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Older
                      </div>
                      {grouped.older.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSession(s.id)}
                          className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                            activeSessionId === s.id
                              ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-medium shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          <span className="truncate pr-3">{s.title || "New Chat"}</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            title="Delete thread"
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 rounded transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2.5">
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  title="Open history sidebar"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer mr-1"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}
              <div className="p-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Workspace Copilot
                  </h2>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                  Academic & Productivity Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNewChat}
                title="New Chat"
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                <SquarePen className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCopilotOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isHistoryLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span>Loading conversation...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center py-6 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center mx-auto border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
                    <Bot className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    How can I help you today?
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    I can help break down courses, generate flashcards, structure notes, or optimize your daily task schedule.
                  </p>
                </div>

                {/* Starter Suggestions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 px-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Suggested Prompts</span>
                  </div>

                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left p-2.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/70 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-between group cursor-pointer"
                      >
                        <span className="line-clamp-1">{suggestion}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
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
                      className={`flex gap-2.5 ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUser && (
                        <div className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                          <Sparkles className="w-3 h-3" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] ${
                          isUser
                            ? "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-subtle rounded-br-xs"
                            : "flex flex-col gap-1.5"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{textContent}</p>
                        ) : (
                          <>
                            {textContent ? (
                              <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-700/60 rounded-bl-xs">
                                <div className="prose prose-zinc prose-xs dark:prose-invert max-w-none space-y-2">
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
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60"
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
                                          <Loader2 className="w-3 h-3 animate-spin text-zinc-400 ml-0.5" />
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
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
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
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60"
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
                                          <Loader2 className="w-3 h-3 animate-spin text-zinc-400 ml-0.5" />
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={tool.toolCallId || `tool-generic-${idx}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-2xs transition-all ${
                                        isError
                                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60"
                                      }`}
                                    >
                                      <span>⚙️</span>
                                      <span>{tool.toolName}</span>
                                      {isCall && (
                                        <Loader2 className="w-3 h-3 animate-spin text-zinc-400 ml-0.5" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Fallback if neither text nor tools have arrived yet during stream */}
                            {!textContent && toolInvocations.length === 0 && (
                              <div className="rounded-2xl px-4 py-3 text-xs leading-relaxed bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-500 border border-zinc-200/60 dark:border-zinc-700/60 rounded-bl-xs flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600 dark:text-zinc-300" />
                                <span>Thinking...</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {isUser && (
                        <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                          <User className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex gap-2.5 justify-start items-center">
                    <div className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs">
                      <Sparkles className="w-3 h-3 animate-spin" />
                    </div>
                    <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 rounded-2xl rounded-bl-xs px-3.5 py-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error.message || "Failed to reach AI service"}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Footer Form */}
          <div className="p-3 border-t border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Copilot anything..."
                className="flex-1 px-3.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
              />

              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer shrink-0"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 transition-colors cursor-pointer shrink-0 disabled:cursor-not-allowed shadow-2xs"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Copilot;
