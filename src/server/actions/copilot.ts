"use server";

import { db } from "@/server/db";
import { aiChatSessions, aiChatMessages } from "@/server/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string | null;
  toolCalls?: any;
  createdAt: Date;
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const sessions = await db
      .select()
      .from(aiChatSessions)
      .where(eq(aiChatSessions.userId, user.id))
      .orderBy(desc(aiChatSessions.updatedAt));

    return sessions;
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    // Ensure the session belongs to the user
    const [session] = await db
      .select()
      .from(aiChatSessions)
      .where(and(eq(aiChatSessions.id, sessionId), eq(aiChatSessions.userId, user.id)))
      .limit(1);

    if (!session) return [];

    const messages = await db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.sessionId, sessionId))
      .orderBy(asc(aiChatMessages.createdAt));

    return messages;
  } catch (error) {
    console.error("Error fetching chat messages for session:", sessionId, error);
    return [];
  }
}

export async function deleteChatSession(sessionId: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  try {
    await db
      .delete(aiChatSessions)
      .where(and(eq(aiChatSessions.id, sessionId), eq(aiChatSessions.userId, user.id)));

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting chat session:", sessionId, error);
    return { success: false };
  }
}

export async function generateSessionTitle(firstMessage: string, sessionId: string): Promise<string> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return "New Chat";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Personal Intelligence Workspace",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful title generator. Summarize the user's first prompt into a short, descriptive 3-4 word title. Do NOT use quotes, markdown, or punctuation. Return ONLY the title text.",
          },
          {
            role: "user",
            content: firstMessage,
          },
        ],
        max_tokens: 20,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.error("Failed to generate title from OpenRouter:", await response.text());
      return "New Chat";
    }

    const data = await response.json();
    const rawTitle = data.choices?.[0]?.message?.content?.trim() || "New Chat";
    const title = rawTitle.replace(/^["']|["']$/g, "").slice(0, 50);

    if (title) {
      await db
        .update(aiChatSessions)
        .set({ title, updatedAt: new Date() })
        .where(eq(aiChatSessions.id, sessionId));
    }

    return title;
  } catch (error) {
    console.error("Error in generateSessionTitle:", error);
    return "New Chat";
  }
}
