import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPagedResult, PagedList, type PagedResult } from "./paged-list.svelte";

type Item = { id: number };

const result = (ids: number[], page: number, hasNext: boolean): PagedResult<Item> => ({
  items: ids.map((id) => ({ id })),
  pagination: { page, pageSize: 2, total: null, hasNext }
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PagedList", () => {
  it("shows the first page, then appends new items from the next page", async () => {
    const list = new PagedList<Item>((item) => item.id);
    list.reset(Promise.resolve(result([1, 2], 1, true)));
    expect(list.status).toBe("loading");
    await flush();
    expect(list.status).toBe("ready");

    const fetchPage = vi.fn(async (page: number) => result([2, 3], page, false));
    await list.loadMore(fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(2);
    expect(list.items.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(list.hasNext).toBe(false);
    expect(list.isLoadingMore).toBe(false);

    // Nothing is left to load.
    await list.loadMore(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("shows an error for a missing or failed first page", async () => {
    const list = new PagedList<Item>((item) => item.id);
    list.reset(Promise.resolve(null));
    await flush();
    expect(list.status).toBe("error");

    list.reset(Promise.reject(new Error("offline")));
    await flush();
    expect(list.status).toBe("error");
  });

  it("keeps loaded items and flags a failed next page", async () => {
    const list = new PagedList<Item>((item) => item.id);
    list.reset(Promise.resolve(result([1], 1, true)));
    await flush();

    await list.loadMore(() => Promise.reject(new Error("offline")));

    expect(list.loadMoreError).toBe(true);
    expect(list.items).toEqual([{ id: 1 }]);
    expect(list.isLoadingMore).toBe(false);
  });

  it("drops responses for a list that was reset meanwhile", async () => {
    const list = new PagedList<Item>((item) => item.id);
    let resolveFirst: (value: PagedResult<Item>) => void = () => {};
    list.reset(new Promise((resolve) => (resolveFirst = resolve)));
    list.reset(Promise.resolve(result([9], 1, true)));
    resolveFirst(result([1], 1, false));
    await flush();
    expect(list.items).toEqual([{ id: 9 }]);

    let resolveNext: (value: PagedResult<Item>) => void = () => {};
    const pending = list.loadMore(() => new Promise((resolve) => (resolveNext = resolve)));
    list.reset(Promise.resolve(result([20], 1, false)));
    resolveNext(result([10], 2, false));
    await pending;
    await flush();

    expect(list.items).toEqual([{ id: 20 }]);
  });
});

describe("fetchPagedResult", () => {
  it("returns the page and throws on a failed response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(result([1], 2, false))))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPagedResult<Item>("/data?page=2")).resolves.toEqual(result([1], 2, false));
    await expect(fetchPagedResult<Item>("/data?page=3")).rejects.toThrow("500");
  });
});
