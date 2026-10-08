import { cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/data/art-de-vie";

export function Title({ children, italic, className, as: Tag = "h1" }: { children?: ReactNode; italic: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return <Tag className={cn("v3-heading text-[46px]", className)}>{children}<em className="font-display font-normal">{italic}</em></Tag>;
}

export function ArrowCircle({ diagonal = false, inverse = false, className }: { diagonal?: boolean; inverse?: boolean; className?: string }) {
  const Icon = diagonal ? ArrowUpRight : ArrowRight;
  return <span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", inverse ? "bg-primary text-primary-foreground" : "bg-background text-primary", className)}><Icon className="size-5" /></span>;
}

export function PillAction({ children, light = false, ...props }: React.ComponentProps<typeof Button> & { light?: boolean }) {
  const arrow = <ArrowCircle inverse={light} className="size-9" />;
  const content = props.asChild && isValidElement<{ children?: ReactNode }>(children) ? cloneElement(children, {}, children.props.children, arrow) : <>{children}{arrow}</>;
  return <Button {...props} size="lg" variant={light ? "light" : "primary"} className={cn("justify-between gap-4 pl-6 pr-2 text-[15px]", props.className)}>{content}</Button>;
}

const steps: RequestStatus[] = ["Nouvelle", "En cours", "Confirmée", "Terminée"];
export function StatusTimeline({ status, dark = false }: { status: RequestStatus; dark?: boolean }) {
  if (status === "Annulée") return null;
  const current = steps.indexOf(status);
  return <ol aria-label={`Suivi : ${status}`} className="grid grid-cols-4 gap-1.5">{steps.map((step, index) => <li key={step} aria-current={current === index ? "step" : undefined} className={cn("min-w-0 text-[10px] leading-4", dark ? "text-primary-foreground" : "text-primary")}><span className={cn("mb-2 block h-[3px] rounded-full", dark ? index <= current ? "bg-primary-foreground" : "bg-primary-foreground/25" : index <= current ? "bg-primary" : "bg-primary/15")} /><span className={current === index ? "font-medium" : "font-normal"}>{step}</span></li>)}</ol>;
}

export function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 650, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span aria-label={String(value)} className="block font-display text-[72px] font-normal leading-none"><span aria-hidden="true">{display}</span></span>;
}