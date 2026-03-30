export function normalizeArxivUrl(url: string): string {
  return url
    .replace(/^http:\/\/export\.arxiv\.org/i, "https://export.arxiv.org")
    .replace(/^http:\/\/(?:www\.)?arxiv\.org/i, "https://arxiv.org");
}

export function normalizeBioRxivUrl(url: string): string {
  return url.replace(/^http:\/\/(?:www\.)?biorxiv\.org/i, "https://www.biorxiv.org");
}

export function extractArxivIdFromUrl(url: string): string | null {
  const normalized = normalizeArxivUrl(url);
  const match = normalized.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?$/i);
  return match ? match[1] : null;
}

export function buildArxivAbsUrl(arxivId: string): string {
  return `https://arxiv.org/abs/${arxivId}`;
}

export function buildArxivPdfUrl(arxivId: string): string {
  return `https://arxiv.org/pdf/${arxivId}`;
}

export function buildBioRxivPdfUrl(url: string): string {
  const normalized = normalizeBioRxivUrl(url).replace(/\/+$/, "");
  return normalized.endsWith(".full.pdf") ? normalized : `${normalized}.full.pdf`;
}
