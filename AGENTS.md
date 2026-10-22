<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Desktop member presentation uses lg-only layouts or desktop-only variants of existing shared components; preserve all mobile classes and business logic to keep the validated mobile experience unchanged.
- Team presentation is scoped to AdminShell and admin routes; use team-theme tokens and existing member queries so member screens and access controls remain unchanged.
- Request history and reply templates are accessed only through authenticated team server functions; template writes require admin, and client-safe history/filter/insertion rules are isolated for tests without touching real requests.
- Request billing (lot 4.2): amounts and commissions follow src/lib/billing-rules.ts; invoice numbers come only from public.next_invoice_number(); request amounts are team-only and invoices are created by admins through server functions.
- Member notifications (lot 4.3) are in-app only: team server functions insert into member_notifications when profiles.notify_requests is true; members read their own rows and mark them read through mark_request_notifications_read.
- Request exchanges (lot 5.1): request_messages is read by members through RLS on their own requests only; every write goes through sendTeamMessage (team) or sendMemberMessage (member, author forced server-side). WhatsApp to the concierge is centralised in src/lib/notify-concierge.server.ts.
- Files, change requests and reviews (lots 5.2/5.3): members only SELECT through RLS (visible files, their own changes and reviews); every write goes through server functions in src/lib/messages.functions.ts (member) or admin.functions.ts (team); files are downloaded through 5-minute signed URLs from the private request-files bucket. Shared rules live in src/lib/request-actions-rules.ts.
- Proposals and recurring requests (lots 6.1/6.2): members only SELECT their own proposals, options and recurring rules; answering a proposal, creating a series and pausing it go through messages.functions.ts; sending/withdrawing proposals through admin.functions.ts. Occurrences are created 7 days ahead by public.generate_recurring_requests(), run daily at 06:00 UTC by the pg_cron job 'art-de-vie-demandes-recurrentes' (service-side only). Rules in src/lib/planning-rules.ts.
- Agenda, welcome questionnaire and statement (lots 6.3/6.4): getAgenda and getMemberStatement are team server functions; member answers live in member_preferences.*_choix / dates_membre (no member RLS access, read/write via getMyWelcome/saveMyWelcome); team notes in the same table stay internal. Statements are PDFs generated in the browser by src/lib/statement-pdf.ts (jsPDF). Rules in src/lib/agenda-rules.ts and src/lib/member-rules.ts.
- English version (lot 6.5): member-facing text goes through t()/tPair() from src/lib/i18n.ts; the French text is the key and src/lib/i18n-en.ts holds the English. Any new member text must be wrapped and added to the dictionary (src/lib/i18n.test.ts fails otherwise). Stored values (statuses, categories) stay French and are translated at display. /admin always renders in French. Member notifications are written in profiles.language at send time.
