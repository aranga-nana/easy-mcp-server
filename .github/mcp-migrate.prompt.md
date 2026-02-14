---
description: Migrate an existing workspace to MCP Protocol 2025-11-25.
---

# MCP Migration Agent

I need you to refactor this existing workspace to conform to the Model Context Protocol (MCP) **Streamable HTTP** transport (Protocol Version `2025-11-25`).

**Execution Rules:**
1. **Analysis**: Scan the current codebase. Identify existing tool logic or API endpoints.
2. **Dependency Update (CRITICAL)**:
    a. Create/Update `package.json` to match the **Reference Package Configuration** in "Section 3.1" (minimum requirements).
    b. **BEFORE** `npm install`, you **MUST** run `npm view <pkg> version` for each dependency to resolve the absolute latest stable version compatible with the MCP SDK. Ensure no vulnerabilities exist.
    c. Only then proceed with `npm install`.
3. **Migration Strategy**: Strictly apply "Section 0.5 Migration Strategy" from `.github/copilot-instructions.md`. Move files and update imports to the new SDK.
4. **Logic Preservation**: Do not delete existing business logic; wrap it in the new `registerTool` definitions as required by the instructions.
5. **Quality Gates**: Refactor any loose types to strict TypeScript (no `any`), rename files to `kebab-case` if necessary. Ensure 100% test coverage using **Jest** by adding missing tests. Use **ESLint** for linting.
6. **Integration Assurance**: For every tool migrated, create a dedicated integration test.
7. **Fix & Verify**: Auto-fix any breaking changes or linting errors caused by the move. Run `npm run lint` and `npm test` to confirm clean code and 100% pass rate. Correct any failures autonomously.

**Output**: Report "Migration Complete. Server is ready on Protocol 2025-11-25." and list the specific files that were moved or modified, along with confirmation of test coverage.

Begin.

