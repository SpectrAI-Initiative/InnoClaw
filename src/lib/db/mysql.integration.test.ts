import { afterAll, beforeAll, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { SETUP_TIMEOUT_MS, describeMysql, setUpTestDatabase } from "./test-mysql";

/**
 * End-to-end checks of the MySQL schema against a real server: migrations,
 * defaults, collation, constraints, cascades and the vector store.
 * Runs only when TEST_DATABASE_URL is set (see ./test-mysql.ts).
 */
describeMysql("MySQL schema integration", () => {
  let dbModule: typeof import("./index");
  let schema: typeof import("./schema");
  let errors: typeof import("./errors");
  let helpers: typeof import("./sql-helpers");
  let vectors: typeof import("@/lib/rag/vector-store");

  const db = () => dbModule.db;

  async function createWorkspace(id: string, folderPath = `/research/${id}`) {
    await db().insert(schema.workspaces).values({ id, name: id, folderPath });
  }

  async function createChunk(workspaceId: string, sourceId: string, chunkId: string, content = "text") {
    await db()
      .insert(schema.sources)
      .values({
        id: sourceId,
        workspaceId,
        relativePath: `${sourceId}.md`,
        fileName: `${sourceId}.md`,
        fileType: "md",
        fileHash: "hash",
        rawContent: content,
        lastModified: "2026-11-24T00:00:00.000Z",
      })
      .onDuplicateKeyUpdate({ set: { fileHash: "hash" } });
    await db().insert(schema.sourceChunks).values({
      id: chunkId,
      sourceId,
      workspaceId,
      chunkIndex: 0,
      content,
    });
  }

  beforeAll(async () => {
    await setUpTestDatabase("schema");
    dbModule = await import("./index");
    schema = await import("./schema");
    errors = await import("./errors");
    helpers = await import("./sql-helpers");
    vectors = await import("@/lib/rag/vector-store");
   }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await dbModule?.closeDb();
  });

  it("creates every table with the binary utf8mb4 collation", async () => {
    const [rows] = await dbModule.getPool().query(
      `SELECT table_name AS name, table_collation AS collation
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name <> '__drizzle_migrations'`,
    );
    const tables = rows as Array<{ name: string; collation: string }>;
    expect(tables.length).toBe(23);
    expect(new Set(tables.map((t) => t.collation))).toEqual(new Set(["utf8mb4_bin"]));
  });

  it("fills created_at with UTC text in SQLite's datetime('now') format", async () => {
    await createWorkspace("ws-defaults");
    const [row] = await db()
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, "ws-defaults"));

    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const asUtc = Date.parse(row.createdAt.replace(" ", "T") + "Z");
    expect(Math.abs(Date.now() - asUtc)).toBeLessThan(5 * 60_000);
    expect(row.isGitRepo).toBe(false);
  });

  it("round-trips booleans, big integers and large UTF-8 text", async () => {
    await createWorkspace("ws-types");
    await db().update(schema.workspaces).set({ isGitRepo: true }).where(eq(schema.workspaces.id, "ws-types"));

    const big = "章节🧪 ".repeat(40_000); // ~280 KB, beyond TEXT's 64 KB limit
    await createChunk("ws-types", "src-types", "chunk-types", big);
    await db().insert(schema.hfDatasets).values({
      id: "ds-big",
      name: "big",
      repoId: "org/big",
      sizeBytes: 5_000_000_000,
    });

    const [ws] = await db().select().from(schema.workspaces).where(eq(schema.workspaces.id, "ws-types"));
    const [src] = await db().select().from(schema.sources).where(eq(schema.sources.id, "src-types"));
    const [ds] = await db().select().from(schema.hfDatasets).where(eq(schema.hfDatasets.id, "ds-big"));

    expect(ws.isGitRepo).toBe(true);
    expect(src.rawContent).toBe(big);
    expect(ds.sizeBytes).toBe(5_000_000_000);
    expect(ds.status).toBe("pending");
  });

  it("reports unique violations through isUniqueConstraintError", async () => {
    await createWorkspace("ws-unique-a", "/research/shared");
    const error = await createWorkspace("ws-unique-b", "/research/shared").catch((e: unknown) => e);
    expect(errors.isUniqueConstraintError(error)).toBe(true);
  });

  it("keeps equality and uniqueness case-sensitive, like SQLite", async () => {
    await createWorkspace("ws-case-upper", "/research/CaseDir");
    await createWorkspace("ws-case-lower", "/research/casedir");

    const exact = await db()
      .select({ id: schema.workspaces.id })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.folderPath, "/research/casedir"));
    expect(exact.map((r) => r.id)).toEqual(["ws-case-lower"]);
  });

  it("matches LIKE case-insensitively through likeIgnoreCase", async () => {
    await createWorkspace("ws-like");
    await createChunk("ws-like", "src-like", "chunk-like", "Transformer Models for Batteries");

    const hits = await db()
      .select({ id: schema.sourceChunks.id })
      .from(schema.sourceChunks)
      .where(and(
        eq(schema.sourceChunks.workspaceId, "ws-like"),
        helpers.likeIgnoreCase(schema.sourceChunks.content, "%transformer%"),
      ));
    expect(hits.map((h) => h.id)).toEqual(["chunk-like"]);

    const escaped = await db()
      .select({ id: schema.sourceChunks.id })
      .from(schema.sourceChunks)
      .where(helpers.likeIgnoreCase(schema.sourceChunks.content, "%\\%%"));
    expect(escaped).toEqual([]);
  });

  it("allows many NULL report dates but only one daily report per day", async () => {
    await createWorkspace("ws-notes");
    const note = (id: string, type: "manual" | "daily_report", reportDate: string | null) =>
      db().insert(schema.notes).values({ id, workspaceId: "ws-notes", title: id, content: "", type, reportDate });

    await note("n1", "manual", null);
    await note("n2", "manual", null);
    await note("d1", "daily_report", "2026-11-24");
    const dup = await note("d2", "daily_report", "2026-11-24").catch((e: unknown) => e);

    expect(errors.isUniqueConstraintError(dup)).toBe(true);
    const manual = await db()
      .select()
      .from(schema.notes)
      .where(and(eq(schema.notes.workspaceId, "ws-notes"), isNull(schema.notes.reportDate)));
    expect(manual).toHaveLength(2);
  });

  it("supports relational queries and rolls back failed transactions", async () => {
    await createWorkspace("ws-tx");
    const found = await db().query.workspaces.findFirst({ where: eq(schema.workspaces.id, "ws-tx") });
    expect(found?.name).toBe("ws-tx");

    await expect(
      db().transaction(async (tx) => {
        await tx.update(schema.workspaces).set({ name: "renamed" }).where(eq(schema.workspaces.id, "ws-tx"));
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    const [after] = await db().select().from(schema.workspaces).where(eq(schema.workspaces.id, "ws-tx"));
    expect(after.name).toBe("ws-tx");
  });

  it("stores, replaces, searches and deletes embeddings", async () => {
    await createWorkspace("ws-vec");
    await createChunk("ws-vec", "src-vec", "c-x");
    await db().insert(schema.sourceChunks).values([
      { id: "c-y", sourceId: "src-vec", workspaceId: "ws-vec", chunkIndex: 1, content: "y" },
      { id: "c-z", sourceId: "src-vec", workspaceId: "ws-vec", chunkIndex: 2, content: "z" },
    ]);

    await vectors.insertEmbeddings([
      { chunkId: "c-x", embedding: [1, 0, 0] },
      { chunkId: "c-y", embedding: [0, 1, 0] },
      { chunkId: "c-z", embedding: [0.7, 0.7, 0] },
    ]);
    // Replace c-y so it becomes the best match for [0, 0, 1]
    await vectors.insertEmbedding("c-y", [0, 0, 1]);

    const top = await vectors.searchSimilar([0, 0.1, 1], "ws-vec", 2);
    expect(top.map((r) => r.chunkId)).toEqual(["c-y", "c-z"]);

    const [stored] = await db()
      .select()
      .from(schema.chunkEmbeddings)
      .where(eq(schema.chunkEmbeddings.chunkId, "c-y"));
    expect(vectors.decodeEmbedding(stored.embedding)).toEqual([0, 0, 1]);

    await vectors.deleteEmbeddings(["c-z"]);
    const remaining = await db().select({ id: schema.chunkEmbeddings.chunkId }).from(schema.chunkEmbeddings);
    expect(remaining.map((r) => r.id).sort()).toEqual(["c-x", "c-y"]);
  });

  it("cascades a workspace delete to sources, chunks and embeddings", async () => {
    await createWorkspace("ws-cascade");
    await createChunk("ws-cascade", "src-cascade", "c-cascade");
    await vectors.insertEmbeddings([{ chunkId: "c-cascade", embedding: [1, 2, 3] }]);

    await db().delete(schema.workspaces).where(eq(schema.workspaces.id, "ws-cascade"));

    expect(await db().select().from(schema.sources).where(eq(schema.sources.id, "src-cascade"))).toEqual([]);
    expect(await db().select().from(schema.sourceChunks).where(eq(schema.sourceChunks.id, "c-cascade"))).toEqual([]);
    expect(
      await db().select().from(schema.chunkEmbeddings).where(eq(schema.chunkEmbeddings.chunkId, "c-cascade")),
    ).toEqual([]);
  });
});
