---
description: Migrate an existing workspace to MCP Protocol 2025-11-25.
---

# MCP Migration Agent

I need you to refactor this existing workspace to conform to the Model Context Protocol (MCP) **Streamable HTTP** transport (Protocol Version `2025-11-25`).

**Execution Rules:**
1. **Analysis**: Scan the current codebase. Identify existing tool logic or API endpoints.
2. **Migration Strategy**: Strictly apply "Section 0.5 Migration Strategy" from `.github/copilot-instructions.md`. Move files and update imports to the new SDK.
3. **Logic Preservation**: Do not delete existing business logic; wrap it in the new `mcp.tool()` definitions as required by the instructions.
4. **Quality Gates**: Refactor any loose types to strict TypeScript (no `any`). Ensure 100% test coverage by adding missing tests.
5. **Integration Assurance**: For every tool migrated, create a dedicated integration test.
6. **Fix & Verify**: Auto-fix any breaking changes or linting errors caused by the move, and run the test suite to confirm 100% pass rate.

**Output**: Report "Migration Complete. Server is ready on Protocol 2025-11-25." and list the specific files that were moved or modified, along with confirmation of test coverage.

Begin.

