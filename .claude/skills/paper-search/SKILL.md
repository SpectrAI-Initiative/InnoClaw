---
name: "Paper Search"
description: "Use when the user wants keyword-based academic paper discovery in Paper Study, including requests to search papers by topic, date range, or source such as arXiv, Semantic Scholar, bioRxiv, PubMed, Hugging Face daily papers, or similar Chinese requests about paper search."
allowed-tools:
  - searchArticles
  - readPaper
---

# Paper Search

Use this skill when the user already has a concrete topic, keyword set, date window, or source constraint. The goal is to turn a clear retrieval intent into a high-quality shortlist of papers, not to broaden the problem unnecessarily.

## Input Framing

- Extract `1-6` compact technical keywords and preserve the user's original terminology whenever it is specific enough.
- Track optional constraints: `dateFrom`, `dateTo`, `sources`, and `maxResults`.
- If the user is asking for a class of papers rather than one known paper, do not collapse the task into a single-paper lookup.

## Retrieval Strategy

1. If the user provides keywords, search the requested sources. If no sources are specified, search the full academic source set.
2. If the user provides no usable keywords, do not pretend a general search was performed. Fall back only where the available tooling genuinely supports keyword-free discovery.
3. Default source set:
   - `arxiv`
   - `huggingface`
   - `semantic-scholar`
   - `biorxiv`
   - `pubmed`
   - `pubchem`
4. Rank results by:
   - strong title relevance
   - abstract-level topic match
   - recency when the task is time-sensitive
   - completeness and trustworthiness of metadata

## Output Requirements

- Respond in the user's language unless they explicitly ask otherwise.
- Start with `1-2` short sentences summarizing the search topic, constraints, and sources used.
- Then present the papers ordered by relevance. Each paper should include at least:
  - original English title
  - authors
  - publication date
  - source
  - one concrete sentence on why it matches
- If quality clearly separates, split the list into `Priority reads` and `Supplementary`.
- If there are no strong matches, say so directly and propose better keywords for the next round.

## Quality Rules

- Do not fabricate authors, dates, results, or conclusions.
- Keep paper titles in their original form rather than translating them.
- Relevance notes must be specific about the method, task, benchmark, or application match.
- When near-duplicate results appear, prefer the newer or more complete entry.
