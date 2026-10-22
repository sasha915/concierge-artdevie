import { Link } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";
import { Logo, TopBar } from "@/components/art-de-vie/app-shell";
import { Button } from "@/components/ui/button";
import { Title } from "@/components/art-de-vie/v3";
import { t } from "@/lib/i18n";
export function SubHeader({
  title: rawTitle,
  close = false,
  backTo = "/membership",
}: {
  title: string;
  close?: boolean;
  backTo?: "/membership" | "/demandes";
}) {
  const title = t(rawTitle);
  return (
    <>
      <div className="mb-7 flex items-center justify-between lg:hidden">
        <div className="w-11" />
        <Logo inverse className="h-[19px] w-auto" />
        <div className="w-11" />
      </div>
      <header className="mb-8 flex items-start gap-4 lg:hidden">
        <Button asChild variant="outline" size="icon" aria-label={close ? t("Fermer") : t("Retour")} className="shrink-0">
          <Link to={backTo}>{close ? <X /> : <ChevronLeft />}</Link>
        </Button>
        <Title
          italic={`${title.split(" ").slice(-1).join(" ")}.`}
          className="min-w-0 text-[38px] text-primary lg:text-[46px]"
        >
          {title.split(" ").slice(0, -1).join(" ")}
          {title.includes(" ") ? " " : ""}
        </Title>
      </header>
      <section className="hidden lg:mb-10 lg:block lg:text-foreground">
        <TopBar />
        <div className="lg:mt-14 lg:flex lg:flex-wrap lg:items-end lg:justify-between lg:gap-6 lg:px-4">
          <div>
            <p className="eyebrow text-muted-foreground">{title}</p>
            <Title
              italic={`${title.split(" ").slice(-1).join(" ")}.`}
              className="lg:mt-5 lg:text-[clamp(52px,5.6vw,88px)] lg:leading-[0.98]"
            >
              {title.split(" ").slice(0, -1).join(" ")}{" "}
            </Title>
          </div>
          <Button
            asChild
            variant="outline"
            className="lg:h-11 lg:border-foreground/24 lg:text-foreground lg:hover:bg-foreground/10"
          >
            <Link to={backTo}>
              {close ? <X /> : <ChevronLeft />}
              {close ? t("Fermer") : t("Retour")}
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
