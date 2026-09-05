// Cloudflare R2 client — the "receiver isn't online right now" fallback
// path (Phase 2 of the plan). R2 was chosen specifically for its $0 egress
// fee: since this product is nothing but downloads, that's the single
// biggest lever on infra cost at scale (see the plan's cost estimate).
//
// R2 is S3-API-compatible, so the standard AWS SDK works unmodified against
// it — just point the endpoint at Cloudflare instead of AWS.
//
// Storage layout per shared link:
//   <token>       the file bytes, uploaded directly from the browser via a
//                 presigned PUT (bypasses our server entirely — we never
//                 touch the bytes, keeping our own bandwidth bill at zero
//                 for this path too).
//   <token>.json  a small sidecar with { name, size, mime, expiresAt },
//                 written by our server. Keeping metadata separate from the
//                 file object avoids the header-signature headaches of
//                 trying to attach custom metadata to a presigned PUT.
//
// Actual deletion of expired files is handled by an R2 bucket Object
// Lifecycle rule (a one-time dashboard/API setup step — see README), not by
// application code, so cleanup keeps working even if this app is offline.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeFilename } from "@/lib/sanitize";

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME,
  );
}

let client: S3Client | null = null;

function r2Client(): S3Client {
  if (client) return client;
  const config: S3ClientConfig = {
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  };
  client = new S3Client(config);
  return client;
}

function bucket(): string {
  return process.env.R2_BUCKET_NAME!;
}

export interface UploadMeta {
  name: string;
  size: number;
  mime: string;
  expiresAt: number; // epoch ms
  blocked?: boolean; // set by the abuse-report flow — see /api/report/[token]
  passwordHash?: string; // hex — see hashPassword/verifyPassword
  passwordSalt?: string; // hex
  burnAfterDownload?: boolean; // "delete after first download" — see markDownloaded
  consumedAt?: number; // epoch ms a burn-after-download link handed out its URL
}

/** scrypt with a per-file random salt — no extra dependency, adequate for gating a casual share link (not a high-value secret store). */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function writeMetadata(token: string, meta: UploadMeta): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: `${token}.json`,
      Body: JSON.stringify(meta),
      ContentType: "application/json",
    }),
  );
}

export async function readMetadata(token: string): Promise<UploadMeta | null> {
  try {
    const res = await r2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: `${token}.json` }));
    const text = await res.Body!.transformToString();
    return JSON.parse(text) as UploadMeta;
  } catch {
    return null;
  }
}

/**
 * Immediately disables a shared link's download. We deliberately don't wait for human
 * review before taking effect — for an anonymous, no-login product, a fast/automatic
 * takedown on the first report matters more than protecting against the rare bad-faith
 * report, especially since reporting requires already having the (unguessable) token,
 * the same bar as downloading it. This is the safeguard the plan calls out as
 * non-negotiable from day one (see the Firefox Send case study).
 */
export async function markReported(token: string): Promise<boolean> {
  const meta = await readMetadata(token);
  if (!meta) return false;
  await writeMetadata(token, { ...meta, blocked: true });
  return true;
}

/**
 * How long a burned link's bytes are left alone after its download URL is
 * handed out. The URL is presigned for five minutes, but a download that
 * STARTS inside that window can legitimately run for far longer — deleting the
 * object out from under a slow connection would break the one download the
 * sender asked for. An hour of storage for a 2GB file is four thousandths of a
 * cent, so this is a very cheap way to be sure.
 */
const BURN_GRACE_MS = 60 * 60 * 1000;

/** Both objects that make up a share: the bytes and the metadata sidecar. */
async function deleteShare(token: string): Promise<void> {
  await r2Client()
    .send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: [{ Key: token }, { Key: `${token}.json` }], Quiet: true },
      }),
    )
    .catch(() => {
      // The bucket's lifecycle rule is the backstop for anything this misses,
      // so a failure here costs a little storage, never correctness.
    });
}

/**
 * Marks a "delete after first download" link as consumed, and schedules the
 * bytes for actual deletion.
 *
 * Consumption fires the moment a download URL is handed out, not when the
 * transfer completes: we have no way to observe a direct browser-to-R2
 * download finishing, and proxying the bytes to find out would undo R2's
 * zero-egress benefit. "Opened the link" is the closest honest approximation.
 *
 * The deletion itself is a timer in this process, which is sound for how this
 * app is deployed (one long-running Node server) and degrades safely when it
 * isn't: a restart inside the grace window loses the timer, and the object
 * then waits for sweepIfConsumed() on the next visit, or failing that the
 * bucket's lifecycle rule — which is exactly what used to happen to every
 * burned file, so this is never worse than before.
 */
export async function markDownloaded(token: string): Promise<void> {
  const meta = await readMetadata(token);
  if (!meta || meta.consumedAt) return;
  await writeMetadata(token, { ...meta, consumedAt: Date.now() });

  const timer = setTimeout(() => void deleteShare(token), BURN_GRACE_MS);
  // Never hold the process open for a pending deletion.
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

/**
 * Deletes a consumed link's bytes if their grace period has passed. Called on
 * read, so a link whose in-process timer was lost to a restart still gets
 * cleaned up the next time anyone touches it.
 */
export async function sweepIfConsumed(token: string, meta: UploadMeta): Promise<void> {
  if (!meta.consumedAt || Date.now() - meta.consumedAt < BURN_GRACE_MS) return;
  await deleteShare(token);
}

/**
 * Presigned URL the browser PUTs the file to directly — the file bytes never
 * pass through our server.
 *
 * ContentLength is part of the signature, which is what turns the declared
 * size from a claim into a limit. Without it the size check in /api/upload-url
 * was decorative: the browser said "10MB", got a URL, and could PUT fifty
 * gigabytes through it. Now the signed request commits to an exact byte count
 * and R2 rejects anything else, so the ceiling and the ad ladder both mean
 * something against someone deliberate.
 */
export function getUploadUrl(token: string, contentLength: number, expiresInSeconds = 60 * 60): Promise<string> {
  return getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: bucket(), Key: token, ContentLength: contentLength }), {
    expiresIn: expiresInSeconds,
  });
}

// --- Multipart upload (resumable-within-session large uploads) ---
// R2 is S3-API-compatible, so the standard multipart flow applies unmodified:
// create an upload, get a presigned URL per part, PUT each part directly from
// the browser, then complete with the collected ETags. This is what makes a
// dropped connection on a multi-GB file recoverable — only the failed part
// needs retrying, not the whole upload. Scope note: this recovers from a
// mid-session network blip (the common case), not a fully closed tab days
// later, since that would need re-selecting the same File from disk and
// persisting the upload ID — a materially bigger feature, not attempted here.

/** S3/R2 requires every part except the last to be at least 5MB. */
export const MULTIPART_PART_SIZE = 8 * 1024 * 1024;
/** Below this, a single presigned PUT is simpler and just as fast. */
export const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

/**
 * Cap on how many parts one upload is split into.
 *
 * Fixed 8MB parts were fine for a 2GB ceiling (256 parts). They are not fine
 * for a 50GB one: that's 6,400 parts, which is 6,400 calls to
 * /api/upload-part-url — six times its own hourly rate limit, so the upload
 * would throttle itself to death somewhere past the 8GB mark. Growing the part
 * instead of the part count keeps a large upload to a few hundred requests.
 *
 * The trade is retry cost: a failed 50MB part is more to redo than a failed
 * 8MB one. A thousand parts keeps both ends sane — 50GB lands on ~52MB parts.
 */
const MAX_PARTS = 1000;

export interface MultipartPlan {
  partSize: number;
  totalParts: number;
}

/** How to cut a file of this size into parts. */
export function multipartPlan(size: number): MultipartPlan {
  const MB = 1024 * 1024;
  const needed = Math.ceil(size / MAX_PARTS);
  // Rounded to whole megabytes purely so the numbers stay legible in logs and
  // in the client's progress arithmetic.
  const partSize = Math.max(MULTIPART_PART_SIZE, Math.ceil(needed / MB) * MB);
  return { partSize, totalParts: Math.ceil(size / partSize) };
}

/**
 * The exact byte length of one part. Every part is partSize except the last,
 * which is whatever remains — and the last one matters here, because the
 * length is signed into the part's URL.
 */
export function partLength(size: number, partSize: number, partNumber: number): number {
  const start = (partNumber - 1) * partSize;
  if (start < 0 || start >= size) return 0;
  return Math.min(partSize, size - start);
}

export async function createMultipartUpload(token: string): Promise<string> {
  const res = await r2Client().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: token }));
  if (!res.UploadId) throw new Error("R2 didn't return an upload ID.");
  return res.UploadId;
}

/**
 * ContentLength is signed here for the same reason it is on the single PUT:
 * without it the declared file size is a claim rather than a limit, and a
 * multipart upload is the obvious way around a limit that only checks the
 * first request. Each part now commits to an exact byte count.
 */
export function getPartUploadUrl(
  token: string,
  uploadId: string,
  partNumber: number,
  contentLength: number,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new UploadPartCommand({
      Bucket: bucket(),
      Key: token,
      UploadId: uploadId,
      PartNumber: partNumber,
      ContentLength: contentLength,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function completeMultipartUpload(token: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void> {
  await r2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: token,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }),
  );
}

export async function abortMultipartUpload(token: string, uploadId: string): Promise<void> {
  await r2Client()
    .send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: token, UploadId: uploadId }))
    .catch(() => {
      // Best-effort cleanup — an orphaned incomplete multipart upload costs a
      // little storage until the bucket's lifecycle rule sweeps it, not worth
      // failing the user-facing request over.
    });
}

/** Presigned URL the browser downloads from directly — regenerated fresh on each page load, not stored anywhere long-lived. */
export function getDownloadUrl(token: string, filename: string, expiresInSeconds = 5 * 60): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: token,
      // Forces a real download instead of the browser trying to render the file inline (images, PDFs, etc.).
      // Sanitized again here (defense-in-depth) even though upload-url already cleans the name on the way in —
      // this is the actual HTTP header value, so nothing reaches it unsanitized regardless of call site.
      ResponseContentDisposition: `attachment; filename="${sanitizeFilename(filename)}"`,
    }),
    { expiresIn: expiresInSeconds },
  );
}
