import { Logo } from "@/components/art-de-vie/app-shell";
import { Star } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { formatMonth, initials, type Profile } from "@/data/art-de-vie";

export function MemberCard({ profile }: { profile: Profile | null }) {
  const [tilt, setTilt] = useState({ x: 4, y: -4 });
  function move(e: MouseEvent<HTMLDivElement>) { const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientY-r.top)/r.height-.5)*-8, y: ((e.clientX-r.left)/r.width-.5)*10 }); }
  const name = profile?.full_name?.trim() || "Membre Art de Vie";
  return <div className="perspective-distant" onMouseMove={move} onMouseLeave={() => setTilt({ x: 4, y: -4 })}>
    <div className="member-grain relative w-full overflow-hidden rounded-[22px] border border-gold bg-linear-to-br from-primary via-primary-light to-primary-deep p-5 text-primary-foreground shadow-member transition-transform duration-300 motion-reduce:transform-none sm:p-7" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
      <div className="pointer-events-none absolute -top-[50px] -right-[40px] z-10 size-[200px] rounded-full bg-primary-foreground/10" />
      <div className="pointer-events-none absolute inset-[-20%] z-20 bg-[image:var(--member-reflection)]" />
      <div className="relative z-30">
        <div className="flex items-start justify-between"><Logo inverse className="h-5 w-auto" /><div className="flex size-10 items-center justify-center rounded-full border border-gold font-display text-sm">{initials(name)}</div></div>
        <div className="mt-[18px] flex items-center gap-3"><span className="font-display text-2xl sm:text-3xl">{profile?.plan ?? "Signature"}</span><span className="relative top-[2px] inline-flex items-center gap-1 rounded-full border border-gold px-2.5 py-1 text-[9px] font-semibold text-primary-foreground"><Star className="size-2.5 text-gold" />VIP</span></div>
        <p className="mt-[10px] text-[11px] tracking-[0.13em]">{profile?.member_number ?? "N° ADV"}</p>
        <p className="mt-1 text-sm font-medium">{name}</p>
        <div className="mt-5 flex justify-between border-t border-primary-foreground/[0.18] pt-3 text-[9px] uppercase tracking-[0.13em] opacity-80"><span>Membre depuis<br/><b className="font-medium normal-case tracking-normal">{formatMonth(profile?.member_since)}</b></span><span className="text-right">Validité<br/><b className="font-medium normal-case tracking-normal">{formatMonth(profile?.valid_until)}</b></span></div>
      </div>
    </div>
  </div>;
}