import { safeImageSrc } from "./safe-url";

const svgUri = (svg: string) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

const glyph = (body: string, width = 2) =>
  svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  );

const APPHUD_MARK =
  "M12 20.5846C14.2992 20.5846 16.3873 19.6807 17.9283 18.209L11.9889 12.3816L6.00463 18.1442C7.55187 19.6542 9.66728 20.5846 12 20.5846ZM13.4272 9.0081L19.9019 15.3606C20.3414 14.3285 20.5846 13.1926 20.5846 12C20.5846 7.25885 16.7412 3.41538 12 3.41538C7.25885 3.41538 3.41538 7.25885 3.41538 12C3.41538 13.1593 3.64517 14.2649 4.06167 15.2737L10.5821 8.99481C11.3778 8.22857 12.6387 8.23446 13.4272 9.0081ZM12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z";

const ICONS: Record<string, string> = {
  close: glyph('<path d="M6 6l12 12M18 6L6 18"/>', 2.4),
  chart: glyph(
    '<path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V6"/><path d="M17 16v-8"/>',
  ),
  flask: glyph(
    '<path d="M9 3h6"/><path d="M10 3v6.5L4.8 18.2A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.8L14 9.5V3"/><path d="M7.5 15h9"/>',
  ),
  link: glyph(
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ),
  chat: glyph(
    '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.9A8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>',
  ),
  lock: glyph(
    '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    2.2,
  ),
  check: glyph('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3),
  card: glyph(
    '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>',
  ),
  alert: glyph(
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16.2v.3"/>',
  ),
  star: glyph(
    '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  ),
  star_fill: svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>',
  ),
  bolt: glyph('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  shield: glyph(
    '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  ),
  apple: svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
  ),
  card_generic: svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect x="0.75" y="0.75" width="28.5" height="18.5" rx="3.25" fill="none" stroke="#8C98AB" stroke-width="1.5"/><rect x="0.75" y="5" width="28.5" height="3" fill="#8C98AB"/><rect x="4" y="12" width="8" height="2" rx="1" fill="#8C98AB"/></svg>',
  ),
  app: svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34A0FF"/><stop offset="1" stop-color="#0062F0"/></linearGradient><radialGradient id="h" cx="28%" cy="18%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="120" height="120" rx="28" fill="url(#g)"/><rect width="120" height="120" rx="28" fill="url(#h)"/><g transform="translate(29 29) scale(2.5833)"><path fill="#fff" fill-rule="evenodd" d="${APPHUD_MARK}"/></g></svg>`,
  ),
  visa: svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect width="30" height="20" rx="4" fill="#fff"/><rect x=".5" y=".5" width="29" height="19" rx="3.5" fill="none" stroke="#D9E0EA"/><text x="15" y="13.6" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8.6" font-weight="800" font-style="italic" fill="#1A1F71" letter-spacing=".2">VISA</text></svg>',
  ),
  mastercard: svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect width="30" height="20" rx="4" fill="#fff"/><rect x=".5" y=".5" width="29" height="19" rx="3.5" fill="none" stroke="#D9E0EA"/><circle cx="12" cy="10" r="5.5" fill="#EB001B"/><circle cx="18" cy="10" r="5.5" fill="#F79E1B"/><path d="M15 5.39A5.5 5.5 0 0 1 15 14.61A5.5 5.5 0 0 1 15 5.39Z" fill="#FF5F00"/></svg>',
  ),
  amex: svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><rect width="30" height="20" rx="4" fill="#1F72CD"/><text x="15" y="13.2" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="7.6" font-weight="800" fill="#fff" letter-spacing=".4">AMEX</text></svg>',
  ),
};

// `@name` = built-in icon, anything else = an image URL from the schema data.
export const resolveIcon = (value: unknown): string => {
  if (typeof value === "string" && value.startsWith("@")) {
    return ICONS[value.slice(1)] ?? "";
  }
  return safeImageSrc(value);
};
