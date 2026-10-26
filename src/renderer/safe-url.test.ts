import { describe, expect, it } from "vitest";
import { resolveIcon } from "./icons";
import { cssUrl, safeHref, safeImageSrc, safeReturnUrl } from "./safe-url";

describe("web paywall safe urls", () => {
  it("keeps http(s) and fragment links", () => {
    expect(safeHref("https://apphud.com/terms")).toBe(
      "https://apphud.com/terms",
    );
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("#pay")).toBe("#pay");
  });

  it("drops script and other schemes from links", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("  JavaScript:alert(1)")).toBe("#");
    expect(safeHref("java\tscript:alert(1)")).toBe("#");
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(safeHref("//evil.example")).toBe("#");
    expect(safeHref(undefined)).toBe("#");
    expect(safeHref({ en: "https://apphud.com" })).toBe("#");
  });

  it("allows only http(s) and data:image sources", () => {
    expect(safeImageSrc("https://cdn.example/icon.png")).toBe(
      "https://cdn.example/icon.png",
    );
    expect(safeImageSrc("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(safeImageSrc("javascript:alert(1)")).toBe("");
    expect(safeImageSrc("data:text/html,x")).toBe("");
    expect(safeImageSrc(42)).toBe("");
  });

  it("resolves built-in icons before the check", () => {
    expect(resolveIcon("@check")).toMatch(/^data:image\/svg\+xml/);
    expect(resolveIcon("@unknown")).toBe("");
    expect(resolveIcon("javascript:alert(1)")).toBe("");
  });

  it("keeps a url inside its css token", () => {
    expect(cssUrl('https://x.example/a"),url(b')).toBe(
      'url("https://x.example/a%22),url(b")',
    );
  });

  it("lets the return button open a universal link or an app scheme", () => {
    expect(safeReturnUrl("https://ddd.aphd.cc/_apphud/return")).toBe(
      "https://ddd.aphd.cc/_apphud/return",
    );
    expect(safeReturnUrl(" apphudtestapp://ddd.aphd.cc/_apphud/return ")).toBe(
      "apphudtestapp://ddd.aphd.cc/_apphud/return",
    );
    expect(safeReturnUrl("javascript://%0Aalert(1)")).toBeNull();
    expect(safeReturnUrl("JavaScript://x")).toBeNull();
    expect(safeReturnUrl("java\tscript://x")).toBeNull();
    expect(safeReturnUrl("data://text/html,x")).toBeNull();
    expect(safeReturnUrl("javascript:alert(1)")).toBeNull();
    expect(safeReturnUrl("/relative")).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
    // data links never take an app scheme
    expect(safeHref("apphudtestapp://ddd.aphd.cc/_apphud/return")).toBe("#");
  });
});
