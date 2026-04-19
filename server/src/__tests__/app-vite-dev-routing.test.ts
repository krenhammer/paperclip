import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { shouldServeViteDevHtml } from "../app.js";

function createRequest(
  path: string,
  init: { accept?: string; secFetchDest?: string } = {},
): Request {
  const accept =
    init.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  const headers: Record<string, string> = { accept };
  if (init.secFetchDest !== undefined) {
    headers["sec-fetch-dest"] = init.secFetchDest;
  }
  return { path, headers } as unknown as Request;
}

describe("shouldServeViteDevHtml", () => {
  it("serves HTML shell for document navigations (Accept includes text/html)", () => {
    expect(shouldServeViteDevHtml(createRequest("/"))).toBe(true);
    expect(shouldServeViteDevHtml(createRequest("/issues/abc"))).toBe(true);
  });

  it("skips public assets listed in VITE_DEV_STATIC_PATHS", () => {
    expect(shouldServeViteDevHtml(createRequest("/sw.js"))).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/site.webmanifest"))).toBe(false);
  });

  it("skips vite asset URL prefixes", () => {
    expect(shouldServeViteDevHtml(createRequest("/@vite/client"))).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/src/main.tsx"))).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/vowel-rag/rag-index.yml"))).toBe(false);
  });

  it("never serves HTML for module/asset file extensions (even when Accept is */*)", () => {
    expect(
      shouldServeViteDevHtml(
        createRequest("/some/chunk.js", { accept: "*/*", secFetchDest: "script" }),
      ),
    ).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/deps/foo.js", { accept: "*/*" }))).toBe(false);
    expect(shouldServeViteDevHtml(createRequest("/assets/index-abc123.js", { accept: "*/*" }))).toBe(
      false,
    );
  });

  it("skips subresource requests via Sec-Fetch-Dest", () => {
    expect(
      shouldServeViteDevHtml(
        createRequest("/ambiguous", { accept: "*/*", secFetchDest: "script" }),
      ),
    ).toBe(false);
  });
});
