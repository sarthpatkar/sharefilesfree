// pdf.js needs its worker file served as a static asset with a stable URL.
// Copying it into /public on every install (rather than relying on bundler
// asset-URL resolution, which behaves inconsistently between webpack and
// Turbopack) keeps this predictable regardless of build tool.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = (await import("node:module")).createRequire(import.meta.url);
const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const publicDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "public");
mkdirSync(publicDir, { recursive: true });
copyFileSync(workerSrc, path.join(publicDir, "pdf.worker.min.mjs"));
console.log("Copied pdf.worker.min.mjs to public/");
