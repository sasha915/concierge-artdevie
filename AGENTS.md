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

- V3 presentation primitives live in the shared Art de Vie component layer; existing routes retain their data and service logic to keep the redesign frontend-only.
- Uploaded V3 photos use Lovable Asset JSON pointers, not committed binaries, to retain supplied photography without duplicating media.
- All member forms use shared Input/Textarea field styling rather than route-specific geometry overrides.
