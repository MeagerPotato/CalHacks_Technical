# Requests from Astra

Astra's Phase 2 write set is creative only (see [astra-handoff.md](astra-handoff.md)). Some creative changes need something outside that write set, such as:

- a new prop or art slot;
- a DOM, id, `data-testid`, or `data-*` change;
- a new copy key or a change to a `LOCKED` string;
- a layout change inside `app/**`;
- any logic or backend change.

Record those here instead of editing the file. Claude picks them up in the next session and replies under the request.

Keep each request short and concrete. Ship a fallback within the write set whenever you can, so nothing waits on the request.

## Template

```md
### <short title>

- **Where:** the file or component, and the page or `/dev/gallery` section where it shows.
- **What I need:** the prop, markup, copy key, or behavior.
- **Why:** the creative goal it serves.
- **Frozen contract affected:** none, or the id, `data-testid`, `data-*` attribute, or `LOCKED` string.
- **Blocking:** yes or no. If no, describe the fallback you shipped.
```

## Open requests

None yet.
