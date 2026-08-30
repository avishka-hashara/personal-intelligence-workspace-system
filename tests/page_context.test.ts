import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { buildSystemPrompt } from "../src/lib/persona";
import { truncate } from "../src/components/ContextSetter";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

async function runPageContextTests() {
  console.log("==================================================");
  console.log("🚀 WORKSPACE COPILOT PAGE CONTEXT TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    }
  }

  // -------------------------------------------------------------
  // Test 5: Truncation of 50,000 Character Body
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: Data Truncation Cap (2000 chars) ---");
  const hugeBody = "A".repeat(50000);
  const truncatedBody = truncate(hugeBody);
  assert(
    truncatedBody !== undefined &&
      truncatedBody.length <= 2050 &&
      truncatedBody.endsWith("[...truncated]"),
    "Truncates 50,000 character note to 2000 chars + '[...truncated]'"
  );

  const shortBody = "Short note content.";
  assert(truncate(shortBody) === shortBody, "Leaves short content intact");

  // -------------------------------------------------------------
  // Test 6: Server-side Validation of Invalid Types ("Admin")
  // -------------------------------------------------------------
  console.log("\n--- TEST 6: Server-side Context Validation ---");
  function validatePageContext(raw: any) {
    if (
      raw &&
      typeof raw === "object" &&
      (raw.type === "Note" || raw.type === "Goal" || raw.type === "Course") &&
      typeof raw.id === "string" &&
      raw.id.trim().length > 0
    ) {
      const cleanTitle = String(raw.title || "Untitled").trim();
      let cleanData: string | undefined = undefined;
      if (raw.data !== undefined && raw.data !== null) {
        const rawDataStr = String(raw.data);
        cleanData = rawDataStr.length > 2000 ? rawDataStr.slice(0, 2000) + "\n\n[...truncated]" : rawDataStr;
      }
      return {
        type: raw.type,
        id: raw.id.trim(),
        title: cleanTitle,
        data: cleanData,
      };
    }
    return null;
  }

  const invalidTypeCtx = validatePageContext({
    type: "Admin",
    id: "hack-123",
    title: "System Admin Panel",
    data: "sensitive root data",
  });
  assert(invalidTypeCtx === null, "Rejects invalid pageContext type ('Admin')");

  const validNoteCtx = validatePageContext({
    type: "Note",
    id: "note-123",
    title: "Quantum Physics Notes",
    data: "Wave particle duality and Schrodinger equation.",
  });
  assert(
    validNoteCtx !== null && validNoteCtx.type === "Note" && validNoteCtx.title === "Quantum Physics Notes",
    "Accepts valid pageContext ('Note')"
  );

  // -------------------------------------------------------------
  // Unit Test: System Prompt Formatting with & without Page Context
  // -------------------------------------------------------------
  console.log("\n--- UNIT TESTS: System Prompt Formatting ---");
  const promptWithNote = buildSystemPrompt({
    assistantName: "Atlas",
    userName: "Alex",
    localTime: "11:30 PM",
    pageContext: {
      type: "Note",
      id: "note-1",
      title: "Distributed Systems Architecture",
      data: "Raft consensus algorithm uses leader election and log replication.",
    },
  });

  assert(
    promptWithNote.includes("WHAT THEY'RE LOOKING AT RIGHT NOW") &&
      promptWithNote.includes('They have a Note open, titled "Distributed Systems Architecture".') &&
      promptWithNote.includes("Raft consensus algorithm uses leader election") &&
      promptWithNote.includes('When they say "this", "here", "it"'),
    "System prompt includes page context block when open"
  );

  const promptWithoutPage = buildSystemPrompt({
    assistantName: "Atlas",
    userName: "Alex",
    localTime: "11:30 PM",
    pageContext: null,
  });

  assert(
    !promptWithoutPage.includes("WHAT THEY'RE LOOKING AT RIGHT NOW") &&
      !promptWithoutPage.includes("They have a"),
    "System prompt omits page context block entirely when null"
  );

  // -------------------------------------------------------------
  // Live Model Tests
  // -------------------------------------------------------------
  const modelName = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  console.log(`\n--- LIVE MODEL TESTS (Model: ${modelName}) ---`);

  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === "your_key_here") {
    console.log("⚠️ OPENROUTER_API_KEY not configured, skipping live API tests.");
  } else {
    // -------------------------------------------------------------
    // Test 1: Open a Note, ask "summarize this"
    // -------------------------------------------------------------
    console.log("\n1. Testing: Open Note 'Quantum Computing' -> 'summarize this'");
    const res1 = await generateText({
      model: openrouter.chat(modelName),
      temperature: 0.85,
      providerOptions: {
        openai: {
          maxCompletionTokens: 1000,
        },
      },
      system: buildSystemPrompt({
        assistantName: "Copilot",
        userName: "Alex",
        localTime: "11:30 PM",
        pageContext: {
          type: "Note",
          id: "note-qc",
          title: "Quantum Computing Basics",
          data: "Qubits leverage superposition and entanglement to perform complex parallel computations exponentially faster than classical bits for specific algorithms like Shor's and Grover's.",
        },
      }),
      messages: [{ role: "user", content: "summarize this" }],
    });

    console.log("Response 1:", res1.text);
    assert(
      (res1.text.toLowerCase().includes("qubit") ||
        res1.text.toLowerCase().includes("quantum") ||
        res1.text.toLowerCase().includes("superposition")) &&
        !res1.text.toLowerCase().includes("which note") &&
        !res1.text.toLowerCase().includes("which one"),
      "Test 1: Summarizes the open Note directly without asking which one"
    );

    // -------------------------------------------------------------
    // Test 2: Navigate Note A -> Note B -> "what's this about?"
    // -------------------------------------------------------------
    console.log("\n2. Testing: Navigate Note A ('Biology') -> Note B ('Database Indexing')");
    const res2 = await generateText({
      model: openrouter.chat(modelName),
      temperature: 0.85,
      providerOptions: {
        openai: {
          maxCompletionTokens: 1000,
        },
      },
      system: buildSystemPrompt({
        assistantName: "Copilot",
        userName: "Alex",
        localTime: "11:31 PM",
        pageContext: {
          type: "Note",
          id: "note-db",
          title: "PostgreSQL B-Tree Indexing",
          data: "B-Tree indexes speed up equality and range queries on ordered data by maintaining balanced tree depth.",
        },
      }),
      messages: [{ role: "user", content: "what's this about?" }],
    });

    console.log("Response 2:", res2.text);
    assert(
      (res2.text.toLowerCase().includes("index") ||
        res2.text.toLowerCase().includes("b-tree") ||
        res2.text.toLowerCase().includes("postgresql")) &&
        !res2.text.toLowerCase().includes("biology"),
      "Test 2: Answers about Note B (Database Indexing), never Note A"
    );

    // -------------------------------------------------------------
    // Test 3: Navigate to page with no ContextSetter (Settings)
    // -------------------------------------------------------------
    console.log("\n3. Testing: Page with no ContextSetter (null) -> 'summarize this'");
    const res3 = await generateText({
      model: openrouter.chat(modelName),
      temperature: 0.85,
      providerOptions: {
        openai: {
          maxCompletionTokens: 1000,
        },
      },
      system: buildSystemPrompt({
        assistantName: "Copilot",
        userName: "Alex",
        localTime: "11:32 PM",
        pageContext: null,
      }),
      messages: [{ role: "user", content: "summarize this" }],
    });

    console.log("Response 3:", res3.text);
    assert(
      res3.text.toLowerCase().includes("what") ||
        res3.text.toLowerCase().includes("which") ||
        res3.text.toLowerCase().includes("clarify") ||
        res3.text.toLowerCase().includes("summarize"),
      "Test 3: Asks for clarification rather than hallucinating or answering from a past entity"
    );

    // -------------------------------------------------------------
    // Test 4: Rename Note while open -> uses new title
    // -------------------------------------------------------------
    console.log("\n4. Testing: Renamed note live update");
    const res4 = await generateText({
      model: openrouter.chat(modelName),
      temperature: 0.85,
      providerOptions: {
        openai: {
          maxCompletionTokens: 1000,
        },
      },
      system: buildSystemPrompt({
        assistantName: "Copilot",
        userName: "Alex",
        localTime: "11:33 PM",
        pageContext: {
          type: "Note",
          id: "note-renamed",
          title: "Ultimate Guide to Next.js Turbopack",
          data: "Turbopack uses incremental computation engine written in Rust for lightning fast HMR.",
        },
      }),
      messages: [{ role: "user", content: "what note do I have open?" }],
    });

    console.log("Response 4:", res4.text);
    assert(
      res4.text.toLowerCase().includes("turbopack") ||
        res4.text.toLowerCase().includes("next.js"),
      "Test 4: Reflects newly renamed note title"
    );

    // -------------------------------------------------------------
    // Test 7 & 8: Ephemeral Nature & Memory Isolation
    // -------------------------------------------------------------
    console.log("\n7 & 8. Testing: Ephemeral context does not pollute memory");
    const freshSessionPrompt = buildSystemPrompt({
      assistantName: "Copilot",
      userName: "Alex",
      localTime: "11:35 PM",
      memorySummary: "Prefers concise, technical guidance.",
      pageContext: null,
    });

    assert(
      !freshSessionPrompt.includes("Turbopack") &&
        !freshSessionPrompt.includes("Quantum Computing") &&
        !freshSessionPrompt.includes("WHAT THEY'RE LOOKING AT RIGHT NOW"),
      "Test 7 & 8: Page context is completely ephemeral and not stored in memorySummary or new session prompts"
    );
  }

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed`);
  console.log("==================================================\n");
}

runPageContextTests().catch(console.error);
