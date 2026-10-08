import { Link } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { Title } from "@/components/art-de-vie/v3";
export function SubHeader({ title, close = false, backTo = "/membership" }: { title: string; close?: boolean; backTo?: "/membership" | "/demandes" }) { return <>
  <div className="mb-7 flex items-center justify-between lg:hidden"><div className="w-11" /><Logo className="h-[19px] w-auto" /><div className="w-11" /></div>
  <header className="mb-8 flex items-start gap-4"><Button asChild variant="outline" size="icon" aria-label={close ? "Fermer" : "Retour"} className="shrink-0"><Link to={backTo}>{close ? <X/> : <ChevronLeft/>}</Link></Button><Title italic={`${title.split(" ").slice(-1).join(" ")}.`} className="min-w-0 text-[38px] text-primary lg:text-[46px]">{title.split(" ").slice(0, -1).join(" ")}{title.includes(" ") ? " " : ""}</Title></header>
</>; }
