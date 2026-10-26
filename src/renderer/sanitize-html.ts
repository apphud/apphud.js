// API screen html is mounted in the dashboard origin (open shadow root).
// Legacy previews iframe the same kind of html with sandbox="allow-scripts"
// and no allow-same-origin; this tree cannot, because the engine's listeners
// and the Stripe slots live in it. Parsed through a detached <template>,
// whose contents stay inert, then moved — assigning a sanitized string with
// innerHTML would parse again and can resurrect handlers.

const BLOCKED_ELEMENTS = new Set(["script", "iframe", "object", "embed"]);

// SMIL can set an event handler without an on* attribute:
// <set attributeName="onerror" to="...">.
const SMIL_ELEMENTS = new Set([
  "set",
  "animate",
  "animatetransform",
  "animatemotion",
]);

const JAVASCRIPT_URL_IN_STYLE = /(?:url\(|url=)["']?javascript:/;

const isEventHandler = (name: string) => /^on/i.test(name);

// Browsers ignore ASCII controls, spaces and a leading BOM inside a scheme,
// so "java\tscript:" is still a javascript: URL.
const compactUrl = (value: string) =>
  [...value]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 0x20 && code !== 0xfeff;
    })
    .join("")
    .toLowerCase();

const isJavascriptUrl = (value: string) => {
  const compact = compactUrl(value);
  return (
    compact.startsWith("javascript:") || JAVASCRIPT_URL_IN_STYLE.test(compact)
  );
};

const dropAttribute = (element: Element, attr: Attr) => {
  if (attr.namespaceURI) {
    element.removeAttributeNS(attr.namespaceURI, attr.localName);
    return;
  }
  element.removeAttribute(attr.name);
};

const neutralizeTree = (node: ParentNode) => {
  for (const child of [...node.childNodes]) {
    if (!(child instanceof Element)) continue;
    const tag = child.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(tag)) {
      child.remove();
      continue;
    }
    for (const attr of [...child.attributes]) {
      if (isEventHandler(attr.name) || isJavascriptUrl(attr.value)) {
        dropAttribute(child, attr);
      }
    }
    if (
      SMIL_ELEMENTS.has(tag) &&
      isEventHandler(child.getAttribute("attributeName") ?? "")
    ) {
      child.remove();
      continue;
    }
    if (child instanceof HTMLTemplateElement) neutralizeTree(child.content);
    neutralizeTree(child);
  }
};

export const neutralizeWebPaywallHtml = (
  html: string,
  document: Document,
): DocumentFragment => {
  const template = document.createElement("template");
  template.innerHTML = html;
  neutralizeTree(template.content);
  return template.content;
};
