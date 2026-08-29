import { ImageResponse } from "next/og";

// Generated favicon — replaces create-next-app's default placeholder icon.
// A simple bold "S" mark on the brand's emerald color, legible at tiny sizes.
// Sized at 512 so the same generated image doubles as the PWA manifest icon
// (see manifest.ts) — browsers downscale it fine for the tab favicon too.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b6e4f",
          borderRadius: 112,
          color: "#fff",
          fontSize: 320,
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
