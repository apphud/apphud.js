import buble from "@rollup/plugin-buble";
import commonjs from "@rollup/plugin-commonjs";
import { createRequire } from "module";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const banner = `
  window.ApphudSDKVersion = '${pkg.version}';
`;

const minBanner = `window.ApphudSDKVersion = '${pkg.version}';`;

const outDir = "dist/v3";

const plugins = [
  nodeResolve(),
  commonjs(),
  buble({include: ""}),
  terser(),
  typescript({
    compilerOptions: {
      lib: ["es2017", "dom"],
      target: "es2017",
      declaration: false,
      declarationMap: false
    }
  }),
]
export default [
  // Funnel SDK: web/v3/apphud.js
  {
    input: "src/entries/funnel.ts",
    output: {
      name: "apphud",
      file: `${outDir}/apphud.js`,
      format: "umd",
      exports: "default",
      banner: minBanner,
      footer: "if(typeof window!==\"undefined\"&&window.apphud&&typeof window.apphud.init!==\"function\"&&window.apphud.default){window.apphud=window.apphud.default;}if(typeof window!==\"undefined\"&&window.apphud){window.ApphudSDK=window.apphud;}"
    },
    plugins: plugins
  },

  {
    input: "src/entries/funnel.ts",
    output: {
      name: "apphud",
      file: `${outDir}/apphud.esm.js`,
      format: "es",
      banner: banner
    },
    plugins: plugins
  },

  // Hosted web paywall page: web/v3/apphud-checkout.js
  {
    input: "src/entries/checkout.ts",
    output: {
      name: "ApphudCheckout",
      file: `${outDir}/apphud-checkout.js`,
      format: "umd"
    },
    plugins: plugins
  },

  // Renderer for the dashboard builder, no checkout code
  {
    input: "src/entries/renderer.ts",
    output: {
      file: `${outDir}/apphud-renderer.esm.js`,
      format: "es"
    },
    plugins: plugins
  }
];
