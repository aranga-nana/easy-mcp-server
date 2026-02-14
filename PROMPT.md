# Copilot / Agent Migration Prompt

**Copy and paste the following prompt into your AI assistant to execute the project creation or migration autonomously.**

---

I need you to implement (or migrate) this workspace to be a robust Model Context Protocol (MCP) server using the **Streamable HTTP** transport (Protocol Version `2025-11-25`).

Please read and strictly follow the comprehensive guide located in `.github/copilot-instructions.md`.

**Your Goal**: The project must fully match the "Reference Implementation" and "Project Structure" defined in that file by the time you are finished.

**Execution Rules**:
1.  **Read the Instructions**: Start by reading `.github/copilot-instructions.md` effectively.
2.  **Autonomous Execution**: As defined in Section 0.6 of the instructions, do not ask me for permission. Create files, move directories, install dependencies, and fix errors automatically.
3.  **Migration (If applicable)**: Check if this is an existing project. If so, apply the "Migration Strategy" (Section 0.5) to refactor it. Preserve existing tool logic but move it to the new folder structure.
4.  **Verification**: After implementing the code, run the build/tests to ensure it works. If it fails, fix it.

**Output**: When you are finished, report only: "Migration/Setup Complete. Server is ready on Protocol 2025-11-25." and a brief summary of changes.

Begin.
