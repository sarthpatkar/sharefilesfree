/**
 * A short code both people can compare out loud to prove nobody is sitting in
 * the middle of their transfer.
 *
 * WHAT PROBLEM THIS SOLVES
 * ------------------------
 * The two browsers encrypt everything between themselves, and that part needs
 * no trust in us at all. But they have to be introduced first, and the
 * introduction goes through our signaling server: each side sends the other a
 * fingerprint of the key it will use, and believes what arrives.
 *
 * A signaling server that chose to misbehave could replace both fingerprints
 * with its own, hold two encrypted connections instead of one, and read
 * everything passing between them. Neither side would notice: both would see a
 * properly encrypted connection, because both would have one — just not to
 * each other. This is the standard weak point of every browser-to-browser
 * transfer product, and it is the reason our own security page has to say that
 * one step rests on trusting us.
 *
 * This removes that last piece of trust. The code below is derived from the
 * two real fingerprints, so:
 *
 *   - With nobody in the middle, both devices derive the SAME code, because
 *     they are hashing the same pair of fingerprints.
 *   - With somebody in the middle, the two devices are looking at different
 *     fingerprints — the attacker's, not each other's — so their codes DIFFER,
 *     and no amount of tampering with the signaling channel can fix that,
 *     because the attacker cannot make the honest parties hash something they
 *     never saw.
 *
 * The attacker's only escape is to find a key whose fingerprint produces a
 * matching code. That is a search against the full width of the code, it has
 * to succeed inside the few seconds a connection takes to set up, and it has
 * to be redone for every transfer because fingerprints are generated fresh
 * each time. CODE_BITS below is sized so that search is not worth starting.
 */

/**
 * Width of the derived code, in bits.
 *
 * Eight characters from a 32-symbol alphabet is 40 bits, so a forger needs
 * around a trillion hash attempts to land on a chosen code — and must do it
 * while two people wait for a connection, not offline at leisure. Going wider
 * would cost nothing in security and a great deal in usability: this only
 * works if people actually read it to each other, and a code that fills a line
 * is a code that gets skipped.
 */
const CODE_CHARS = 8;

/**
 * Deliberately excludes I, L, O, U, 0 and 1.
 *
 * The whole mechanism depends on two people agreeing that what they see is the
 * same, usually over a phone call or across a room. A character set where O
 * and 0 are distinct guarantees arguments about codes that actually match, and
 * every one of those teaches people to shrug and continue — which is worse
 * than not showing a code at all.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ".split("");

/**
 * Pulls the certificate fingerprint out of an SDP blob.
 *
 * The line looks like `a=fingerprint:sha-256 AB:CD:...`. Case and whitespace
 * vary between browsers, so it is normalised before use — Chrome and Firefox
 * must derive identical codes from the same connection or this is worse than
 * useless.
 */
export function fingerprintFromSdp(sdp: string | undefined | null): string | null {
  if (!sdp) return null;
  const match = sdp.match(/^a=fingerprint:\s*(\S+)\s+(\S+)/im);
  if (!match) return null;
  const algorithm = match[1].toLowerCase();
  const value = match[2].toUpperCase().replace(/[^0-9A-F]/g, "");
  if (!value) return null;
  return `${algorithm} ${value}`;
}

/**
 * Derives the shared code from both fingerprints.
 *
 * The pair is sorted before hashing, which is what makes the sender and the
 * receiver agree: each device knows its own fingerprint as "local" and the
 * other's as "remote", so without sorting the two sides would hash the same
 * two values in opposite orders and derive two different codes — the exact
 * symptom the code exists to warn about, produced on every honest transfer.
 */
export async function deriveVerificationCode(
  localFingerprint: string | null,
  remoteFingerprint: string | null,
): Promise<string | null> {
  if (!localFingerprint || !remoteFingerprint) return null;
  if (typeof crypto === "undefined" || !crypto.subtle) return null;

  const ordered = [localFingerprint, remoteFingerprint].sort();
  // The label keeps this hash from colliding with any other use of the same
  // inputs elsewhere, now or later.
  const input = `sharefilesfree-verification-v1\n${ordered[0]}\n${ordered[1]}`;

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));

  // Read the needed bits off the digest one 5-bit group at a time. Taking
  // bytes and reducing them modulo 30 instead would bias the result towards
  // the earlier letters of the alphabet, which quietly narrows the search a
  // forger has to do.
  let bitBuffer = 0;
  let bitCount = 0;
  let out = "";
  let byteIndex = 0;

  while (out.length < CODE_CHARS) {
    if (bitCount < 5) {
      bitBuffer = (bitBuffer << 8) | digest[byteIndex++];
      bitCount += 8;
    }
    const index = (bitBuffer >> (bitCount - 5)) & 0b11111;
    bitCount -= 5;
    // 32 possible values across a 30-symbol alphabet: the two spare values are
    // discarded rather than folded back in, so every symbol stays equally
    // likely.
    if (index < ALPHABET.length) out += ALPHABET[index];
  }

  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
