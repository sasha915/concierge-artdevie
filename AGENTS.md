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
