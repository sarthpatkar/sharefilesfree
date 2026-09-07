/**
 * Filename handling for names that arrive from a stranger's machine.
 *
 * A received filename is untrusted input in the strictest sense: it was chosen
 * by whoever is on the other end of the data channel, it is rendered in this
 * page's UI, it is handed to the `download` attribute, and — when the receiver
 * picked a folder — it becomes a real name in a real directory on their disk.
 * Four different consumers, each with a different way of being tricked.
 */

/**
 * Unicode bidirectional formatting characters.
 *
 * These are why this function exists in its current form. U+202E
 * (RIGHT-TO-LEFT OVERRIDE) reverses the display of everything after it, so a
 * file genuinely named `invoice<U+202E>gnp.exe` is *displayed* by every normal
 * UI — this site's file list, the browser's download shelf, the OS file
 * manager — as `invoice exe.png`. The receiver believes they saved a PNG and
 * runs an executable.
 *
 * This is not theoretical or obscure: it is MITRE ATT&CK T1036.002
 * ("Masquerading: Right-to-Left Override"), catalogued precisely because it
 * has been used in real spearphishing campaigns for over a decade. For a
 * service whose entire promise to a receiver is "you can trust what lands on
 * your machine", a filename that lies about its own extension is the single
 * most dangerous thing that can cross the wire — the bytes are the sender's
 * business, but the name is ours.
 *
 * All of these are stripped rather than escaped. There is no legitimate reason
 * for a filename to contain a bidi override: genuine right-to-left filenames
 * (Arabic, Hebrew) rely on the characters' own inherent direction and render
 * correctly without any override marker at all.
 */
const BIDI_CONTROL = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Control characters, including CR/LF, plus the quote that breaks out of a quoted value. */
const CONTROL_AND_QUOTE = /[\x00-\x1f\x7f"]/g;

/**
 * Path separators and the characters Windows forbids in a name.
 *
 * The File System Access API rejects a name containing a separator on its own
 * account, and the `download` attribute has its own sanitizer — but both of
 * those are someone else's guarantee about someone else's code, and neither is
 * a reason to hand them `../../.bashrc` in the first place. Stripping here
 * makes the property true before it leaves this function rather than hoping it
 * is enforced by each of the four consumers downstream.
 */
const SEPARATORS_AND_RESERVED = /[/\\:*?<>|]/g;

/**
 * Names Windows treats as devices rather than files, in any directory and with
 * any extension — `CON.txt` is still the console. Saving to one fails in
 * confusing ways at best.
 */
const WINDOWS_DEVICE_NAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function sanitizeFilename(name: string): string {
  let cleaned = String(name)
    .replace(CONTROL_AND_QUOTE, "")
    .replace(BIDI_CONTROL, "")
    .replace(SEPARATORS_AND_RESERVED, "");

  // Leading dots hide a file on Unix; a name that is nothing but dots is the
  // relative-path trick (`.`, `..`) wearing a hat.
  cleaned = cleaned.replace(/^\.+/, "");

  // Windows silently drops trailing dots and spaces when saving, which turns
  // `payload.exe.` into `payload.exe` AFTER any check that looked at the name
  // as given. Drop them here so what we inspect is what gets written.
  cleaned = cleaned.replace(/[. ]+$/, "").trim();

  if (WINDOWS_DEVICE_NAMES.test(cleaned)) cleaned = `_${cleaned}`;

  // Truncate before the fallback, so a name that is 300 characters of padding
  // followed by nothing useful still ends up with something.
  cleaned = cleaned.slice(0, 255);

  return cleaned || "file";
}

/**
 * Extensions that hand control of the receiver's machine to whoever sent the
 * file, if it is opened.
 *
 * This service cannot scan for malware and never will be able to: the bytes go
 * directly between two browsers and are never present on any server we run, so
 * there is nothing to scan even in principle. That is a deliberate property,
 * not a gap — but it means the honest thing to do is say plainly when an
 * arriving file is the *kind* of file that can do harm, and let the person
 * decide.
 *
 * This is the lesson of Firefox Send, which Mozilla shut down permanently in
 * 2020 after ransomware crews (REvil), banking trojans (Zloader, Ursnif) and
 * targeted-surveillance operators adopted it as a delivery channel. The
 * encryption that made it private also made the payloads unscannable, and with
 * no signal to the recipient and no way to report abuse, the service became
 * more useful to attackers than to everyone else.
 *
 * Two things make this service a much poorer malware channel than Send was,
 * and both are structural rather than promises: nothing is stored, so there is
 * no durable link to put in a phishing email, and both parties must be online
 * at the same moment, so delivery requires a live accomplice rather than a
 * dead drop. This list is the remaining piece — the receiver is told what kind
 * of thing they are about to accept, before they accept it.
 */
const DANGEROUS_EXTENSIONS = new Set([
  // Windows executables and installers
  "exe", "scr", "com", "pif", "msi", "msp", "msc", "cpl", "dll", "sys", "ocx", "drv",
  "application", "gadget", "hta", "chm", "lnk", "inf", "reg", "jnlp",
  // Scripts that run on a double-click
  "bat", "cmd", "vbs", "vbe", "js", "jse", "wsf", "wsh", "ps1", "psm1", "ps1xml",
  // macOS
  "dmg", "pkg", "app", "command", "workflow", "scpt", "osascript",
  // Linux / cross-platform
  "sh", "bash", "run", "deb", "rpm", "appimage", "bin", "elf", "jar",
  // Mobile app packages
  "apk", "ipa",
  // Browser extensions
  "xpi", "crx",
  // Office documents with macros enabled — the classic phishing payload
  "docm", "xlsm", "pptm", "dotm", "xltm", "potm", "xlam", "ppam",
  // Disk images, routinely used to carry a payload past mark-of-the-web
  "iso", "img", "vhd", "vhdx",
]);

/**
 * Returns the lowercased extension if this name ends in one that can execute,
 * otherwise null.
 *
 * Deliberately checks only the FINAL extension, because that is the only one
 * the operating system acts on. `holiday-photo.png.exe` is an executable, and
 * reporting it as one is the entire point — a receiver scanning a list of
 * filenames reads the part they recognise and stops.
 */
export function executableExtensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(ext) ? ext : null;
}
