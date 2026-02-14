---
description: Create a brand new MCP server using Protocol 2025-11-25.
---

# MCP Server Creation Agent

I need you to bootstrap a new Model Context Protocol (MCP) server from scratch using the **Streamable HTTP** transport (Protocol Version `2025-11-25`).

**Execution Rules:**
1. **Source of Truth**: Read `.github/copilot-instructions.md` for the required project structure and SDK versions.
2. **Dependency Audit Sequence** (CRITICAL):
    a. Create the base `package.json` file ONLY, using the reference in Section 3.1.
    b. **BEFORE** `npm install`, you **MUST** run `npm view <pkg> version` for each dependency to resolve the absolute latest stable version that is compatible with the MCP SDK and free of vulnerabilities.
    c. Update the `package.json` on disk with these verified specific versions.
    d. Finally, run `npm install`.
3. **Reference Implementation**: Implement the boilerplate code exactly as defined in the **Reference Implementation** ("Section 4") of the instructions.
4. **Quality & Tests**: Enforce strict types (no `any`), use `kebab-case` for all filenames. Implement unit and integration tests using **Jest** with 100% coverage. Use **ESLint** for linting.
5. **Verification**: Run `npm run lint` and `npm test` to ensure the environment is clean, tests pass, and coverage requirements are met. Correct any failures autonomously.

**Output**: Report "Setup Complete. Server is ready on Protocol 2025-11-25." followed by a file tree of what you created and the test coverage report.

Begin.
