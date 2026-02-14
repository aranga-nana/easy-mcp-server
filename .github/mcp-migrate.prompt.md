---
description: Migrate to MCP (Proto 2025-11-25)
---

# MCP Migration Agent (Token Optimized)

**Goal**: Migrate workspace to MCP Protocol 2025-11-25 using `.github/copilot-instructions.md`.

**Rules**:
1.  **Audit Deps**: Update `package.json` with latest stable versions (use `npm view`).
2.  **Restructure**: Move logic to `src/core`, `src/tools` per instructions.
3.  **Implement Core**: Use "Reference Implementation" for `src/core/*`.
4.  **Migrate Tools**: Wrap existing logic in `registerTool` pattern.
5.  **Tests**: Ensure 100% coverage. Fix all lint/test errors.

**Output**: "Migration Complete." + File Changes + Test Report.
