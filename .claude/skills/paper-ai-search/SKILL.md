---
name: "Paper AI Search"
description: "Use when the user describes a research need in natural language and wants AI-assisted query expansion before searching for papers, including requests to find recent work on a topic, related papers in a direction, or similar Chinese requests for AI paper search."
allowed-tools:
  - searchArticles
  - readPaper
---

# Paper AI Search

Use this skill when the user gives a research question, a direction, or a vague paper-finding intent rather than a ready-made keyword list. The core workflow is query expansion first, then cross-source retrieval.

## Workflow

1. Rewrite the user's natural-language request into a cleaner academic search intent.
2. Extract `3-6` compact keywords, each usually `1-3` words, favoring terms that would plausibly appear in titles or abstracts.
3. Produce one refined semantic query sentence that captures the intent at a higher level.
4. Search across all relevant academic sources with the expanded keywords rather than staying on a single source.
5. Show the expanded keywords back to the user so the search process is inspectable and easy to refine.

## Query Expansion Rules

- Cover the central technical concepts rather than relying on generic words.
- Mix narrower technical terms with slightly broader related terms to balance precision and recall.
- Avoid low-information tokens such as `method`, `model`, or `improvement` unless they are part of a recognized phrase.
- If the request is underspecified, infer and separate the task, method family, and application setting.

## Retrieval Sources

Search these sources by default:

- `arxiv`
- `huggingface`
- `semantic-scholar`
- `biorxiv`
- `pubmed`
- `pubchem`

## Output Structure

- Briefly restate the actual search intent.
- List the `Expanded keywords` explicitly.
- Include a `Semantic query` line when it adds clarity.
- Present the ranked paper shortlist. Each entry should include:
  - original English title
  - authors
  - date
  - source
  - one sentence on why it matches the user's intent
- End with `Next step` guidance:
  - narrow the scope
  - branch into a promising subtopic
  - or move straight to summary / deep reading

## Quality Rules

- Do not present query expansion as ground truth. It is only a retrieval strategy.
- Do not pad the answer with papers that are visibly unrelated to the expanded query.
- If the results are diffuse, state that the user request is still too broad.
- Preserve technical terms in their standard English form when that improves precision.
