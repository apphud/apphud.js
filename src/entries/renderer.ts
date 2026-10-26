// Renderer-only build for the dashboard builder. Must not import checkout code:
// the builder never charges.
export { createWebPaywall } from "../renderer/create-web-paywall";
export { formatText, getPath } from "../renderer/macros";
export type * from "../renderer/types";
