// Fails the build when a bundle carries code it must not have:
// the renderer build has no checkout, the checkout build has no funnel tracking,
// the funnel build has no renderer.
import { readFileSync } from "fs";

const checks = [
  {
    file: "dist/v3/apphud-renderer.esm.js",
    forbidden: [/@stripe/, /@paddle/, /js\.stripe\.com/, /paddle\.com/, /payment_providers/],
  },
  {
    file: "dist/v3/apphud-checkout.js",
    forbidden: [/\/customers\/attribution/, /\bfbq\b/, /\bgtag\b/, /aph_/],
  },
  {
    file: "dist/v3/apphud.js",
    forbidden: [/data-plan-bind/, /data-checkout/],
  },
];

let failed = false;
for (const { file, forbidden } of checks) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      console.error(`${file}: must not contain ${pattern}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("Bundle checks passed");
