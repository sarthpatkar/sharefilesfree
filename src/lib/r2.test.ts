import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, multipartPlan, partLength, MULTIPART_PART_SIZE } from "./r2";
import { MAX_LINK_BYTES } from "./retention";

// These only exercise the pure crypto helpers — no R2/network calls, so no
// R2_* env vars are needed to run this file.
describe("password hashing", () => {
  it("verifies the correct password", () => {
    const { hash, salt } = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", salt, hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const { hash, salt } = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong guess", salt, hash)).toBe(false);
  });

  it("produces a different salt (and hash) each time, even for the same password", () => {
    const a = hashPassword("same password");
    const b = hashPassword("same password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("rejects if verified against a tampered hash", () => {
    const { hash, salt } = hashPassword("secret");
    const tampered = hash.slice(0, -2) + (hash.slice(-2) === "00" ? "11" : "00");
    expect(verifyPassword("secret", salt, tampered)).toBe(false);
  });
});

const MB = 1024 * 1024;
const GB = 1024 ** 3;

describe("cutting a file into parts", () => {
  it("uses the 8MB floor for anything small enough", () => {
    expect(multipartPlan(100 * MB).partSize).toBe(MULTIPART_PART_SIZE);
    expect(multipartPlan(100 * MB).totalParts).toBe(13);
  });

  it("grows the part rather than the part count on a big file", () => {
    // The reason this exists: fixed 8MB parts would make the largest allowed
    // upload ~6,400 requests to /api/upload-part-url, which is several times
    // that route's hourly limit — the upload would throttle itself to death.
    const plan = multipartPlan(MAX_LINK_BYTES);
    expect(plan.totalParts).toBeLessThanOrEqual(1000);
    expect(plan.partSize).toBeGreaterThan(MULTIPART_PART_SIZE);
  });

  it("never goes under R2's 5MB minimum part size", () => {
    for (const size of [11 * MB, 500 * MB, 2 * GB, 20 * GB, MAX_LINK_BYTES]) {
      expect(multipartPlan(size).partSize).toBeGreaterThanOrEqual(5 * MB);
    }
  });

  it("covers the whole file exactly, with the remainder in the last part", () => {
    for (const size of [11 * MB, 100 * MB + 12345, 2 * GB, 37 * GB + 999]) {
      const { partSize, totalParts } = multipartPlan(size);
      let summed = 0;
      for (let n = 1; n <= totalParts; n++) summed += partLength(size, partSize, n);
      expect(summed).toBe(size);
      expect(partLength(size, partSize, totalParts)).toBeLessThanOrEqual(partSize);
    }
  });

  it("reports nothing for a part past the end of the file", () => {
    const { partSize, totalParts } = multipartPlan(100 * MB);
    expect(partLength(100 * MB, partSize, totalParts + 1)).toBe(0);
  });
});
