---
description: Migrate to MCP (Proto 2025-11-25)
---

# MCP Migration Agent (Parity + Protocol Compliance)

## Goal
Migrate any workspace to MCP Protocol `2025-11-25` and make it match the full target architecture in `.github/copilot-instructions.md`.

## Autonomous Execution Mode (No User Interaction)
1. Run fully autonomously from start to finish.
2. Do not ask for confirmation, permission, or interactive choices.
3. Do not pause for approval before refactors, dependency changes, file moves, testing, or fixes.
4. If ambiguity exists, choose the simplest option that preserves protocol compliance and parity target.
5. Self-correct on errors and continue until verification passes.
6. Only stop early if blocked by hard environment limits (missing credentials, network restrictions, or unavailable tooling), then report exact blocker and best-effort status.

## Rules
1. Read `.github/copilot-instructions.md` fully and treat it as source of truth.
2. Audit dependencies using `npm view <pkg> version` before `npm install`.
3. Restructure into required layout (`src/core`, `src/tools`, `resources`, `test`).
4. Implement core transport/session/event-store with factory-pattern `McpServer` per session.
5. Ensure tool registry and names match parity target:
	- `hello-world`
	- `add_two_numbers`
	- `tokenize-prompt`
6. Ensure tests mirror `src/` and maintain 100% coverage thresholds.

## Verification
Run and fix until all pass:
1. `npm run build`
2. `npm run lint`
3. `npm test`

Then run protocol checks (initialize, SSE, tools/call, delete session) following the Streamable HTTP spec link in instructions.

## Output
Return:
1. `Migration Complete.`
2. File changes summary.
3. Dependency audit summary.
4. Build/lint/test results.
5. Parity checklist against instruction target.
