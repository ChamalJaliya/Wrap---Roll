# Supabase Postgres Best Practices - Developer Instructions

This README is the contributor guide for the skill at:
`.agents/skills/supabase-postgres-best-practices/`.

Use this guide when you want to maintain or extend the Postgres optimization knowledge used by agents in this repository.

## What This Skill Contains

- `SKILL.md`: canonical skill manifest and usage contract.
- `AGENTS.md`: compiled/curated rule index used by agents.
- `CLAUDE.md`: companion guidance document.
- `references/`: source rule files grouped by topic and impact.

## Local Bootstrap (for Contributors)

From repository root:

```bash
npm install
```

No separate package bootstrap is required for this skill folder.

## Skill Layout

```text
.agents/skills/supabase-postgres-best-practices/
├── SKILL.md
├── AGENTS.md
├── CLAUDE.md
├── README.md
└── references/
    ├── _template.md
    ├── _sections.md
    ├── _contributing.md
    └── <category>-<topic>.md
```

## Category Prefixes (Use One)

- `query-` Query Performance (CRITICAL)
- `conn-` Connection Management (CRITICAL)
- `security-` Security and RLS (CRITICAL)
- `schema-` Schema Design (HIGH)
- `lock-` Concurrency and Locking (MEDIUM-HIGH)
- `data-` Data Access Patterns (MEDIUM)
- `monitor-` Monitoring and Diagnostics (LOW-MEDIUM)
- `advanced-` Advanced Features (LOW)

## Add or Update a Reference

1. Pick the correct category prefix and a clear file name.
2. Copy template:

   ```bash
   cp ".agents/skills/supabase-postgres-best-practices/references/_template.md" \
      ".agents/skills/supabase-postgres-best-practices/references/query-your-topic.md"
   ```

3. Fill frontmatter and examples.
4. Keep examples practical and executable.
5. Update `AGENTS.md` index/navigation if needed.

## Reference Authoring Standard

Every reference should include:

- short problem statement and why it matters
- incorrect SQL example
- corrected SQL example
- impact estimate (for example: `10-100x faster`)
- Supabase/Postgres caveats where relevant

Keep examples realistic (tables like `orders`, `customers`, `menu_items`) instead of placeholder names.

## Recommended Validation Checklist

Before opening a PR, verify:

1. File naming follows `<prefix>-<topic>.md`.
2. Frontmatter is complete and valid.
3. SQL code blocks are syntactically coherent.
4. Claims are measurable or bounded (no vague "faster").
5. Cross-references in `AGENTS.md` point to existing files.

Optional quick checks:

```bash
# Ensure no broken relative links inside this skill
rg "\]\(.*\)" ".agents/skills/supabase-postgres-best-practices"

# Ensure all references have frontmatter title/impact
rg "^title:|^impact:" ".agents/skills/supabase-postgres-best-practices/references"
```

## Writing Quality Guidelines

- Prefer "change X to Y" over abstract advice.
- Show the anti-pattern first, then fix.
- Use concrete performance reasoning (`EXPLAIN`, index selectivity, row counts).
- Mention lock or transaction side effects for write-path optimizations.
- Include RLS/perms considerations when examples touch secure tables.

## Impact Levels

| Level | Typical Gain | Examples |
|---|---|---|
| CRITICAL | 10x-100x | Missing indexes, connection exhaustion, bad RLS filters |
| HIGH | 5x-20x | Wrong index strategy, poor schema cardinality |
| MEDIUM-HIGH | 2x-5x | N+1 access paths, lock contention patterns |
| MEDIUM | 1.5x-3x | Data access and pagination improvements |
| LOW-MEDIUM | 1.2x-2x | Monitoring/statistics hygiene |
| LOW | Incremental | Advanced/edge tuning techniques |

## Common Pitfalls

- Over-indexing write-heavy tables.
- Using broad `SELECT *` in critical endpoints.
- Ignoring RLS query plan impact.
- Long transactions around user-facing workflows.
- Mixing conceptual guidance with no runnable SQL example.

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [Supabase Database Docs](https://supabase.com/docs/guides/database/overview)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Performance Wiki](https://wiki.postgresql.org/wiki/Performance_Optimization)
