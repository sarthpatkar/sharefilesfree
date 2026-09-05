// A small hand-built icon set — consistent 1.75px stroke, joins,
// 24x24 viewBox — used everywhere instead of emoji. Emoji render inconsistently
// across platforms and read as a placeholder rather than a designed detail;
// a matched line-icon set is one of the fastest ways to make an interface
// feel considered rather than assembled from defaults.
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconUpload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 16V4M12 4l-4.5 4.5M12 4l4.5 4.5" />
      <path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" />
    </svg>
  );
}

export function IconPackage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M21 8.5v7c0 .35-.19.67-.5.84l-8 4.5a1 1 0 0 1-1 0l-8-4.5a.96.96 0 0 1-.5-.84v-7c0-.35.19-.67.5-.84l8-4.5a1 1 0 0 1 1 0l8 4.5c.31.17.5.49.5.84Z" />
      <path d="M3.27 7.96 12 12.5l8.73-4.54M12 21.5V12.5" />
    </svg>
  );
}

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 3v18" />
      <path d="M5 4.5c1.4-1 3-1 4.5 0s3.1 1 4.5 0 3-1 4.5 0v9c-1.5-1-3-1-4.5 0s-3.1 1-4.5 0-3.1-1-4.5 0Z" />
    </svg>
  );
}

export function IconWarning(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10.3 3.9 2.6 18a1.5 1.5 0 0 0 1.3 2.2h16.2a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9.5v4.25M12 17v.01" />
    </svg>
  );
}

export function IconCompass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-2 6-6 2 2-6z" />
    </svg>
  );
}

export function IconBlocked(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m6.2 6.2 11.6 11.6" />
    </svg>
  );
}

export function IconLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.3 5.2a3.2 3.2 0 0 1 4.5 4.5L15.5 11" />
      <path d="M13 17.5 11.7 18.8a3.2 3.2 0 0 1-4.5-4.5L8.5 13" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m5 13 4.5 4.5L19 8" />
    </svg>
  );
}

export function IconArrowLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5M5 12l6-6M5 12l6 6" />
    </svg>
  );
}

export function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v12M12 16l4.5-4.5M12 16l-4.5-4.5" />
      <path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" />
    </svg>
  );
}

export function IconShrink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M9 4v4a1 1 0 0 1-1 1H4" />
      <path d="M20 9h-4a1 1 0 0 1-1-1V4" />
      <path d="M4 15h4a1 1 0 0 1 1 1v4" />
      <path d="M15 20v-4a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

export function IconStack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-3.5-7.5L3 10z" />
    </svg>
  );
}

export function IconHeart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 20.5 4.2 12.9a4.8 4.8 0 0 1 0-6.9 5 5 0 0 1 7 0l.8.8.8-.8a5 5 0 0 1 7 0 4.8 4.8 0 0 1 0 6.9Z" />
    </svg>
  );
}

export function IconTool(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M14.7 6.3a4 4 0 0 1 5 5l-6.6 6.6a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8l6.6-6.6Z" />
      <path d="m9 9-4.5-4.5a2 2 0 0 0-2.5 2.5L6.5 12" />
    </svg>
  );
}

export function IconScissors(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8.5 8 20 19M8.5 16 20 5" />
    </svg>
  );
}

export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5Z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </svg>
  );
}

export function IconStamp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M9 4h6l1 5H8Z" />
      <path d="M9 9v3a3 3 0 0 0 6 0V9" />
      <path d="M6 20v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconHash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 9h14M5 15h14M9 4 7 20M17 4l-2 16" />
    </svg>
  );
}

export function IconFileText(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8.5 13h7M8.5 16.5h7" />
    </svg>
  );
}

export function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 15.5h17M9.5 3.5v17M15.5 3.5v17" />
    </svg>
  );
}

export function IconPresentation(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M12 16v4M8 20h8" />
    </svg>
  );
}

export function IconMarkdown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M6 15V9l3 3.5L12 9v6M15 9v4m0 0 2-2m-2 2-2-2" />
    </svg>
  );
}

export function IconQrCode(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM19 14h1.5v1.5H19zM14 19h1.5v1.5H14zM19 19h1.5v1.5H19z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconImage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </svg>
  );
}

export function IconTextScan(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7.5 9.5h9M7.5 12.5h9M7.5 15.5h5" />
    </svg>
  );
}
