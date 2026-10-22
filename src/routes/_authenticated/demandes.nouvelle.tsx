import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { AppShell, Logo, TopBar } from "@/components/art-de-vie/app-shell";
import { Photo } from "@/components/art-de-vie/cards";
import { PillAction, StatusTimeline, Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import bassin from "@/assets/v3/bassin.jpg.asset.json";
import entree from "@/assets/v3/entree-de-nuit.jpg.asset.json";
import vendome from "@/assets/v3/place-vendome.jpg.asset.json";
import village from "@/assets/v3/village-cotier.jpg.asset.json";

const cats = [
  { name: "Tables", note: "Restaurants et tables privées", image: entree.url, imageKey: "entree-de-nuit" },
  { name: "Séjours", note: "Hôtels, villas, escapades", image: village.url, imageKey: "village-cotier" },
  { name: "Transferts", note: "Chauffeurs et trajets privés", image: vendome.url, imageKey: "place-vendome" },
  { name: "Soins", note: "Spa et soins à domicile", image: bassin.url, imageKey: "bassin" },
] as const;

const surMesure = { name: "Sur mesure", note: "Billetterie, intendance, démarches", imageKey: "sur-mesure" } as const;
const allCats = [...cats, surMesure];

export const Route = createFileRoute("/_authenticated/demandes/nouvelle")({
  validateSearch: (search: Record<string, unknown>) => ({
    offer: typeof search["offer"] === "string" ? search["offer"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nouvelle demande — Art de Vie" },
      { name: "description", content: "Confiez une nouvelle demande à votre concierge." },
      { property: "og:title", content: "Nouvelle demande — Art de Vie" },
      { property: "og:description", content: "Confiez une nouvelle demande à votre concierge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { offer } = Route.useSearch();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState("Tables");
  const [title, setTitle] = useState(offer ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      setError("Votre session a expiré. Reconnectez-vous.");
      return;
    }
    const { data, error } = await supabase
      .from("requests")
      .insert({
        user_id: auth.user.id,
        category,
        title: title || `Demande ${category.toLowerCase()}`,
        description,
        scheduled_date: date || null,
        scheduled_time: time || null,
        guests: guests ? Number(guests) : null,
        image_key: allCats.find((cat) => cat.name === category)?.imageKey ?? "entree-de-nuit",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setError("L’envoi a échoué. Réessayez dans un instant.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["requests"] });
    setCreatedId(data.id);
  }

  if (createdId)
    return (
      <AppShell nav={false}>
        <div className="mx-auto max-w-[720px] lg:max-w-none">
          <div className="lg:hidden">
            <WizardHeader step={3} complete />
          </div>
          <DesktopWizardHeader step={3} complete />
          <section className="px-1 pt-16 text-primary lg:mx-[clamp(20px,3.9vw,56px)] lg:grid lg:grid-cols-12 lg:gap-x-12">
            <span className="flex size-20 items-center justify-center rounded-full lg:col-start-8 lg:row-start-1 bg-primary text-background">
              <Check className="size-8" />
            </span>
            <Title italic="transmise." className="mt-8 text-[46px] lg:hidden">
              Demande
              <br />
            </Title>
            <p className="mt-5 max-w-md text-[14px] leading-6 text-muted-foreground lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:text-[18px] lg:leading-7">
              Vous pouvez suivre son avancement à tout moment depuis Mes demandes.
            </p>
            <div className="mt-7 rounded-[28px] bg-primary/10 p-5 lg:col-span-7 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:mt-0 lg:p-8">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-primary">{category}</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium">Nouvelle</span>
              </div>
              <h2 className="v3-card-title mt-6 text-[23px] lg:text-[40px]">{title}</h2>
              <div className="mt-5">
                <StatusTimeline status="Nouvelle" />
              </div>
            </div>
            <PillAction asChild className="mt-7 w-full lg:col-span-5 lg:col-start-8 lg:row-start-3 lg:w-fit">
              <Link to="/demandes">Voir mes demandes</Link>
            </PillAction>
            <Button
              variant="link"
              className="mt-2 px-0 lg:col-span-5 lg:col-start-8 lg:row-start-4 lg:justify-start"
              onClick={() => navigate({ to: "/" })}
            >
              Retour à l’accueil
            </Button>
          </section>
        </div>
      </AppShell>
    );

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-[760px] lg:max-w-none">
        <div className="lg:hidden">
          <WizardHeader step={step} />
        </div>
        <DesktopWizardHeader step={step} />
        {step === 1 && (
          <section className="pt-8 lg:mx-[clamp(20px,3.9vw,56px)] lg:pt-16">
            <p className="eyebrow text-primary lg:hidden">Catégorie</p>
            <Title italic="organiser ?" className="mt-4 text-[38px] text-primary lg:hidden">
              Que pouvons-nous
              <br />
            </Title>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:mt-0 lg:grid-cols-4 lg:gap-4">
              {cats.map((cat) => (
                <Button
                  key={cat.name}
                  type="button"
                  variant="ghost"
                  onClick={() => setCategory(cat.name)}
                  className={cn(
                    "relative h-[188px] lg:h-[400px] overflow-hidden rounded-[18px] border-2 p-0 text-left text-foreground transition-transform active:scale-[0.98]",
                    category === cat.name ? "border-primary" : "border-transparent",
                  )}
                >
                  <Photo src={cat.image} alt={cat.name} className="absolute inset-0 h-full w-full" />
                  <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-foreground/60 bg-foreground/10">
                    {category === cat.name && <Check className="size-4" />}
                  </span>
                  <span className="absolute inset-x-4 bottom-4 whitespace-normal">
                    <strong className="block text-[20px] font-normal lg:text-[40px]">{cat.name}</strong>
                    <small className="mt-1 block text-[11px] leading-4">{cat.note}</small>
                  </span>
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCategory(surMesure.name)}
              className={cn(
                "relative mt-3 h-[120px] w-full overflow-hidden rounded-[18px] border-2 bg-primary-deep p-0 text-left text-foreground transition-transform active:scale-[0.98] lg:mt-4 lg:h-[180px]",
                category === surMesure.name ? "border-primary" : "border-transparent",
              )}
            >
              <Logo
                inverse
                className="pointer-events-none absolute -right-6 -bottom-10 h-[180px] w-auto opacity-[0.06] lg:h-[260px]"
              />
              <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-foreground/60 bg-foreground/10">
                {category === surMesure.name && <Check className="size-4" />}
              </span>
              <span className="absolute inset-x-5 bottom-4 whitespace-normal">
                <strong className="block text-[20px] font-normal lg:text-[32px]">
                  Sur <span className="font-display italic">mesure</span>
                </strong>
                <small className="mt-1 block text-[11px] leading-4">{surMesure.note}</small>
              </span>
            </Button>
            <PillAction className="mt-6 w-full lg:ml-auto lg:flex lg:w-[220px]" onClick={() => setStep(2)}>
              Continuer
            </PillAction>
          </section>
        )}
        {step === 2 && (
          <section className="pt-8 lg:mx-[clamp(20px,3.9vw,56px)] lg:grid lg:grid-cols-12 lg:gap-6 lg:pt-16">
            <aside className="hidden lg:col-span-4 lg:flex lg:flex-col lg:rounded-[28px] lg:bg-primary-deep lg:p-8 lg:text-foreground">
              <p className="lg:eyebrow lg:text-foreground/80">Catégorie</p>
              <h2 className="lg:v3-card-title lg:mt-auto lg:pt-24 lg:text-[64px]">{category}</h2>
              <p className="lg:mt-5 lg:text-[16px] lg:leading-7">
                Indiquez l’essentiel ; votre concierge reviendra vers vous pour le reste.
              </p>
            </aside>
            <p className="eyebrow text-primary lg:hidden">Détails · {category}</p>
            <Title italic="demande." className="mt-4 text-[38px] text-primary lg:hidden">
              Votre{" "}
            </Title>
            <form
              className="mt-6 rounded-card bg-card p-4 sm:p-7 lg:col-span-8 lg:mt-0 lg:p-8"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(3);
              }}
            >
              <div className="grid gap-5 lg:grid-cols-3">
                <Field label="Prestation souhaitée" desktopFull>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Ex. Une table avec vue"
                  />
                </Field>
                <Field label="Date souhaitée">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                  <Field label="Heure">
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </Field>
                  <Field label={category === "Tables" ? "Couverts" : "Personnes"}>
                    <Input
                      type="number"
                      min="1"
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      placeholder="2"
                    />
                  </Field>
                </div>
                <Field label="Précisions pour votre concierge" desktopFull>
                  <Textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Vos envies, contraintes ou attentions particulières…"
                  />
                </Field>
              </div>
              <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-2 lg:flex lg:justify-between">
                <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <PillAction type="submit" className="w-full lg:w-[220px]">
                  Continuer
                </PillAction>
              </div>
            </form>
          </section>
        )}
        {step === 3 && (
          <section className="pt-8 lg:mx-[clamp(20px,3.9vw,56px)] lg:grid lg:grid-cols-12 lg:gap-x-10 lg:pt-16">
            <p className="eyebrow text-primary lg:hidden">Récapitulatif</p>
            <Title italic="exact ?" className="mt-4 text-[38px] text-primary lg:hidden">
              Tout est{" "}
            </Title>
            <div className="mt-6 rounded-[28px] bg-primary-deep p-5 text-foreground lg:col-span-7 lg:row-span-3 lg:mt-0 lg:p-8">
              <p className="eyebrow text-foreground">{category}</p>
              <h2 className="v3-card-title mt-5 text-[29px] lg:text-[52px]">{title}</h2>
              <dl className="mt-5 divide-y divide-foreground/22 border-t border-foreground/22 text-[13px]">
                <Review
                  label="Date"
                  value={date ? new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR") : "À définir"}
                />
                <Review label="Heure" value={time || "À définir"} />
                <Review label={category === "Tables" ? "Couverts" : "Personnes"} value={guests || "À définir"} />
                <Review label="Précisions" value={description || "Aucune"} />
              </dl>
            </div>
            <p className="mt-5 text-[13px] leading-5 text-muted-foreground lg:col-span-5 lg:mt-0 lg:self-end lg:border-t lg:border-primary/25 lg:pt-6 lg:text-[18px] lg:leading-7">
              Votre demande sera transmise à votre conciergerie dès l’envoi.
            </p>
            {error && (
              <p className="mt-4 rounded-[18px] lg:col-span-5 bg-primary/10 p-4 text-xs leading-5 text-primary">
                {error}
              </p>
            )}
            <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-2 lg:col-span-5 lg:flex lg:items-start lg:justify-between">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(2)}>
                Modifier
              </Button>
              <PillAction onClick={() => void submit()} disabled={busy} className="w-full lg:w-[220px]">
                {busy ? "Envoi…" : "Envoyer"}
              </PillAction>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function WizardHeader({ step, complete = false }: { step: 1 | 2 | 3; complete?: boolean }) {
  return (
    <header className="sticky top-0 z-40 -mx-5 bg-background px-5 pb-3 pt-3 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:px-0 lg:pt-0">
      <div className="grid h-[52px] grid-cols-[44px_minmax(0,1fr)_44px] items-center rounded-full bg-primary-deep px-1 text-foreground">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="border border-foreground/22 text-foreground hover:bg-foreground/10"
        >
          <Link to="/demandes" aria-label="Fermer">
            <X />
          </Link>
        </Button>
        <Logo inverse className="mx-auto h-[20px] w-auto" />
        {!complete && <span className="text-center text-[10px] font-semibold tracking-[0.13em]">{step} / 3</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((part) => (
          <span key={part} className={cn("h-[3px] rounded-full", part <= step ? "bg-primary" : "bg-primary/15")} />
        ))}
      </div>
    </header>
  );
}

function Field({
  label,
  children,
  desktopFull = false,
}: {
  label: string;
  children: React.ReactNode;
  desktopFull?: boolean;
}) {
  return (
    <div className={desktopFull ? "lg:col-span-3" : undefined}>
      <Label className="eyebrow">{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 py-4">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function DesktopWizardHeader({ step, complete = false }: { step: 1 | 2 | 3; complete?: boolean }) {
  const heading = complete
    ? ["Demande ", "transmise."]
    : step === 1
      ? ["Que pouvons-nous ", "organiser ?"]
      : step === 2
        ? ["Votre ", "demande."]
        : ["Tout est ", "exact ?"];
  return (
    <section className="hidden lg:relative lg:flex lg:min-h-[440px] lg:flex-col lg:overflow-hidden lg:rounded-[28px] lg:bg-primary-deep lg:px-[clamp(20px,3.9vw,56px)] lg:py-6 lg:text-foreground">
      <Logo inverse className="lg:pointer-events-none lg:absolute lg:bottom-10 lg:left-1/3 lg:w-full lg:opacity-5" />
      <div className="lg:relative">
        <TopBar />
        <p className="lg:eyebrow lg:mt-16 lg:text-foreground/80">
          {complete
            ? "Confirmation"
            : `${step === 1 ? "Catégorie" : step === 2 ? "Détails" : "Récapitulatif"} · ${step} / 3`}
        </p>
        <Title italic={heading[1]} className="lg:mt-6 lg:text-[clamp(48px,6.1vw,88px)] lg:leading-[0.96]">
          {heading[0]}
        </Title>
        <div className="lg:mt-8 lg:flex lg:items-center lg:justify-between lg:border-t lg:border-foreground/22 lg:pt-6">
          <div className="lg:grid lg:w-[300px] lg:grid-cols-3 lg:gap-2">
            {[1, 2, 3].map((part) => (
              <span
                key={part}
                className={part <= step ? "lg:h-[3px] lg:bg-foreground" : "lg:h-[3px] lg:bg-foreground/25"}
              />
            ))}
          </div>
          <Button
            asChild
            variant="outline"
            className="lg:h-11 lg:border-foreground/22 lg:text-foreground lg:hover:bg-foreground/10"
          >
            <Link to="/demandes">Fermer</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
