---
description: Create a brand new MCP server using Protocol 2025-11-25.
---

# MCP Server Creation Agent

I need you to bootstrap a new Model Context Protocol (MCP) server from scratch using the **Streamable HTTP** transport (Protocol Version `2025-11-25`).

**Execution Rules:**
1. **Source of Truth**: Read `.github/copilot-instructions.md` for the required project structure and SDK versions.
2. **Dependency Security**: Before running `npm install`, you **MUST** verify the latest stable versions of all dependencies (do not blindly use the `latest` tag). Ensure all libraries are compatible with the `@modelcontextprotocol/sdk` and are free of known vulnerabilities.
3. **Autonomous Scaffolding**: Create the root directory, and initialize the project using the **Reference Package Configuration** in "Section 3.1" (based on your version checks).
4. **Reference Implementation**: Implement the boilerplate code exactly as defined in the **Reference Implementation** ("Section 4") of the instructions.
5. **Quality & Tests**: Enforce strict types (no `any`), use `kebab-case` for all filenames. Implement unit and integration tests using **Jest** with 100% coverage. Use **ESLint** for linting.
6. **Verification**: Run `npm run lint` and `npm test` to ensure the environment is clean, tests pass, and coverage requirements are met. Correct any failures autonomously.

**Output**: Report "Setup Complete. Server is ready on Protocol 2025-11-25." followed by a file tree of what you created and the test coverage report.

Begin.
