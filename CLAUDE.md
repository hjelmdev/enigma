# ENIGMA — Claude Code coordination

Read `AGENTS.md` for shared project rules (also used by Codex/Luna). Read only the relevant design docs for the current task; do not indiscriminately load the whole repo.

## Operating model
- Lead (usually Opus): own creative direction, room composition, puzzle reasoning, art systems, major architecture, integration decisions and final gameplay/visual sign-off.
- Delegate bounded exploration, repetitive implementation and mechanical tests to project Haiku subagents.
- Use Sonnet for medium-complexity integration, debugging and scoped refactors when Haiku is insufficient.
- Choose the cheapest model capable of meeting quality requirements. A failed cheap attempt plus repeated rework is not a saving.
- The model labels in these rules are preferences, not evidence that delegation happened; inspect actual agent invocations.
- Do not spawn agents for trivial one-step work or create multiple overlapping agents without reason. Avoid large duplicate reads and unnecessary parallelism.
- Never delegate subjective room art direction, puzzle originality or cinematic quality approval to Haiku.

## Delegation-first planning for substantial tasks
For a substantial feature (multiple scenes/files, new systems, or expected multi-hour work), **make a short delegation plan before implementing**. Categorize work as:
1. **Opus-owned:** original game/puzzle design, creative visual direction, distinctive renderer/art generation, crucial architecture, and final visual/playability sign-off.
2. **Sonnet-owned by default:** bounded multi-file integration, approved UI systems, save/state wiring, and nontrivial debugging after interfaces are defined.
3. **Haiku-owned by default:** focused unit tests, types, fixtures, manifests, mechanical wiring, documentation synchronization, and narrow code exploration.

Do not use Opus to write routine tests, repetitive scaffolding, or simple state/UI glue **unless** there is a specific reason (e.g. tiny edit, coupling, agent overhead, failed delegation). Prefer spawning a named project agent over a generic agent so its model is explicit; check the actual model used. Before handing work off, define the smallest stable interface and assign non-overlapping file ownership. The lead must review delegated changes and own final integration.

**Do not delegate for the sake of hitting a percentage.** Evaluate opportunity cost, latency, duplicated context, rework and quality. Avoid long-running agents without bounded deliverables. A justified decision to keep an integrated task with Opus is acceptable.

At completion, give a concise **delegation report**: named agents/models used, task and edited files, verification, retries/rework, work retained by lead and why. Distinguish actual agent execution from planned delegation; report unknown usage as unknown. If usage telemetry exists, link to the relevant session rather than inventing costs.

## Task briefs and context budgets
Before delegating, supply: goal, exact files or narrowly scoped discovery target, relevant contract, allowed edits, forbidden edits, acceptance criteria, verification commands and concise response format.
Subagents have separate context. They do NOT inherit the ongoing conversation. Provide only necessary background; favor file paths and symbols over copying entire documents.
For exploration: ask for paths, symbols and a short conclusion, not raw file dumps.
For editing: assign ownership of non-overlapping files. Agent must stop and escalate when requirements are ambiguous or work exceeds the allowed scope.
Use `docs/agents/WORKFLOW.md` for handoff format and task selection.

## Quality gates
- Preserve the existing adventure and independent experiments unless explicitly tasked to change them.
- Test puzzles for logical solvability, not only matching a hardcoded answer.
- Visual work requires rendered inspection when tools permit; never claim screenshots or animation checks not performed.
- Keep asset generators reproducible; preserve art layers/occlusion and mobile touch support.
- Integrate, review and run relevant tests/build before completing. Report actual commands/results and outstanding limitations.

## Git collaboration
- Default to a focused branch or isolated worktree for large changes; do not overwrite concurrent agents' work.
- Check status before editing; don't reset/discard uncommitted user changes.
- No independent push from a subagent unless lead explicitly authorizes it.
- Commit small coherent changes only when requested by lead/user.

## Model fallback
When Claude usage is constrained, Codex/Luna can continue directly from GitHub using `AGENTS.md`, `docs/agents/WORKFLOW.md`, and a task-specific brief. Never require Claude-only infrastructure for runtime, builds or tests.
