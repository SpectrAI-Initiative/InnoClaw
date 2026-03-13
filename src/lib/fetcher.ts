export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${url} ${res.status}`);
  }
  return res.json();
}

/** Simple JSON fetcher for useSWR — no error body extraction. */
export const swrFetcher = (url: string) => fetch(url).then((r) => r.json());
