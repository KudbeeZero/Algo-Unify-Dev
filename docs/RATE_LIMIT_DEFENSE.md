# Rate Limit Defense & Efficient Agent Workflow

## Core Philosophy
When an agent is already "in" a file, system, or context, it should look for quick related improvements instead of making multiple separate passes. This is the "mechanic philosophy": if you're already changing the serpentine belt, also do the water pump while you're there. The goal is to maximize value per context load and reduce token burn.

## Rate Limit Prevention Rules

To avoid hitting rate limits (especially with Kilo/Claude agents):

- Break long or complex tasks into smaller, focused sessions.
- Complete long operations (installs, builds, large refactors) first, verify success, then stop. Do not chain into the next phase in the same session.
- Save progress and create checkpoints frequently. Resume in a new session if needed.
- Check for incomplete states early (e.g. missing node_modules after rate-limited installs).
- Prefer non-peak hours for heavier agent runs when possible.
- Use explicit rate-limit awareness instructions in prompts.

## Prompt Instruction Template
Add this to prompts when appropriate:

> If any long operation (install, build, large edits) is involved, complete it first, verify success, then stop. Do not continue into the next phase in the same session if it risks hitting rate limits. While editing a file, also apply any small obvious related improvements instead of planning separate passes later.

## Post-Session Checklist
After every agent session:
- [ ] Did we hit any rate limits?
- [ ] Was work cleanly checkpointed?
- [ ] What is the focused next session?
- [ ] Were related improvements done while already in context?

## Related Files
- docs/HANDOFF.md
- AGENTS.md / CLAUDE.md
- memory-bank/context.md or .kilocode/rules/

Any agent working on complex tasks should reference this file.