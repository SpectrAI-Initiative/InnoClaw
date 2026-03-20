#!/usr/bin/env node
/**
 * Export a deep research session to a structured markdown file.
 * Usage: node scripts/export-session.mjs <sessionId> <outputPath>
 */
import Database from "better-sqlite3";
import { writeFileSync } from "fs";

const sessionId = process.argv[2];
const outputPath = process.argv[3] || `session-${sessionId}.md`;

const db = new Database("data/innoclaw.db", { readonly: true });

// --- Session ---
const session = db.prepare(`
  SELECT * FROM deep_research_sessions WHERE id = ?
`).get(sessionId);

if (!session) {
  console.error(`Session ${sessionId} not found`);
  process.exit(1);
}

const config = JSON.parse(session.config_json || "{}");
const budget = JSON.parse(session.budget_json || "{}");

// --- Messages ---
const messages = db.prepare(`
  SELECT * FROM deep_research_messages
  WHERE session_id = ? ORDER BY created_at ASC
`).all(sessionId);

// --- Nodes ---
const nodes = db.prepare(`
  SELECT * FROM deep_research_nodes
  WHERE session_id = ? ORDER BY created_at ASC
`).all(sessionId);

// --- Artifacts ---
const artifacts = db.prepare(`
  SELECT * FROM deep_research_artifacts
  WHERE session_id = ? ORDER BY created_at ASC
`).all(sessionId);

// --- Events ---
const events = db.prepare(`
  SELECT * FROM deep_research_events
  WHERE session_id = ? ORDER BY created_at ASC
`).all(sessionId);

db.close();

// ============================================================
// Build Markdown
// ============================================================

let md = "";

// Header
md += `# Deep Research Session: ${session.title}\n\n`;
md += `> **Session ID**: \`${session.id}\`\n`;
md += `> **Status**: ${session.status} | **Phase**: ${session.phase}\n`;
md += `> **Created**: ${session.created_at} | **Updated**: ${session.updated_at}\n`;
md += `> **Literature Rounds**: ${session.literature_round} | **Reviewer Rounds**: ${session.reviewer_round} | **Execution Loops**: ${session.execution_loop}\n`;
if (session.error) md += `> **Error**: ${session.error}\n`;
md += "\n---\n\n";

// Config
md += `## Configuration\n\n`;
md += "```json\n" + JSON.stringify(config, null, 2) + "\n```\n\n";

// Budget
md += `## Budget Usage\n\n`;
md += "```json\n" + JSON.stringify(budget, null, 2) + "\n```\n\n";
md += "---\n\n";

// Conversation
md += `## Conversation (${messages.length} messages)\n\n`;
for (const msg of messages) {
  const roleLabel = msg.role === "user" ? "👤 User" : "🧠 Main Brain";
  const time = msg.created_at;
  md += `### ${roleLabel} — ${time}\n\n`;

  if (msg.related_node_id) {
    const node = nodes.find(n => n.id === msg.related_node_id);
    md += `> Related node: \`${msg.related_node_id}\`${node ? ` (${node.label})` : ""}\n`;
  }
  if (msg.related_artifact_ids_json) {
    try {
      const artIds = JSON.parse(msg.related_artifact_ids_json);
      if (artIds.length > 0) {
        md += `> Related artifacts: ${artIds.map(id => `\`${id}\``).join(", ")}\n`;
      }
    } catch {}
  }

  md += "\n" + msg.content + "\n\n";
}
md += "---\n\n";

// Workflow Nodes
md += `## Workflow Nodes (${nodes.length})\n\n`;
md += "| # | ID | Type | Label | Status | Phase | Role | Model |\n";
md += "|---|---|---|---|---|---|---|---|\n";
nodes.forEach((n, i) => {
  md += `| ${i + 1} | \`${n.id.slice(0, 12)}…\` | ${n.node_type} | ${n.label.slice(0, 50)} | **${n.status}** | ${n.phase} | ${n.assigned_role} | ${n.assigned_model || "-"} |\n`;
});
md += "\n";

// Node details
md += `### Node Details\n\n`;
for (const n of nodes) {
  md += `#### ${n.label}\n\n`;
  md += `- **ID**: \`${n.id}\`\n`;
  md += `- **Type**: ${n.node_type} | **Status**: ${n.status} | **Phase**: ${n.phase}\n`;
  md += `- **Role**: ${n.assigned_role} | **Model**: ${n.assigned_model || "default"}\n`;

  const deps = JSON.parse(n.depends_on_json || "[]");
  if (deps.length > 0) md += `- **Depends on**: ${deps.map(d => `\`${d}\``).join(", ")}\n`;

  md += `- **Requirement version**: ${n.requirement_version}\n`;
  md += `- **Created**: ${n.created_at} | **Updated**: ${n.updated_at}\n`;

  if (n.input_json) {
    try {
      const input = JSON.parse(n.input_json);
      if (Object.keys(input).length > 0) {
        md += `\n**Input:**\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n`;
      }
    } catch {}
  }
  if (n.output_json) {
    try {
      const output = JSON.parse(n.output_json);
      if (Object.keys(output).length > 0) {
        const outputStr = JSON.stringify(output, null, 2);
        // Truncate very long outputs
        if (outputStr.length > 5000) {
          md += `\n**Output** (truncated):\n\`\`\`json\n${outputStr.slice(0, 5000)}\n... [truncated, ${outputStr.length} chars total]\n\`\`\`\n`;
        } else {
          md += `\n**Output:**\n\`\`\`json\n${outputStr}\n\`\`\`\n`;
        }
      }
    } catch {}
  }
  md += "\n";
}
md += "---\n\n";

// Artifacts
md += `## Artifacts (${artifacts.length})\n\n`;
for (const a of artifacts) {
  md += `### ${a.title}\n\n`;
  md += `- **ID**: \`${a.id}\`\n`;
  md += `- **Type**: ${a.artifact_type}\n`;
  md += `- **Created**: ${a.created_at}\n`;

  if (a.provenance_json) {
    try {
      const prov = JSON.parse(a.provenance_json);
      if (prov.model) md += `- **Model**: ${prov.model}\n`;
      if (prov.sourceNodeId) md += `- **Source node**: \`${prov.sourceNodeId}\`\n`;
    } catch {}
  }

  if (a.content_json) {
    try {
      const content = JSON.parse(a.content_json);
      const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);
      if (contentStr.length > 10000) {
        md += `\n**Content** (truncated):\n\`\`\`json\n${contentStr.slice(0, 10000)}\n... [truncated, ${contentStr.length} chars total]\n\`\`\`\n`;
      } else {
        md += `\n**Content:**\n\`\`\`json\n${contentStr}\n\`\`\`\n`;
      }
    } catch {}
  }
  md += "\n";
}
md += "---\n\n";

// Events summary
md += `## Events (${events.length})\n\n`;
md += "| # | Type | Node | Actor | Time |\n";
md += "|---|---|---|---|---|\n";
events.forEach((e, i) => {
  md += `| ${i + 1} | ${e.event_type} | ${e.node_id ? `\`${e.node_id.slice(0, 12)}…\`` : "-"} | ${e.actor_type || "-"} | ${e.created_at} |\n`;
});
md += "\n";

// Event details (only for significant events)
const significantEvents = events.filter(e =>
  ["phase_transition", "checkpoint_created", "user_confirmation", "consistency_check", "dag_validation"].includes(e.event_type)
);
if (significantEvents.length > 0) {
  md += `### Significant Event Details\n\n`;
  for (const e of significantEvents) {
    md += `#### ${e.event_type} — ${e.created_at}\n\n`;
    if (e.payload_json) {
      try {
        const payload = JSON.parse(e.payload_json);
        const payloadStr = JSON.stringify(payload, null, 2);
        if (payloadStr.length > 3000) {
          md += "```json\n" + payloadStr.slice(0, 3000) + "\n... [truncated]\n```\n\n";
        } else {
          md += "```json\n" + payloadStr + "\n```\n\n";
        }
      } catch {}
    }
  }
}

md += "---\n\n";
md += `*Exported at ${new Date().toISOString()}*\n`;

writeFileSync(outputPath, md, "utf-8");
console.log(`Exported session to ${outputPath} (${(md.length / 1024).toFixed(1)} KB)`);
