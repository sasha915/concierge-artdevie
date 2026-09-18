import { Link } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function SubHeader({ title, close = false, backTo = "/membership" }: { title: string; close?: boolean; backTo?: "/membership" | "/demandes" }) { return <header className="mb-8 flex items-center gap-4"><Button asChild variant="icon" size="icon" aria-label={close ? "Fermer" : "Retour"}><Link to={backTo}>{close ? <X/> : <ChevronLeft/>}</Link></Button><h1 className="font-display text-[32px] font-semibold leading-[38px] text-primary">{title}</h1></header>; }
