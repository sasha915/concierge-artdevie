import { t } from "@/lib/i18n";

/** Pages légales du site artdevie.co (mentions légales, confidentialité). */
export function LegalLinks({ className = "" }: { className?: string }) {
  const link = "underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <p className={`text-[12px] leading-5 text-muted-foreground ${className}`}>
      <a href="https://artdevie.co/mentions-legales" target="_blank" rel="noopener" className={link}>{t("Mentions légales")}</a>
      <span aria-hidden="true"> · </span>
      <a href="https://artdevie.co/confidentialite" target="_blank" rel="noopener" className={link}>{t("Confidentialité")}</a>
    </p>
  );
}
