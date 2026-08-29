import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "./sanitize";

describe("sanitizeFilename", () => {
  it("leaves a normal filename untouched", () => {
    expect(sanitizeFilename("vacation-photo.jpg")).toBe("vacation-photo.jpg");
  });

  it("strips CR/LF that could otherwise inject extra HTTP headers", () => {
    expect(sanitizeFilename("evil\r\nX-Injected: true.txt")).toBe("evilX-Injected: true.txt");
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
});
