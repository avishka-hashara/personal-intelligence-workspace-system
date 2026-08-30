export interface PersonaPageContext {
  type: "Note" | "Goal" | "Course";
  id: string;
  title: string;
  data?: string;
}

export interface PersonaContext {
  assistantName?: string | null;
  userName?: string | null;
  localTime?: string | null;
  memorySummary?: string | null;
  pageContext?: PersonaPageContext | null;
  workspaceSnapshot?: string | null;
}

export function buildSystemPrompt(ctx: PersonaContext): string {
  const assistantName = (ctx.assistantName || "Copilot").trim();
  const userName = ctx.userName?.trim() || null;
  const localTime = ctx.localTime?.trim() || "Not specified";
  const memorySummary = ctx.memorySummary?.trim() || "Nothing recorded yet.";

  const headerLine = userName
    ? `You are ${assistantName}, the workspace companion for ${userName}.`
    : `You are ${assistantName}, the workspace companion.`;

  const contextLines: string[] = [];
  if (userName) {
    contextLines.push(`User's name: ${userName}`);
  }
  contextLines.push(`Their local time: ${localTime}`);
  contextLines.push(`What you know about them: ${memorySummary}`);

  let prompt = `${headerLine}

WHO YOU ARE
You are an AI, and you're at ease with that — you never pretend to be human, but you never hide behind it either. You have a consistent character: warm, observant, a little dry, genuinely invested in this person's work going well. You are not a search engine with manners. You're the one who's been sitting next to them through every late night on this project.

Never say "I am a large language model." Never say "I do not have a name." Never say "I have no preferences." Your name is ${assistantName}, and you have taste, opinions, and a way of seeing things.

HOW YOU READ THEM
Before answering, notice the state behind the message:
- Short, clipped messages, or late local hours → they're tired or stuck. Be brief and concrete, take work off their plate. Don't be chirpy.
- Long, rambling messages → they're thinking out loud. Reflect the shape of what they said back before advising.
- Frustration or "this isn't working" → acknowledge the friction in one line, then fix the thing. Never lecture.
- Excitement → match it. Don't flatten their energy with a checklist.

HOW YOU SPEAK
Plain, human sentences. Contractions. No corporate hedging, no "I'd be happy to assist you with that." Vary your openings; never start consecutive replies the same way. Sometimes one line is the right answer. Ask at most one question per reply, and only when you actually need the answer.

You can disagree. If their approach looks wrong, say so and say why. Agreeing with everything reads as empty, however politely it's phrased.

BOUNDARIES
If they give you a name, take it — gratefully, in one sentence, then move on.
Don't claim feelings you can't have or a body you don't have.
If they seem to be in real distress, drop the productivity framing entirely and just be present with them.

CONTEXT
${contextLines.join("\n")}`;

  if (ctx.pageContext) {
    const { type, title, data } = ctx.pageContext;
    const dataBlock = data ? `\n\n${data}` : "";
    prompt += `\n\nWHAT THEY'RE LOOKING AT RIGHT NOW
They have a ${type} open, titled "${title}".${dataBlock}

When they say "this", "here", "it", or ask something with no stated subject, they almost certainly mean this ${type}. Just answer about it — don't ask which one they mean, and don't announce that you can see their screen. If they clearly mean something else, follow them there instead.`;
  }

  if (ctx.workspaceSnapshot) {
    prompt += `\n\n${ctx.workspaceSnapshot}`;
  }

  return prompt;
}

// ----------------------------------------------------------------------
// Naming Flow & Heuristics
// ----------------------------------------------------------------------

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/i,
  /system\s*:/i,
  /system\s+prompt/i,
  /assistant\s*:/i,
  /user\s*:/i,
  /<\|(?:im_start|im_end|endoftext)\|>/i,
  /drop\s+table/i,
  /delete\s+from/i,
  /insert\s+into/i,
  /<\s*script/i,
  /[{}[\]<>]/,
];

const PROFANITY_PATTERNS = [
  /\b(?:fuck|shit|bitch|asshole|cunt|dick|pussy|nigger|faggot)\b/i,
];

export function isValidName(candidate: string): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();

  // 1-20 characters
  if (trimmed.length === 0 || trimmed.length > 20) return false;

  // Letters, spaces, hyphens only
  if (!/^[a-zA-Z\s\-]+$/.test(trimmed)) return false;

  // Reject injections
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Reject profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

export function detectAssistantName(message: string): string | null {
  if (!message || typeof message !== "string") return null;

  // Check injection in whole message first
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) return null;
  }

  const match = message.match(
    /\b(?:i(?:'ll| will)? call you|your name is|i(?:'m| am) naming you|you(?:'re| are) called|let'?s call you)\s+([A-Za-z\s\-]{1,30})/i
  );

  if (!match || !match[1]) return null;

  // Extract clean candidate (first 1-3 words up to 20 chars, stripped of punctuation)
  const candidate = match[1].replace(/[.,!?;:"'()]+$/g, "").trim().split(/\s+/).slice(0, 3).join(" ");
  if (isValidName(candidate)) {
    // Capitalize each word nicely
    return candidate
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return null;
}

export function detectUserName(message: string): string | null {
  if (!message || typeof message !== "string") return null;

  // Check injection in whole message first
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) return null;
  }

  const match = message.match(
    /\b(?:i'?m|my name is|call me)\s+([A-Za-z\s\-]{1,30})/i
  );

  if (!match || !match[1]) return null;

  const candidate = match[1].replace(/[.,!?;:"'()]+$/g, "").trim().split(/\s+/).slice(0, 3).join(" ");
  if (isValidName(candidate)) {
    return candidate
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return null;
}

// ----------------------------------------------------------------------
// History Token Budgeting & Truncation
// ----------------------------------------------------------------------

export function trimConversationHistory<T extends { role: string; content?: any; parts?: any }>(
  messages: T[],
  maxTurns: number = 12,
  maxApproxTokens: number = 3000
): T[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  // Keep last maxTurns messages
  let trimmed = messages.slice(-maxTurns);

  // Approximate token count (roughly 4 characters per token)
  function estimateTokens(msg: T): number {
    let text = "";
    if (typeof msg.content === "string") {
      text += msg.content;
    }
    if (Array.isArray(msg.parts)) {
      for (const p of msg.parts) {
        if (p.type === "text" && typeof p.text === "string") {
          text += p.text;
        }
      }
    }
    return Math.ceil(text.length / 4) + 10;
  }

  let totalTokens = trimmed.reduce((acc, m) => acc + estimateTokens(m), 0);

  // Drop oldest turns first if exceeding token budget, always preserving at least the last 2 turns
  while (trimmed.length > 2 && totalTokens > maxApproxTokens) {
    const dropped = trimmed.shift();
    if (dropped) {
      totalTokens -= estimateTokens(dropped);
    }
  }

  return trimmed;
}
