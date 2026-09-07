import { describe, expect, it } from "vitest";
import { executableExtensionOf, sanitizeFilename } from "./sanitize";

describe("sanitizeFilename", () => {
  it("leaves a normal filename untouched", () => {
    expect(sanitizeFilename("vacation-photo.jpg")).toBe("vacation-photo.jpg");
  });

  it("strips CR/LF that could otherwise inject extra HTTP headers", () => {
    expect(sanitizeFilename("evil\r\nX-Injected: true.txt")).toBe("evilX-Injected true.txt");
  });

  it("strips double quotes that would break out of the Content-Disposition value", () => {
    expect(sanitizeFilename('file".pdf')).toBe("file.pdf");
  });

  it("falls back to a default name if nothing is left after cleaning", () => {
    expect(sanitizeFilename("\r\n\x00")).toBe("file");
  });

  it("caps length at 255 characters", () => {
    const long = "a".repeat(500);
    expect(sanitizeFilename(long).length).toBe(255);
  });

  // The reason this file exists in its current form. A name carrying U+202E
  // renders in reverse from that point on, so the extension a person reads is
  // not the extension the OS executes (MITRE ATT&CK T1036.002).
  it("strips the right-to-left override used to disguise an extension", () => {
    const disguised = "invoice\u202Egnp.exe";
    const cleaned = sanitizeFilename(disguised);
    expect(cleaned).not.toContain("\u202E");
    expect(cleaned).toBe("invoicegnp.exe");
  });

  it("strips every other bidi formatting character too", () => {
    for (const ch of ["\u200E", "\u200F", "\u202A", "\u202B", "\u202C", "\u202D", "\u2066", "\u2069"]) {
      expect(sanitizeFilename(`a${ch}b.txt`)).toBe("ab.txt");
    }
  });

  it("strips path separators rather than trusting each consumer to reject them", () => {
    expect(sanitizeFilename("../../.bashrc")).toBe("bashrc");
    expect(sanitizeFilename("..\\..\\windows\\system32\\evil.dll")).toBe("windowssystem32evil.dll");
  });

  it("does not leave a name that is hidden on Unix", () => {
    expect(sanitizeFilename(".hidden")).toBe("hidden");
  });

  it("drops trailing dots and spaces, which Windows would strip after any check", () => {
    expect(sanitizeFilename("payload.exe.")).toBe("payload.exe");
    expect(sanitizeFilename("payload.exe   ")).toBe("payload.exe");
  });

  it("defuses Windows device names", () => {
    expect(sanitizeFilename("CON")).toBe("_CON");
    expect(sanitizeFilename("con.txt")).toBe("_con.txt");
    expect(sanitizeFilename("LPT1.log")).toBe("_LPT1.log");
    // Not a device name — must be left alone.
    expect(sanitizeFilename("console.log")).toBe("console.log");
  });

  it("keeps legitimate non-Latin filenames intact", () => {
    expect(sanitizeFilename("صورة.jpg")).toBe("صورة.jpg");
    expect(sanitizeFilename("写真.png")).toBe("写真.png");
  });
});

describe("executableExtensionOf", () => {
  it("flags executables and scripts", () => {
    expect(executableExtensionOf("setup.exe")).toBe("exe");
    expect(executableExtensionOf("run.SH")).toBe("sh");
    expect(executableExtensionOf("app.apk")).toBe("apk");
    expect(executableExtensionOf("budget.xlsm")).toBe("xlsm");
  });

  it("reads the final extension, not the one meant to reassure", () => {
    expect(executableExtensionOf("holiday-photo.png.exe")).toBe("exe");
  });

  it("leaves ordinary documents and media alone", () => {
    for (const name of ["report.pdf", "photo.jpg", "song.mp3", "archive.zip", "notes.txt"]) {
      expect(executableExtensionOf(name)).toBeNull();
    }
  });

  it("returns null for a name with no usable extension", () => {
    expect(executableExtensionOf("README")).toBeNull();
    expect(executableExtensionOf("trailing.")).toBeNull();
    expect(executableExtensionOf(".exe")).toBeNull();
  });
});
