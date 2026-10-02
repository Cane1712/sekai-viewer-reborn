import type { MysekaiPagination } from "$lib/domain/mysekai";

export type PagedResult<T> = { items: T[]; pagination: MysekaiPagination };

/**
 * One streamed first page plus pages appended on demand. A reset (new region or query)
 * drops responses that arrive for the previous list.
 */
export class PagedList<T> {
  items = $state<T[]>([]);
  status = $state<"loading" | "error" | "ready">("loading");
  hasNext = $state(false);
  isLoadingMore = $state(false);
  loadMoreError = $state(false);
  #page = 1;
  #requestId = 0;
  readonly #keyOf: (item: T) => string | number;

  constructor(keyOf: (item: T) => string | number) {
    this.#keyOf = keyOf;
  }

  reset(firstPage: Promise<PagedResult<T> | null>): void {
    const requestId = ++this.#requestId;
    this.items = [];
    this.status = "loading";
    this.hasNext = false;
    this.isLoadingMore = false;
    this.loadMoreError = false;
    this.#page = 1;
    void firstPage
      .then((result) => {
        if (requestId !== this.#requestId) return;
        if (!result) {
          this.status = "error";
          return;
        }
        this.items = result.items;
        this.#page = result.pagination.page;
        this.hasNext = result.pagination.hasNext;
        this.status = "ready";
      })
      .catch(() => {
        if (requestId === this.#requestId) this.status = "error";
      });
  }

  async loadMore(fetchPage: (page: number) => Promise<PagedResult<T>>): Promise<void> {
    if (this.isLoadingMore || !this.hasNext || this.status !== "ready") return;
    const requestId = this.#requestId;
    this.isLoadingMore = true;
    this.loadMoreError = false;
    try {
      const next = await fetchPage(this.#page + 1);
      if (requestId !== this.#requestId) return;
      // A plain lookup: this runs once per page and never needs to be reactive.
      const seen: Record<string, true> = Object.fromEntries(
        this.items.map((item) => [String(this.#keyOf(item)), true])
      );
      this.items = [
        ...this.items,
        ...next.items.filter((item) => !seen[String(this.#keyOf(item))])
      ];
      this.#page = next.pagination.page;
      this.hasNext = next.pagination.hasNext;
    } catch {
      if (requestId === this.#requestId) this.loadMoreError = true;
    } finally {
      if (requestId === this.#requestId) this.isLoadingMore = false;
    }
  }
}

/** Fetches one page from a same-origin data route. */
export const fetchPagedResult = async <T>(href: string): Promise<PagedResult<T>> => {
  const response = await fetch(href);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as PagedResult<T>;
};
