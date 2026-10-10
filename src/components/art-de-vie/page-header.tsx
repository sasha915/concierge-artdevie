import { Link } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";
import { Logo, TopBar } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { Title } from "@/components/art-de-vie/v3";
export function SubHeader({ title, close = false, backTo = "/membership" }: { title: string; close?: boolean; backTo?: "/membership" | "/demandes" }) { return <>
  <div className="mb-7 flex items-center justify-between lg:hidden"><div className="w-11" /><Logo className="h-[19px] w-auto" /><div className="w-11" /></div>
  <header className="mb-8 flex items-start gap-4 lg:hidden"><Button asChild variant="outline" size="icon" aria-label={close ? "Fermer" : "Retour"} className="shrink-0"><Link to={backTo}>{close ? <X/> : <ChevronLeft/>}</Link></Button><Title italic={`${title.split(" ").slice(-1).join(" ")}.`} className="min-w-0 text-[38px] text-primary lg:text-[46px]">{title.split(" ").slice(0, -1).join(" ")}{title.includes(" ") ? " " : ""}</Title></header>
  <section className="hidden lg:mb-16 lg:flex lg:min-h-[440px] lg:flex-col lg:rounded-[28px] lg:bg-primary-deep lg:px-[clamp(20px,3.9vw,56px)] lg:py-6 lg:text-primary-foreground"><TopBar/><p className="lg:eyebrow lg:mt-16 lg:text-primary-foreground/80">{title}</p><Title italic={`${title.split(" ").slice(-1).join(" ")}.`} className="lg:mt-5 lg:text-[clamp(52px,7.2vw,104px)] lg:leading-[0.96]">{title.split(" ").slice(0, -1).join(" ")} </Title><div className="lg:mt-8 lg:flex lg:justify-end lg:border-t lg:border-primary-foreground/22 lg:pt-5"><Button asChild variant="outline" className="lg:h-11 lg:border-primary-foreground/22 lg:text-primary-foreground lg:hover:bg-primary-foreground/10"><Link to={backTo}>{close ? <X/> : <ChevronLeft/>}{close ? "Fermer" : "Retour"}</Link></Button></div></section>
</>; }
