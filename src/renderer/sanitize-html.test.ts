import { describe, expect, it } from "vitest";
import { html as brandedHtml } from "./__fixtures__/templates/apphud-branded/html";
import { neutralizeWebPaywallHtml } from "./sanitize-html";

const mount = (source: string) => {
  const host = document.createElement("div");
  host.append(neutralizeWebPaywallHtml(source, document));
  return host;
};

describe("neutralizeWebPaywallHtml", () => {
  it("strips script, iframe, object and embed elements", () => {
    const host = mount(`
      <p id="kept">Safe copy</p>
      <script>window.__xss = true</script>
      <iframe src="https://evil.example"></iframe>
      <object data="https://evil.example"></object>
      <embed src="https://evil.example">
    `);

    expect(host.querySelector("#kept")?.textContent).toBe("Safe copy");
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.querySelector("object")).toBeNull();
    expect(host.querySelector("embed")).toBeNull();
  });

  it("strips on* attributes and leaves the element", () => {
    const host = mount(
      '<img id="live" src="icon.png" alt="" onerror="window.__xss = true" ONCLICK="window.__xss = true">',
    );
    const img = host.querySelector("img");

    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("icon.png");
    expect(img?.hasAttribute("onerror")).toBe(false);
    expect(img?.hasAttribute("onclick")).toBe(false);
    expect(img?.onerror).toBeNull();
  });

  it("strips javascript: URLs, including obfuscated ones, and keeps real links", () => {
    const host = mount(`
      <a id="js" href="javascript:alert(1)">js</a>
      <a id="mixed" href=" JavaScript:alert(1)">mixed</a>
      <a id="tab" href="java&#9;script:alert(1)">tab</a>
      <a id="entity" href="&#106;avascript:alert(1)">entity</a>
      <a id="bom" href="&#xfeff;javascript:alert(1)">bom</a>
      <form id="form" action="javascript:alert(1)"></form>
      <button id="button" formaction="javascript:alert(1)"></button>
      <a id="https" href="https://example.com/terms">terms</a>
      <a id="hash" href="#pay">pay</a>
      <a id="path" href="https://example.com/javascript:docs">docs</a>
      <img id="styled" alt="" style="color:red;background:url(javascript:alert(1))">
      <img id="plain" alt="" style="color:red">
    `);

    for (const id of ["js", "mixed", "tab", "entity", "bom"]) {
      expect(host.querySelector(`#${id}`)?.hasAttribute("href")).toBe(false);
    }
    expect(host.querySelector("#form")?.hasAttribute("action")).toBe(false);
    expect(host.querySelector("#button")?.hasAttribute("formaction")).toBe(
      false,
    );
    expect(host.querySelector("#https")?.getAttribute("href")).toBe(
      "https://example.com/terms",
    );
    expect(host.querySelector("#hash")?.getAttribute("href")).toBe("#pay");
    expect(host.querySelector("#path")?.getAttribute("href")).toBe(
      "https://example.com/javascript:docs",
    );
    expect(host.querySelector("#styled")?.hasAttribute("style")).toBe(false);
    expect(host.querySelector("#plain")?.getAttribute("style")).toBe(
      "color:red",
    );
  });

  it("strips the same payload inside template, svg and foreignObject", () => {
    const host = mount(`
      <div data-list="features">
        <template>
          <div>
            <img src="x" onerror="window.__xss = true" alt="">
            <script>window.__xss = true</script>
            <a href="javascript:alert(1)">x</a>
          </div>
        </template>
      </div>
      <svg>
        <script>window.__xss = true</script>
        <a href="javascript:alert(1)"></a>
        <set attributeName="onmouseover" to="window.__xss = true"></set>
        <foreignObject>
          <img src="x" onerror="window.__xss = true" alt="">
        </foreignObject>
      </svg>
    `);

    const template = host.querySelector("template");
    expect(template?.content.querySelector("script")).toBeNull();
    expect(
      template?.content.querySelector("img")?.hasAttribute("onerror"),
    ).toBe(false);
    expect(template?.content.querySelector("a")?.hasAttribute("href")).toBe(
      false,
    );

    const svg = host.querySelector("svg");
    expect(svg?.querySelector("script")).toBeNull();
    expect(svg?.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(svg?.querySelector("set")).toBeNull();
    expect(svg?.querySelector("img")?.hasAttribute("onerror")).toBe(false);
  });

  it("keeps a bundled template mountable", () => {
    const host = mount(brandedHtml);

    expect(host.querySelector("[data-checkout]")).not.toBeNull();
    expect(host.querySelector("#wp-cta")).not.toBeNull();
    expect(host.querySelector("[data-bind-href]")).not.toBeNull();
    expect(host.querySelector("template")).not.toBeNull();
    expect(host.querySelector("script, iframe, object, embed")).toBeNull();
  });
});
