import { Logo } from "@/components/art-de-vie/app-shell";
import { Star } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { formatMonth, initials, type Profile } from "@/data/art-de-vie";

export function MemberCard({ profile }: { profile: Profile | null }) {
  const [tilt, setTilt] = useState({ x: 4, y: -4 });
  function move(e: MouseEvent<HTMLDivElement>) { const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientY-r.top)/r.height-.5)*-8, y: ((e.clientX-r.left)/r.width-.5)*10 }); }
  const name = profile?.full_name?.trim() || "Membre Art de Vie";
  return <div className="perspective-distant" onMouseMove={move} onMouseLeave={() => setTilt({ x: 4, y: -4 })}>
    <div className="member-grain aspect-[1.586/1] w-full rounded-[22px] border border-gold bg-linear-to-br from-primary via-primary-light to-primary-deep p-6 text-primary-foreground shadow-member transition-transform duration-300 motion-reduce:transform-none sm:p-8" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
      <div className="flex items-start justify-between"><Logo inverse className="h-5 w-auto" /><div className="flex size-10 items-center justify-center rounded-full border border-gold font-display text-sm">{initials(name)}</div></div>
      <div className="mt-8 sm:mt-12"><div className="flex items-center gap-3"><span className="font-display text-2xl sm:text-3xl">{profile?.plan ?? "Signature"}</span><span className="rounded-full border border-gold px-2.5 py-1 text-[9px] font-semibold">VIP</span></div><p className="mt-3 text-[11px] tracking-[0.13em]">{profile?.member_number ?? "N° ADV"}</p><p className="mt-1 text-sm font-medium">{name}</p></div>
      <div className="mt-6 flex justify-between text-[9px] uppercase tracking-[0.13em] opacity-80"><span>Membre depuis<br/><b className="font-medium normal-case tracking-normal">{formatMonth(profile?.member_since)}</b></span><span className="text-right">Validité<br/><b className="font-medium normal-case tracking-normal">{formatMonth(profile?.valid_until)}</b></span></div>
    </div>
  </div>;
}
