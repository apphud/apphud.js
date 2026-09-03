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

const input = "src/index.ts";
const outputName = "apphud";

const plugins = [
  nodeResolve(),
  commonjs(),
  buble({include: ""}),
  terser(),
  typescript({
    compilerOptions: {
      lib: ["es5", "es6", "dom"],
      target: "es5",
      declaration: false,
      declarationMap: false
    }
  }),
]
export default [
  {
    input: input,
    output: {
      name: outputName,
      file: `dist/${outputName}.js`,
      format: "umd",
      exports: "default",
      banner: minBanner,
      footer: "if(typeof window!==\"undefined\"&&window.apphud&&typeof window.apphud.init!==\"function\"&&window.apphud.default){window.apphud=window.apphud.default;}if(typeof window!==\"undefined\"&&window.apphud){window.ApphudSDK=window.apphud;}"
    },
    plugins: plugins
  },

  {
    input: input,
    output: {
      name: outputName,
      file: pkg.module,
      format: "es",
      banner: banner
    },
    plugins: plugins
  }
];
