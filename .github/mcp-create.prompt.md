---
description: Create MCP server (Proto 2025-11-25)
---

# MCP Creation Agent (Full Scaffold, No Existing Source Files)

## Goal
Create the complete project from an empty workspace (no `src/`, `test/`, or `resources/` code present) using `.github/copilot-instructions.md` as source of truth.

## Autonomous Execution Mode (No User Interaction)
1. Run fully autonomously from start to finish.
2. Do not ask for confirmation, permission, or interactive choices.
3. Do not pause for approval before creating, editing, installing, testing, or fixing.
4. If ambiguity exists, choose the simplest option that preserves spec compliance and parity target.
5. Self-correct on errors and continue until all required verification steps pass.
6. Only stop early if blocked by hard environment limits (missing credentials, network restrictions, or unavailable tooling), then report exact blocker and best-effort status.

## Hard Requirements
1. Read `.github/copilot-instructions.md` fully before writing files.
2. Build the exact project structure and behavior expected by current repository parity:
   - Core transport/session/event-store/meta/index files.
   - Tool registry with `hello-world`, `add_two_numbers`, and `tokenize-prompt` implementations.
     - Tools must be registered via `server.registerTool()` with `zod` schemas.
     - Tool handlers must return a valid `CallToolResult` including `content` (and may include `structuredContent`).
    - Also register `add-two-numbers` for Copilot UX; prefer a single `prompt: string` input so the full user prompt is passed to the server for number extraction.
   - Resource file: `resources/hello-world/welcome.md`.
   - Unit + integration tests under `test/` mirroring `src/`.
3. Use strict TypeScript and kebab-case file names.
4. Use `@modelcontextprotocol/sdk` v1.26.0+ with factory pattern (`McpServer` per session).

5. Implement HTTP logging via `src/core/logger.ts` and wire it into the transport:
   - Request headers: yellow
   - Mask sensitive headers by replacing values with `***`
   - Request body: green
   - Response success (<400): green
   - Response error (>=400): red

6. On startup (console), display:
   - Server name (figlet)
   - Server version
   - MCP SDK version
   - MCP protocol version
   - All registered tool names in orange as bullet points (one per line, prefixed with `- `)

## Dependency Audit (Mandatory)
1. Create base `package.json`.
2. For every dependency and devDependency, run `npm view <package-name> version`.
3. Pin/update `package.json` to latest stable versions found.
4. Run `npm install`.

## Implementation Workflow
1. Create all required config files (`tsconfig.json`, `eslint.config.mjs`, `jest.config.js`).
2. Create all source files in `src/` and `resources/` according to instructions.
3. Create complete tests in `test/` (unit + integration), matching source structure.
4. Create/update `README.md` with protocol, setup, endpoints, and test commands.

## Verification Workflow (Mandatory)
Run and fix until all pass:
1. `npm run build`
2. `npm run lint`
3. `npm test`

Then perform protocol smoke checks against Streamable HTTP spec behavior:
1. Initialize (`POST /mcp`)
2. SSE connect (`GET /mcp` with `Accept: text/event-stream`)
3. Tool call (`tools/call`)
4. Session termination (`DELETE /mcp`)

## Parity Check
Compare generated project against expected implementation described in `.github/copilot-instructions.md` and ensure:
- Same architecture and file placement.
- Same tool names and registration wiring.
- Same transport/session lifecycle behavior.
- 100% Jest coverage threshold passing.

## Output Format
Return:
1. `Setup Complete.`
2. Generated file tree.
3. Dependency audit table (`package`, `latest`, `selected`).
4. Build/lint/test results summary.
5. Parity checklist status (`pass/fail` per item).
