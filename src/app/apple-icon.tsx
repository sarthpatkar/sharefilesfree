import { ImageResponse } from "next/og";

// Apple applies its own rounding/mask to home-screen icons, so this is a
// plain filled square — matching Apple's convention (unlike icon.tsx above).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#059669",
          color: "#fff",
          fontSize: 112,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
