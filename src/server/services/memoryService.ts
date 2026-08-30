import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { updatePersonaSettings } from "./settingsService";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

export function maybeTriggerRollingMemory(
  userId: string,
  priorSummary: string | null,
  messages: Array<{ role: string; content?: any }>
) {
  // Trigger after every 8 exchanges (16 turns: 8 user + 8 assistant, or multiples of 16)
  if (!Array.isArray(messages) || messages.length < 8) {
    return;
  }

  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length % 8 !== 0) {
    return;
  }

  // Fire background summarization asynchronously without blocking user response
  (async () => {
    try {
      console.log(`[memoryService] Triggering rolling memory update for user ${userId}...`);

      const transcript = messages
        .slice(-16)
        .map((m) => {
          const role = m.role.toUpperCase();
          const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
          return `${role}: ${content}`;
        })
        .join("\n");

      const prompt = `Summarize what matters about this person for a future assistant: what they're working on, what frustrates them, how they prefer answers, anything personal they've shared. Under 120 words, plain prose, no preamble.

Prior summary:
${priorSummary || "None."}

Recent conversation:
${transcript}`;

      const modelName = process.env.OPENROUTER_FAST_MODEL || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

      const { text } = await generateText({
        model: openrouter.chat(modelName),
        providerOptions: {
          openai: {
            maxCompletionTokens: 300,
          },
        },
        prompt,
      });

      const cleanSummary = text.trim();
      if (cleanSummary && cleanSummary.length > 10) {
        await updatePersonaSettings(userId, { memorySummary: cleanSummary });
        console.log(`[memoryService] Memory summary updated for user ${userId}:`, cleanSummary);
      }
    } catch (err) {
      console.error("[memoryService] Error updating rolling memory:", err);
    }
  })();
}
