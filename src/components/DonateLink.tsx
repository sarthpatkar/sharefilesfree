// Renders nothing unless NEXT_PUBLIC_DONATE_URL is actually set — we don't
// fabricate a payment destination. Set this once there's a real donation
// link (Buy Me a Coffee, UPI, etc.) to activate it; a stopgap for revenue
// before AdSense is approved, per the plan.
export function DonateLink() {
  const url = process.env.NEXT_PUBLIC_DONATE_URL;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
      Support this project
    </a>
  );
}
