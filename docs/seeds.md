# Database seeds

Default for local demo:

```bash
pnpm seed:demo
```

Creates JFK → SFO inventory for 14 days with seats and fares.

## All seed scripts

| Command | Description |
|---------|-------------|
| `pnpm seed:demo` | Recommended demo dataset (JFK→SFO, 14 days) |
| `pnpm seed:full` | Larger dataset (30 days, more routes) |
| `pnpm seed:flights` | Flight templates only |
| `pnpm seed:instances` | Flight instances (after `seed:flights`) |
| `pnpm seed:refresh-layouts` | Refresh aircraft layouts |
| `pnpm seed:aircraft-layouts` | Alias for `seed:refresh-layouts` |
| `pnpm seed:seat-templates` | Seat templates |
| `pnpm seed:cleanup-facilities` | Remove overlapping facility markers in layouts |
| `pnpm analytics:rebuild` | Rebuild CQRS analytics read model |
| `pnpm kafka:create-topics` | Create Kafka topics in Redpanda |
| `pnpm verify:kafka` | Verify events in Redpanda (bash script) |

Scripts live under `scripts/seeds/`.
