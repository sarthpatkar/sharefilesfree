import { ImageResponse } from "next/og";

// Generated at request time (cached by Next.js) — no external design asset needed.
// This is what shows up when a shared link is pasted into Slack/Discord/WhatsApp;
// per the plan's growth section, a clean branded preview is what makes a shared
// link look trustworthy instead of like a random URL.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, display: "flex" }}>ShareFilesFree</div>
        <div style={{ fontSize: 36, color: "#6ee7b7", marginTop: 24, display: "flex" }}>
          Send large files free — no signup, no login
        </div>
      </div>
    ),
    { ...size },
  );
}
