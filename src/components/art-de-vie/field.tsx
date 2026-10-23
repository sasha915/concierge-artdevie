import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * Libellé relié à son champ : le premier élément reçoit un identifiant (s'il n'en a pas)
 * et le libellé pointe dessus, pour les lecteurs d'écran et le clic sur le libellé.
 */
export function LabeledField({ label, children, className }: { label: string; children: ReactNode; className?: string | undefined }) {
  const generated = useId();
  const items = Children.toArray(children);
  const first = items[0];
  let id = generated;
  if (isValidElement(first)) {
    const props = first.props as { id?: string };
    id = props.id ?? generated;
    items[0] = cloneElement(first as ReactElement<{ id?: string }>, { id });
  }
  return (
    <div className={className}>
      <Label htmlFor={id} className="eyebrow">{label}</Label>
      <div className="mt-2">{items}</div>
    </div>
  );
}
