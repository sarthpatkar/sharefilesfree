import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./r2";

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
