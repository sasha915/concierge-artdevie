import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Clé de session posée par « Plus tard » : le questionnaire ne se représente qu'à la connexion suivante. */
export const WELCOME_LATER_KEY = "adv-welcome-later";

/** Choix multiples en pilules ; chaque option est un bouton à bascule accessible au clavier. */
export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-primary font-medium text-primary-foreground" : "border border-primary/40 text-primary hover:bg-primary/10",
            )}
          >
            {on && <Check className="size-4" aria-hidden />}
            {t(option)}
          </button>
        );
      })}
    </div>
  );
}
