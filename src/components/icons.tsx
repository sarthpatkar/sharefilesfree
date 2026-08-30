// A small hand-built icon set — consistent 1.75px stroke, rounded joins,
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

export function IconTool(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M14.7 6.3a4 4 0 0 1 5 5l-6.6 6.6a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8l6.6-6.6Z" />
      <path d="m9 9-4.5-4.5a2 2 0 0 0-2.5 2.5L6.5 12" />
    </svg>
  );
}
