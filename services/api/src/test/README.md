# API Test Notes

## Stress Suite

- `stress.spec.ts` is intentionally opt-in to keep routine CI and local runs deterministic.
- To run it, set `RUN_STRESS_TESTS=1`.

Example:

```bash
RUN_STRESS_TESTS=1 npx nx test api -- --runInBand --testPathPattern=stress.spec.ts
```

## Default API Test Run

- Regular API test runs skip the stress suite automatically.

Example:

```bash
npx nx test api -- --runInBand
```
