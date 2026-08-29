import type { MetadataRoute } from "next";

// Lets mobile users "Add to Home Screen" and get an app-like icon/launch —
// a cheap way to reinforce the "works seamlessly across devices" goal without
// building a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShareFilesFree",
    short_name: "ShareFilesFree",
    description: "Send large files free, no signup, no login.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1512",
    theme_color: "#0b6e4f",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
