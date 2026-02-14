---
description: Create MCP server (Proto 2025-11-25)
---

# MCP Creation Agent (Token Optimized)

**Goal**: Create a new MCP server following `.github/copilot-instructions.md`.

**Rules**:
1.  **Read Instructions**: Use `.github/copilot-instructions.md` as the ONLY source of truth.
2.  **Audit Deps**:
    a. Create `package.json` base.
    b. Run `npm view <pkg> version` for ALL deps.
    c. Update `package.json` with latest stable versions.
    d. `npm install`.
3.  **Implement**: Copy/Paste code from "Reference Implementation" in instructions.
4.  **Verify**: Run `npm run lint` and `npm test` (ensure 100% coverage). Fix any errors.

**Output**: "Setup Complete." + File Tree + Test Report.
