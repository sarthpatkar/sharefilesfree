import { describe, expect, it } from "vitest";
import { deriveVerificationCode, fingerprintFromSdp } from "./verificationCode";

const SDP_A = `v=0
o=- 123 2 IN IP4 127.0.0.1
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
a=setup:actpass`;

const SDP_B = `v=0
o=- 456 2 IN IP4 127.0.0.1
a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00
a=setup:active`;

const SDP_ATTACKER = `v=0
a=fingerprint:sha-256 DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF:DE:AD:BE:EF`;

describe("fingerprintFromSdp", () => {
  it("finds the fingerprint line", () => {
    expect(fingerprintFromSdp(SDP_A)).toBe("sha-256 AABBCCDDEEFF00112233445566778899");
  });

  it("normalises case and separators, so two browsers agree", () => {
    const lower = "a=fingerprint:SHA-256 aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99";
    expect(fingerprintFromSdp(lower)).toBe(fingerprintFromSdp(SDP_A));
  });

  it("returns null when there is nothing to read", () => {
    expect(fingerprintFromSdp(null)).toBeNull();
    expect(fingerprintFromSdp("v=0\r\na=setup:active")).toBeNull();
  });
});

describe("deriveVerificationCode", () => {
  it("gives both sides the same code regardless of who is local", async () => {
    const a = fingerprintFromSdp(SDP_A);
    const b = fingerprintFromSdp(SDP_B);
    // The sender sees its own as local; the receiver sees the opposite.
    const sender = await deriveVerificationCode(a, b);
    const receiver = await deriveVerificationCode(b, a);
    expect(sender).toBe(receiver);
    expect(sender).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });

  // The point of the whole mechanism.
  it("gives the two halves of a machine-in-the-middle different codes", async () => {
    const a = fingerprintFromSdp(SDP_A);
    const b = fingerprintFromSdp(SDP_B);
    const attacker = fingerprintFromSdp(SDP_ATTACKER);

    // What each honest party would actually see: their own key paired with the
    // attacker's, because that is who they are really connected to.
    const senderSees = await deriveVerificationCode(a, attacker);
    const receiverSees = await deriveVerificationCode(b, attacker);

    expect(senderSees).not.toBe(receiverSees);
    // And neither matches the code they would have had with each other.
    expect(senderSees).not.toBe(await deriveVerificationCode(a, b));
    expect(receiverSees).not.toBe(await deriveVerificationCode(a, b));
  });

  it("changes when either fingerprint changes", async () => {
    const base = await deriveVerificationCode("sha-256 AAAA", "sha-256 BBBB");
    expect(await deriveVerificationCode("sha-256 AAAB", "sha-256 BBBB")).not.toBe(base);
    expect(await deriveVerificationCode("sha-256 AAAA", "sha-256 BBBC")).not.toBe(base);
  });

  it("uses no characters that get misread out loud", async () => {
    // Many samples, because the point is that these never appear at all.
    for (let i = 0; i < 60; i++) {
      const code = await deriveVerificationCode(`sha-256 ${i}A`, `sha-256 ${i}B`);
      expect(code).not.toMatch(/[ILOU01]/);
    }
  });

  it("returns null rather than a wrong answer when a fingerprint is missing", async () => {
    expect(await deriveVerificationCode(null, "sha-256 BBBB")).toBeNull();
    expect(await deriveVerificationCode("sha-256 AAAA", null)).toBeNull();
  });
});
