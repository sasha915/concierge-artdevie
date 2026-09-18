import { Link } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
export function SubHeader({ title, close = false, backTo = "/membership" }: { title: string; close?: boolean; backTo?: "/membership" | "/demandes" }) { return <>
  <div className="mb-6 flex items-center justify-between"><div className="w-11" /><Logo className="h-[19px] w-auto" /><div className="w-11" /></div>
  <header className="mb-8 flex items-center gap-4"><Button asChild variant="icon" size="icon" aria-label={close ? "Fermer" : "Retour"}><Link to={backTo}>{close ? <X/> : <ChevronLeft/>}</Link></Button><h1 className="font-display text-[32px] font-semibold leading-tight text-primary">{title}</h1></header>
</>; }
