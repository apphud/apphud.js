// Schema data is user-editable (JSON editor), so every URL that lands in an
// attribute or a CSS url() goes through an allow-list.
const HTTP_URL = /^https?:\/\//i;
const IMAGE_DATA_URL = /^data:image\//i;

export const safeHref = (value: unknown): string => {
  if (typeof value !== "string") return "#";
  const url = value.trim();
  return url.startsWith("#") || HTTP_URL.test(url) ? url : "#";
};

// The success page's return button: a universal link or the app's own URI
// scheme from the deeplink config (`apphudtestapp://…`). Never for data links.
const SCHEME_URL = /^([a-z][a-z0-9+.-]*):\/\//i;
const BLOCKED_SCHEMES = new Set([
  "javascript",
  "data",
  "vbscript",
  "file",
  "blob",
]);

export const safeReturnUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const url = value.trim();
  const scheme = SCHEME_URL.exec(url)?.[1].toLowerCase();
  return scheme && !BLOCKED_SCHEMES.has(scheme) ? url : null;
};

export const safeImageSrc = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const url = value.trim();
  return HTTP_URL.test(url) || IMAGE_DATA_URL.test(url) ? url : "";
};

// Keeps a URL inside the url("…") token it is interpolated into.
export const cssUrl = (url: string): string =>
  `url("${url.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char))}")`;
