// Copies third-party runtime assets out of node_modules and into /public, so
// they are served from this origin instead of being fetched from a CDN at the
// moment someone uses a tool.
//
// Runs on every install (see package.json postinstall). Nothing here is
// committed — the files are reproduced from the locked dependency versions,
// which is why /public carries no vendor blobs in git.
//
// WHY THIS MATTERS BEYOND CONVENIENCE
// -----------------------------------
// pdf.js was here first, for a build-tool reason: bundler asset-URL resolution
// behaves inconsistently between webpack and Turbopack, and a stable URL is
// simply more predictable.
//
// tesseract.js was added for a security reason. Left to its defaults it fetches
// its worker script and its ~4MB WebAssembly core from cdn.jsdelivr.net at the
// moment someone runs OCR — that is executable code, arriving from a third
// party, into a page whose entire promise is that files never leave the
// device. A compromised CDN or a hijacked package would run attacker code on
// this origin, alongside a transfer in progress. Nothing about that risk is
// exotic; it is the ordinary supply-chain shape, and the ordinary answer is to
// stop trusting a network path you do not control for code you execute.
//
// Serving them from here means the CSP can refuse every off-origin script
// outright — see contentSecurityPolicy() in next.config.ts.
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const publicDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "public");
mkdirSync(publicDir, { recursive: true });

// --- pdf.js -----------------------------------------------------------------
copyFileSync(
  require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"),
  path.join(publicDir, "pdf.worker.min.mjs"),
);
console.log("Copied pdf.worker.min.mjs to public/");

// --- tesseract.js -----------------------------------------------------------
const tesseractDir = path.join(publicDir, "tesseract");
mkdirSync(tesseractDir, { recursive: true });

// The worker script. tesseract.js fetches this and turns it into a blob URL
// (workerBlobURL defaults to true), so a same-origin path here keeps the whole
// fetch same-origin.
copyFileSync(
  require.resolve("tesseract.js/dist/worker.min.js"),
  path.join(tesseractDir, "worker.min.js"),
);

// The WASM cores. tesseract.js picks ONE of these at runtime by feature-
// detecting SIMD support (see tesseract.js/src/worker-script/browser/getCore.js),
// so which one a given visitor needs is not knowable here — all the variants
// have to be present or OCR breaks on whichever devices pick the missing one.
//
// The .wasm.js files embed their WebAssembly as base64 and are self-contained;
// the bare .wasm siblings are copied alongside anyway, because that costs a
// file copy and guessing wrong costs a broken tool on someone's phone.
const coreDir = path.dirname(require.resolve("tesseract.js-core/package.json"));
let copied = 0;
for (const file of readdirSync(coreDir)) {
  if (file.endsWith(".wasm.js") || file.endsWith(".wasm")) {
    copyFileSync(path.join(coreDir, file), path.join(tesseractDir, file));
    copied += 1;
  }
}

if (copied === 0 || !existsSync(path.join(tesseractDir, "worker.min.js"))) {
  // Failing loudly here is deliberate. A silent partial copy means OCR falls
  // back to nothing at all (the CSP refuses the CDN), and the first person to
  // find out is a user watching a tool fail.
  throw new Error("tesseract assets were not copied — OCR would ship broken");
}

console.log(`Copied tesseract worker + ${copied} core files to public/tesseract/`);
