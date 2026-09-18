import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };
const common = { width: 22, height: 22, viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export function HomeIcon({ filled, ...props }: IconProps) { return <svg {...common} {...props} fill={filled ? "currentColor" : "none"}><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>; }
export function InboxIcon({ filled, ...props }: IconProps) { return <svg {...common} {...props} fill={filled ? "currentColor" : "none"}><path d="M4 5h16v14H4z"/><path d="m4 13 4-3 3 3h2l3-3 4 3"/></svg>; }
export function BookmarkIcon({ filled, ...props }: IconProps) { return <svg {...common} {...props} fill={filled ? "currentColor" : "none"}><path d="M6 3h12v18l-6-4-6 4z"/></svg>; }
export function UserIcon({ filled, ...props }: IconProps) { return <svg {...common} {...props} fill={filled ? "currentColor" : "none"}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>; }
