// "Sandbox" strip at the very top of the page (apphud-js-plan.md п. 15). It
// lives outside the paywall's shadow root, so the template neither hides nor
// styles it, and it lets taps through to the paywall under it.
export function showSandboxBanner(doc: Document): HTMLElement {
  const banner = doc.createElement("div");
  banner.setAttribute("data-apphud-sandbox", "");
  banner.setAttribute("role", "status");
  banner.textContent = "Sandbox — test payments";
  banner.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "right: 0",
    "z-index: 2147483647",
    "padding: calc(env(safe-area-inset-top, 0px) + 4px) 12px 4px",
    "background: #f5a524",
    "color: #1a1300",
    "font: 600 12px/16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    "text-align: center",
    "pointer-events: none",
  ].join(";");
  doc.body.append(banner);
  return banner;
}
