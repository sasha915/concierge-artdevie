import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };
// Icônes de la barre de navigation V4 : traits fins de la maquette, jamais pleines ; l'onglet actif est signalé par son cercle.
const common = { width: 20, height: 20, viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
export function HomeIcon({ filled: _filled, ...props }: IconProps) { return <svg {...common} {...props}><path d="M4 10.5 12 4l8 6.5V20H4z" /></svg>; }
export function InboxIcon({ filled: _filled, ...props }: IconProps) { return <svg {...common} {...props}><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5.4 5.5 3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6l-2.4-6.5A1 1 0 0 0 17.7 5H6.3a1 1 0 0 0-.9.5z" /></svg>; }
export function BookmarkIcon({ filled: _filled, ...props }: IconProps) { return <svg {...common} {...props}><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" /></svg>; }
export function UserIcon({ filled: _filled, ...props }: IconProps) { return <svg {...common} {...props}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" /></svg>; }
