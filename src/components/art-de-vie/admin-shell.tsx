import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/art-de-vie/app-shell";
import { supabase } from "@/integrations/supabase/client";

export function AdminShell({ children, title = "Administration" }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/connexion", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-primary/10 bg-primary-deep text-primary-foreground">
        <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-5 sm:px-8 lg:px-10 xl:px-12">
          <div className="flex items-center gap-3">
            <Logo inverse className="h-[19px] w-auto" />
            <span className="text-[18px] font-medium leading-none">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-[13px] font-medium text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground sm:inline-flex">
              <Link to="/membership"><ArrowLeft className="size-4" />Retour à l’espace membre</Link>
            </Button>
            <Button aria-label="Se déconnecter" variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 pb-10 pt-6 sm:px-8 lg:px-10 lg:pt-8 xl:px-12">
        {children}
      </main>
    </div>
  );
}
