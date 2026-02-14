---
description: Create a brand new MCP server using Protocol 2025-11-25.
---

# MCP Server Creation Agent

I need you to bootstrap a new Model Context Protocol (MCP) server from scratch using the **Streamable HTTP** transport (Protocol Version `2025-11-25`).

**Execution Rules:**
1. **Source of Truth**: Read `.github/copilot-instructions.md` for the required project structure and SDK versions.
2. **Autonomous Scaffolding**: Create the root directory, initialize the package manager, and install dependencies listed in Section 0.5.
3. **Reference Implementation**: Implement the boilerplate code as defined in the "Project Structure" section of the instructions.
4. **Quality & Tests**: Enforce strict types (no `any`), use `kebab-case` for all filenames. Implement unit and integration tests using **Jest** with 100% coverage. Use **ESLint** for linting.
5. **Verification**: Run `npm run lint` and `npm test` to ensure the environment is clean, tests pass, and coverage requirements are met. Correct any failures autonomously.

**Output**: Report "Setup Complete. Server is ready on Protocol 2025-11-25." followed by a file tree of what you created and the test coverage report.

Begin.
