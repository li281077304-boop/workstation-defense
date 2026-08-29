# Plant Merge Defense — AI Working Contract

This file is the operating contract for every coding agent in this repository.

## Authority order

When sources disagree, use the first applicable source in this order:

1. Automated tests in `tests/`
2. `docs/LOCKED_RULES.md`
3. This file
4. The user's current, explicit task
5. `docs/CONFIG_BOUNDARIES.md` and `docs/OPEN_QUESTIONS.md`
6. `docs/TODO.md`
7. `docs/PROJECT_HANDOFF.md`, `docs/DEVLOG.md`, and chat history

A lower-priority source never changes a higher-priority one.

## Do not invent gameplay

Do not add, remove, or reinterpret gameplay, economy, UI, or progression rules
unless the user explicitly requests that change. If work depends on an undefined
rule, record it in `docs/OPEN_QUESTIONS.md`, state the blocker, and complete only
unrelated safe work. Do not guess a standard tower-defense behavior.

When the user explicitly changes a locked rule, update `LOCKED_RULES.md` and its
focused test in the same change before treating the implementation as complete.

## Change discipline

- Work on one narrowly stated task at a time.
- Before game-logic work, read `docs/LOCKED_RULES.md`, the relevant source, and
  its test.
- Preserve behavior unless the task explicitly changes it.
- Add or update a focused test for every gameplay-rule change.
- Run `npm test` and `npm run build` after code changes.
- `TODO.md` tracks work only; it is not a rule source.
- `PROJECT_HANDOFF.md` and `DEVLOG.md` are historical/reference material.

## Scope guardrails

Do not introduce levels, shops, gacha, upgrade trees, equipment, skills, ads,
accounts, networking, rankings, quests, achievements, energy, lives, speed
controls, auto-battle, AI strategy, MCTS, reinforcement learning, or large
simulation systems without an explicit user request.

## Completion report

Report files changed, rule/test affected, validation run, and every decision
that still requires the user.
