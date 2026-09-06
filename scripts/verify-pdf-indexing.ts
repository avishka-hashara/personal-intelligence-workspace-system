import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import {
  users,
  courses,
  courseResources,
  chunks,
} from "../src/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { indexResource } from "../src/server/actions/indexing";

/**
 * Generates a minimal, valid multi-page PDF buffer in memory.
 */
function createMinimalPdfBuffer(pages: string[]): Buffer {
  let objects: string[] = [];
  let offsets: number[] = [];

  // Header
  let pdf = "%PDF-1.4\n";

  function addObject(content: string): number {
    offsets.push(pdf.length);
    const objNum = objects.length + 1;
    const fullObj = `${objNum} 0 obj\n${content}\nendobj\n`;
    pdf += fullObj;
    objects.push(fullObj);
    return objNum;
  }

  // 1: Catalog
  const catalogNum = 1;
  // 2: Pages root
  const pagesRootNum = 2;
  // Font
  const fontNum = 3;

  // We will build Page and Content objects
  const pageObjNums: number[] = [];

  // Placeholder catalog & pages objects
  offsets.push(pdf.length);
  pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  objects.push("catalog");

  offsets.push(pdf.length);
  // We'll rewrite pages object offset in a moment or construct cleanly
  // Let's use a standard synthetic PDF format:
  return createSimplePdf(pages);
}

function createSimplePdf(pageTexts: string[]): Buffer {
  // Construct standard valid PDF
  const streamObjs = pageTexts.map((text) => {
    const stream = `BT /F1 12 Tf 50 700 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
    return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let lines: string[] = ["%PDF-1.4"];
  let xrefs: number[] = [0];

  function add(obj: string) {
    const offset = lines.join("\n").length + (lines.length > 0 ? 1 : 0);
    xrefs.push(offset);
    lines.push(`${xrefs.length - 1} 0 obj\n${obj}\nendobj`);
  }

  // Obj 1: Catalog
  add("<< /Type /Catalog /Pages 2 0 R >>");

  // Placeholders for Pages root and Font
  // We'll calculate IDs:
  // 1: Catalog
  // 2: Pages root
  // 3: Font
  // 4..4+N-1: Content streams
  // 4+N..4+2N-1: Pages
  const N = pageTexts.length;
  const pageKids = [];
  for (let i = 0; i < N; i++) {
    pageKids.push(`${4 + N + i} 0 R`);
  }

  // Obj 2: Pages
  add(`<< /Type /Pages /Kids [${pageKids.join(" ")}] /Count ${N} >>`);

  // Obj 3: Font
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  // Objs 4..4+N-1: Contents
  for (let i = 0; i < N; i++) {
    add(streamObjs[i]);
  }

  // Objs 4+N..4+2N-1: Pages
  for (let i = 0; i < N; i++) {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${4 + i} 0 R >>`);
  }

  const startxref = lines.join("\n").length + 1;
  lines.push("xref");
  lines.push(`0 ${xrefs.length}`);
  lines.push("0000000000 65535 f ");
  for (let i = 1; i < xrefs.length; i++) {
    lines.push(xrefs[i].toString().padStart(10, "0") + " 00000 n ");
  }
  lines.push("trailer");
  lines.push(`<< /Size ${xrefs.length} /Root 1 0 R >>`);
  lines.push("startxref");
  lines.push(`${startxref}`);
  lines.push("%%EOF");

  return Buffer.from(lines.join("\n"), "utf8");
}

async function verifyPdfIndexing() {
  console.log("=== STARTING PDF INDEXING & CHUNKING VERIFICATION ===\n");

  // 1. Get an existing user
  let [user] = await db.select().from(users).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email: "indexing-test@piw.local", displayName: "Index Tester" })
      .returning();
  }
  console.log(`✓ Using user: ${user.email} (${user.id})`);

  // 2. Create or find a course
  let [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.userId, user.id))
    .limit(1);

  if (!course) {
    [course] = await db
      .insert(courses)
      .values({
        userId: user.id,
        code: "CS3230",
        title: "Design and Analysis of Algorithms",
        term: "Fall 2026",
      })
      .returning();
  }
  console.log(`✓ Using course: ${course.code} - ${course.title} (${course.id})`);

  // 3. Create a course resource for PDF
  const [resource] = await db
    .insert(courseResources)
    .values({
      userId: user.id,
      courseId: course.id,
      title: "Lecture 4: Amortized Analysis and Union-Find",
      url: "https://example.com/lecture4.pdf",
      resourceType: "pdf",
      indexStatus: "indexing",
    })
    .returning();
  console.log(`✓ Created test resource: "${resource.title}" (${resource.id})`);

  // 4. Generate a synthetic 2-page PDF
  const page1Text = "Amortized analysis considers the average performance of each operation in the worst case sequence of operations. This provides a guaranteed upper bound on the time required per operation.";
  const page2Text = "The Disjoint-Set or Union-Find data structure supports union and find operations efficiently using path compression and union by rank heuristics to achieve inverse Ackermann runtime.";

  const pdfBuffer = createSimplePdf([page1Text, page2Text]);
  console.log(`✓ Created test PDF buffer: ${pdfBuffer.length} bytes, 2 pages`);

  // 5. Execute indexResource
  console.log("\nExecuting indexResource(resource.id, pdfBuffer)...");
  const indexResult = await indexResource(resource.id, pdfBuffer);
  console.log("indexResource returned:", indexResult);

  if (!indexResult.success) {
    throw new Error(`Indexing failed: ${indexResult.error}`);
  }

  // 6. Verify course_resources in DB
  const [updatedResource] = await db
    .select()
    .from(courseResources)
    .where(eq(courseResources.id, resource.id))
    .limit(1);

  console.log("\nUpdated course_resources row:");
  console.log(`  indexStatus: '${updatedResource.indexStatus}'`);
  console.log(`  pageCount: ${updatedResource.pageCount}`);
  console.log(`  extractedChars: ${updatedResource.extractedChars}`);

  if (updatedResource.indexStatus !== "ready") {
    throw new Error(`Expected indexStatus = 'ready', got '${updatedResource.indexStatus}'`);
  }
  if (!updatedResource.pageCount || updatedResource.pageCount < 1) {
    throw new Error(`Expected pageCount >= 1, got ${updatedResource.pageCount}`);
  }

  // 7. Verify chunks in DB
  const storedChunks = await db
    .select()
    .from(chunks)
    .where(eq(chunks.entityId, resource.id));

  console.log(`\nStored chunks count in DB: ${storedChunks.length}`);
  storedChunks.forEach((c, idx) => {
    console.log(`  Chunk [${idx}]:`);
    console.log(`    contextHeader: "${c.contextHeader}"`);
    console.log(`    tokenCount: ${c.tokenCount}`);
    console.log(`    content snippet: "${c.content.slice(0, 70)}..."`);
    console.log(`    embedding populated: ${c.embedding !== null ? "YES (vector stored)" : "NO"}`);
  });

  if (storedChunks.length === 0) {
    throw new Error("Expected at least 1 chunk to be stored in chunks table");
  }

  const hasContext = storedChunks.every((c) =>
    c.contextHeader.includes("CS3230") && c.contextHeader.includes("Page")
  );
  if (!hasContext) {
    throw new Error("Expected contextHeader to contain Course Code and Page information");
  }

  console.log("\n===============================================================");
  console.log("✓ PDF INDEXING & CHUNKING PIPELINE VERIFIED SUCCESSFULLY!");
  console.log("===============================================================");
}

verifyPdfIndexing()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  });
