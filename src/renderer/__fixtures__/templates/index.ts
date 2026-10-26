import type {
  WebPaywallData,
  WebPaywallSchemaItem,
  WebPaywallTemplate,
} from "../../types";

import { css as apphudBrandedCss } from "./apphud-branded/css";
import apphudBrandedData from "./apphud-branded/data.json";
import { html as apphudBrandedHtml } from "./apphud-branded/html";
import apphudBrandedSchema from "./apphud-branded/schema.json";
import { css as babyCryCss } from "./baby-cry/css";
import babyCryData from "./baby-cry/data.json";
import { html as babyCryHtml } from "./baby-cry/html";
import babyCrySchema from "./baby-cry/schema.json";
import { css as packagesAppCss } from "./packages-app/css";
import packagesAppData from "./packages-app/data.json";
import { html as packagesAppHtml } from "./packages-app/html";
import packagesAppSchema from "./packages-app/schema.json";

// Each template = its own html + css + schema + default data (V5 `html`/`css`/
// `schema`/`data`, flat `{slug: {field: value}}`); the runtime is shared.
export const WEB_PAYWALL_TEMPLATES: WebPaywallTemplate[] = [
  {
    name: "apphud_branded",
    title: "Apphud Branded",
    html: apphudBrandedHtml,
    css: apphudBrandedCss,
    schema: apphudBrandedSchema as WebPaywallSchemaItem[],
    data: apphudBrandedData as WebPaywallData,
  },
  {
    name: "baby_cry",
    title: "Baby Cry",
    html: babyCryHtml,
    css: babyCryCss,
    schema: babyCrySchema as WebPaywallSchemaItem[],
    data: babyCryData as WebPaywallData,
  },
  {
    name: "packages_app",
    title: "Packages App",
    html: packagesAppHtml,
    css: packagesAppCss,
    schema: packagesAppSchema as WebPaywallSchemaItem[],
    data: packagesAppData as WebPaywallData,
  },
];

// Bundled sources: the backend's ready templates are generated from these files
// (build-templates.mjs); the builder UI reads templates from the API.
export const findWebPaywallTemplate = (name: string) =>
  WEB_PAYWALL_TEMPLATES.find((template) => template.name === name);
