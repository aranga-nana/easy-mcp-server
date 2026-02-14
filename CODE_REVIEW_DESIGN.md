# Code Review Tool Design (MCP Server)

## Implementation Status
**Current State**: Using MCP Sampling (`server.createMessage`)  
**Target State**: Migrate to Copilot SDK agent runtime  
**Status**: Design complete, implementation in progress

## 1. Overview
The `code_review` tool uses the **Copilot SDK (technical preview)** from within the MCP server to run a review as an **autonomous agent workflow**. Instead of relying on MCP Sampling (`server.createMessage`), the tool gathers deterministic local context (git changes + standards), starts a Copilot SDK conversation/session, and requests a structured review from the Copilot runtime.

This separates responsibilities clearly:
- **MCP server**: tool interface, local context collection, guardrails, deterministic limits.
- **Copilot SDK agent runtime**: model orchestration, multi-turn reasoning, optional tool execution loop.

### References
- **Copilot SDK**: [@github/copilot-sdk v0.1.23](https://www.npmjs.com/package/@github/copilot-sdk) (Published February 2026)
- **SDK Repository**: [github/copilot-sdk](https://github.com/github/copilot-sdk)
- **Node.js child_process**: [Official Documentation](https://nodejs.org/api/child_process.html)

## 2. Dependencies

### Required Packages
```json
{
  "dependencies": {
    "@github/copilot-sdk": "^0.1.23"
  }
}
```

### Installation & Setup
```bash
# Install Copilot SDK
npm install @github/copilot-sdk@^0.1.23

# Verify Copilot CLI is installed (requirement for SDK)
copilot --version

# If not installed, follow: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli
```

### Authentication
The SDK supports multiple authentication methods (see [Auth Documentation](https://github.com/github/copilot-sdk/blob/main/docs/auth/index.md)):
- **GitHub signed-in user**: Uses stored OAuth credentials from `copilot` CLI login
- **Environment variables**: `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`
- **BYOK (Bring Your Own Key)**: Use your own API keys from Anthropic/OpenAI (no GitHub auth required)

For this tool, we recommend using the GitHub signed-in user method (default) or environment variables.

### System Requirements
- **Node.js**: >= 20.0.0
- **Copilot CLI**: Must be installed and accessible in PATH
- **GitHub Copilot Subscription**: Required (unless using BYOK)

## 3. Detailed Data Flow

1.  **Invocation**: User invokes `code_review` from IDE (manually or via chat).
2.  **Client-Side Preparation (Copilot IDE Plugin)**:
    *   The IDE plugin identifies modified/open files that need review.
    *   The IDE plugin reads the file content from the editor buffers.
    *   The IDE plugin sends file names + content to the MCP server via tool call.
3.  **Context Gathering (Server-Side)**:
    *   The Server receives file names and content from the client.
    *   The Server reads `resources/code-review/standards.md` (Validation Standards).
    *   The Server validates file count and size limits.
4.  **Agent Session Bootstrap (Copilot SDK)**:
    *   The Server initializes a Copilot SDK client/session (Node.js package: `@github/copilot-sdk`).
    *   The Server selects a **Claude** model for review generation (configurable default).
    *   The Server creates an agent task with strict system instructions + gathered context.
5.  **Agent Review Execution**:
    *   The agent performs the review (single-turn or multi-turn internally).
    *   The server enforces output expectations (Markdown/text contract, size limits, deterministic fallback).
6.  **Result Delivery**:
    *   The Copilot SDK returns the generated markdown review.
    *   The Server sends this back as the tool result to the IDE.

## 4. Sequence Diagram

```mermaid
sequenceDiagram
    participant IDE as Copilot IDE Plugin
    participant Server as MCP Server
    participant FS as FileSystem
    participant SDK as Copilot SDK Runtime
    participant Model as Copilot Model

    Note over IDE: User asks for review
    Note over IDE: IDE detects modified files
    IDE->>IDE: Read file content from editor buffers
    IDE->>Server: call_tool("code_review", {files: [{name, content}]})
    activate Server
    
    rect rgb(240, 255, 240)
        Note right of Server: Step 1: Validation & Context Gathering
        Server->>Server: Validate file count & sizes
        Server->>FS: readFile("resources/code-review/standards.md")
        FS-->>Server: "Review Standards Content..."
    end
    
    rect rgb(255, 248, 240)
        Note right of Server: Step 2: Agent Review via Copilot SDK
        Server->>SDK: create client/session + send review task
        activate SDK
        SDK->>Model: run agent review with files + standards
        activate Model
        Model-->>SDK: review result (Markdown)
        deactivate Model
        SDK-->>Server: normalized response
        deactivate SDK
    end
    
    Server-->>IDE: Tool Result (Review Markdown)
    deactivate Server
    Note over IDE: Display review in IDE
```

## 5. File Structure (Implemented)

Current project structure for the tool is:

```text
resources/
    code-review/
        standards.md
src/
    tools/
        code-review/
            index.ts
        index.ts
test/
    tools/
        code-review/
            index.test.ts
```

Registration already exists in `src/tools/index.ts` and includes `code_review` in `REGISTERED_TOOL_NAMES`.

## 6. Configuration

### Environment Variables
```bash
# Authentication (choose one)
export COPILOT_GITHUB_TOKEN="ghp_xxx..."  # Preferred
# or
export GH_TOKEN="ghp_xxx..."
# or
export GITHUB_TOKEN="ghp_xxx..."

# Model Selection (optional, defaults to claude-sonnet-4.5)
export CODE_REVIEW_MODEL="claude-sonnet-4.5"

# Resource Limits (optional)
export CODE_REVIEW_MAX_FILES=50         # Max files per review
export CODE_REVIEW_MAX_FILE_SIZE=50000  # Max bytes per file
export CODE_REVIEW_TIMEOUT=60000        # Timeout in ms (60s)
```

### Available Models
Based on [Copilot SDK documentation](https://github.com/github/copilot-sdk), supported models include:
- **`gpt-5`**: OpenAI GPT-5 (default for general use)
- **`claude-sonnet-4.5`**: Anthropic Claude Sonnet 4.5 ([claude-sonnet-4-5-20250929](https://platform.claude.com/docs/en/docs/models-overview)) - Recommended for code review
- **`claude-opus-4.6`**: Anthropic Claude Opus 4.6 - Most intelligent for complex tasks
- **`claude-haiku-4.5`**: Anthropic Claude Haiku 4.5 - Fastest with near-frontier intelligence

For code review, we default to `claude-sonnet-4.5` for its optimal balance of speed and code understanding.

## 7. Component Design

### 7.1 Tool Definition (`src/tools/code-review/index.ts`)

**Schema:**
```typescript
const inputSchema = z.object({
  files: z.array(z.object({
    name: z.string().describe('File path (relative to workspace root)'),
    content: z.string().describe('Full file content to review')
  }))
  .min(1)
  .max(50)
  .describe('Array of files to review. Client must provide file names and content. Maximum 50 files per review.')
});
```

**Agent Logic via Copilot SDK (Implementation-Ready Code):**
```typescript
// Based on @github/copilot-sdk v0.1.23 API
// Reference: https://www.npmjs.com/package/@github/copilot-sdk
import { CopilotClient } from '@github/copilot-sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Validate input
if (!files || files.length === 0) {
    return {
        isError: true,
        content: [{ type: 'text', text: 'No files provided. Client must send file names and content.' }]
    };
}

const MAX_FILES = parseInt(process.env.CODE_REVIEW_MAX_FILES ?? '50', 10);
const MAX_FILE_SIZE = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);

if (files.length > MAX_FILES) {
    return {
        isError: true,
        content: [{ type: 'text', text: `Too many files (${files.length}). Maximum: ${MAX_FILES}` }]
    };
}

// Validate file sizes
for (const file of files) {
    if (file.content.length > MAX_FILE_SIZE) {
        return {
            isError: true,
            content: [{ type: 'text', text: `File too large: ${file.name} (${file.content.length} bytes, max: ${MAX_FILE_SIZE})` }]
        };
    }
}

// Load standards
const standardsContent = await getReviewStandards();

const taskInstructions = `
You are a senior code reviewer.
Apply these standards exactly:
${standardsContent}

Return concise, actionable findings grouped by severity.
Include suggested patch snippets when useful.
`;

const reviewPayload = `Review these files:\n\n` +
    files.map((f) => `## ${f.name}\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n');

const reviewModel = process.env.CODE_REVIEW_MODEL ?? 'claude-sonnet-4.5';
const reviewTimeout = parseInt(process.env.CODE_REVIEW_TIMEOUT ?? '60000', 10);

const client = new CopilotClient();

try {
    await client.start();

    // Verify authentication explicitly
    const authStatus = await client.getAuthStatus();
    if (!authStatus.isAuthenticated) {
        return {
            isError: true,
            content: [{ 
                type: 'text', 
                text: \`Authentication failed. Please run \\\`copilot auth login\\\` or set the COPILOT_GITHUB_TOKEN environment variable.\\nStatus: \${authStatus.statusMessage || 'Not logged in'}\` 
            }]
        };
    }
    
    const session = await client.createSession({
        model: reviewModel,
        systemMessage: {
            content: taskInstructions
        }
    });
    
    try {
        const reviewResponse = await session.sendAndWait(
            { prompt: reviewPayload },
            reviewTimeout
        );
        
        const reviewText = reviewResponse?.data?.content ?? 'Review completed (no text output).';
        
        return {
            content: [{ type: 'text', text: reviewText }]
        };
    } finally {
        await session.destroy();
    }
} finally {
    await client.stop();
}
```

### 7.2 Resources (`resources/code-review/standards.md`)
This file will contain the "Instructions" mentioned in the requirements. It serves as the customizable configuration for the review bot.

**Example Content:**
```markdown
# Validation Standards
- Ensure all public functions have JSDoc comments.
- No `console.log` in production code; use the Logger.
- Use `zod` for all I/O validation.
- Ensure rigorous type safety (no `any`).
```

## 8. Security & Performance Considerations

### 8.1 Payload Size Limits
**Issue**: Large file sets or files can exceed context windows.  
**Resource Limits**:
- `CODE_REVIEW_MAX_FILES=50` (max files per review)
- `CODE_REVIEW_MAX_FILE_SIZE=50000` (50 KB per file)
- **Total context limit**: ~2.5 MB (50 files × 50 KB)

**Implementation**:
```typescript
const MAX_FILES = parseInt(process.env.CODE_REVIEW_MAX_FILES ?? '50', 10);
const MAX_FILE_SIZE = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);

if (targetFiles.length > MAX_FILES) {
    return {
        isError: true,
        content: [{ 
            type: 'text', 
            text: `Too many files (${targetFiles.length}). Maximum: ${MAX_FILES}. Specify fewer files or split into multiple reviews.` 
        }]
    };
}

// Per-file size check during read
const stats = await stat(absPath);
if (stats.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${filePath} (${stats.size} bytes, max: ${MAX_FILE_SIZE})`);
    continue;
}
```

### 8.2 Sensitive Data
**Issue**: Tool reads local files.  
**Mitigation**: Context gathering happens entirely locally. Only selected content is sent via authenticated Copilot SDK channel. Files are read using workspace-relative paths to prevent directory traversal.

### 8.3 Input Validation
**Issue**: Client-provided file names and content need validation.  
**Mitigation**:

```typescript
import { z } from 'zod';

// Schema validates structure
const fileSchema = z.object({
    name: z.string().min(1).max(500), // Reasonable path length
    content: z.string().max(MAX_FILE_SIZE)
});

const inputSchema = z.object({
    files: z.array(fileSchema).min(1).max(MAX_FILES)
});

// Additional runtime validation
for (const file of files) {
    // Validate file name doesn't contain suspicious patterns
    if (file.name.includes('..') || file.name.startsWith('/')) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Invalid file path: ${file.name}` }]
        };
    }
}
```

**Why this approach?**:
- Client sends content directly (no file system access needed)
- No command execution required (git operations removed)
- Validates against directory traversal patterns
- Enforces size limits before processing

### 8.4 Content Size Validation
**Issue**: Large file content could exhaust memory or exceed context windows.  
**Mitigation**:
```typescript
const MAX_FILE_SIZE = parseInt(process.env.CODE_REVIEW_MAX_FILE_SIZE ?? '50000', 10);
const MAX_TOTAL_SIZE = MAX_FILES * MAX_FILE_SIZE; // 2.5 MB default

let totalSize = 0;
for (const file of files) {
    const fileSize = Buffer.byteLength(file.content, 'utf8');
    totalSize += fileSize;
    
    if (fileSize > MAX_FILE_SIZE) {
        return {
            isError: true,
            content: [{ 
                type: 'text', 
                text: `File too large: ${file.name} (${fileSize} bytes, max: ${MAX_FILE_SIZE})` 
            }]
        };
    }
}

if (totalSize > MAX_TOTAL_SIZE) {
    return {
        isError: true,
        content: [{ 
            type: 'text', 
            text: `Total content too large: ${totalSize} bytes (max: ${MAX_TOTAL_SIZE}). Review fewer files.` 
        }]
    };
}
```

### 8.5 Timeout Handling
**Issue**: Review operations could hang indefinitely.  
**Mitigation**: All operations have timeouts:
- Standards file read: 5s
- SDK session: Configurable via `CODE_REVIEW_TIMEOUT` (default: 60s)
- Total operation timeout: 90s (enforced by MCP server)

## 9. Tool API Contract

### 9.1 Input
```typescript
interface CodeReviewInput {
  files: Array<{
    name: string;      // File path relative to workspace root (e.g., "src/index.ts")
    content: string;   // Full file content as string
  }>;
}
```

**Requirements**:
- `files` array is **required** and must contain 1-50 files
- `name` must be a relative path (no absolute paths, no ".." traversal)
- `content` must not exceed `CODE_REVIEW_MAX_FILE_SIZE` (default: 50 KB)
- Total content across all files must not exceed 2.5 MB

**Client Responsibilities**:
- IDE plugin must detect modified/relevant files
- IDE plugin must read file content from editor buffers or workspace
- IDE plugin must send file names and content to the server

### 9.2 Output
- **Success**: `CallToolResult` with `content` containing a single text entry (Markdown review body).
  ```json
  {
    "content": [
      {
        "type": "text",
        "text": "# Code Review Summary\n## Overall Assessment\n..."
      }
    ]
  }
  ```
- **Validation Error**: `CallToolResult` with `isError: true`
  - Invalid file paths
  - Too many files
  - File too large
  - Invalid input schema
- **SDK/Runtime Error**: `CallToolResult` with `isError: true`
  - Authentication failure
  - Network errors
  - Timeout
  - Model invocation failure

### 9.3 Failure Modes
- **No files provided**: `isError: true` - "No files provided. Client must send file names and content."
- **Invalid file path**: `isError: true` - File path contains ".." or is absolute.
- **File too large**: `isError: true` - Single file exceeds `CODE_REVIEW_MAX_FILE_SIZE`.
- **Too many files**: `isError: true` - More than `CODE_REVIEW_MAX_FILES` provided.
- **Total size exceeded**: `isError: true` - Combined file content exceeds limit.
- **Standards file missing**: Fallback standards text is used (see below).
- **Copilot SDK invocation failure**: `isError: true` with invocation error details.
- **Network/API failures**: Captured and returned as `isError: true`.
- **Timeout exceeded**: Session terminated, partial results returned if available.
- **Authentication failure**: Clear error message directing user to run `copilot auth login`.

**Fallback Standards Text** (when `resources/code-review/standards.md` is missing):
```
# Code Review Standards (Fallback)

## General Principles
- Ensure code readability and maintainability
- Check for proper error handling
- Verify type safety and avoid `any`
- Look for security vulnerabilities
- Assess performance implications

## Specific Checks
- All public functions should have JSDoc comments
- Use Zod for input validation
- Prefer `execFile` over `exec` for child processes
- No hardcoded credentials or secrets
```

### 9.4 Determinism Rules
- **File ordering**: Process files in the order provided by client (IDE maintains order).
- **Error messages**: Use stable templates for non-success outcomes (tests can assert exact behavior).
- **Model determinism**: Note that LLM outputs are non-deterministic by nature; same input may yield different review content.
- **Client responsibility**: Client determines which files to review and in what order.

## 10. Testing Strategy

### 10.1 Unit Tests (`test/tools/code-review/index.test.ts`)
**Focus**: Tool logic isolation without SDK calls
```typescript
// Mock Copilot SDK for unit tests
jest.mock('@github/copilot-sdk');

describe('code-review tool', () => {
    test('rejects empty files array', () => { /* ... */ });
    test('validates file paths reject absolute paths', () => { /* ... */ });
    test('validates file paths reject directory traversal', () => { /* ... */ });
    test('enforces max file limit', () => { /* ... */ });
    test('enforces max file size per file', () => { /* ... */ });
    test('enforces total content size limit', () => { /* ... */ });
    test('falls back to default standards when file missing', () => { /* ... */ });
    test('processes files in client-provided order', () => { /* ... */ });
});
```

### 10.2 Integration Tests (`test/integration/tools/code-review.test.ts`)
**Focus**: End-to-end with real SDK/CLI (requires Copilot subscription)
```typescript
import { readFile } from 'node:fs/promises';

// Requires COPILOT_GITHUB_TOKEN or logged-in CLI
describe('code-review integration', () => {
    test('reviews actual code files', async () => {
        const content = await readFile('src/index.ts', 'utf-8');
        const result = await callCodeReviewTool({ 
            files: [{ name: 'src/index.ts', content }] 
        });
        expect(result.content[0].text).toContain('review');
    }, 120000); // 2min timeout
    
    test('reviews multiple files', async () => {
        const file1 = await readFile('src/index.ts', 'utf-8');
        const file2 = await readFile('src/meta.ts', 'utf-8');
        const result = await callCodeReviewTool({
            files: [
                { name: 'src/index.ts', content: file1 },
                { name: 'src/meta.ts', content: file2 }
            ]
        });
        expect(result.content[0].text).toContain('index.ts');
        expect(result.content[0].text).toContain('meta.ts');
    }, 120000);
});
```

### 10.3 Test Fixtures
- `test/fixtures/code-review/sample-code.ts`: Sample code with intentional issues
- `test/fixtures/code-review/standards-custom.md`: Test standards file
- `test/fixtures/code-review/expected-output.md`: Sample review template for assertions

### 10.4 CI/CD Considerations
- Unit tests run on every commit (no SDK required)
- Integration tests run only when `COPILOT_GITHUB_TOKEN` is set
- Use GitHub Actions secrets for authentication in CI

## 11. Observability & Debugging

### 11.1 Logging Strategy
```typescript
import { Logger } from '../core/logger.js';

const logger = Logger.create('code-review');

// Log all review operations with context
logger.info('Starting code review', { 
    fileCount: targetFiles.length, 
    model: reviewModel 
});

logger.debug('Git diff output', { files: targetFiles });

logger.error('SDK invocation failed', { 
    error: err.message, 
    model: reviewModel,
    timeout: reviewTimeout 
});
```

### 11.2 Metrics to Track
- **Duration**: Time from invocation to completion
- **Token usage**: Input/output tokens (if SDK exposes metrics)
- **Success rate**: Successful reviews vs errors
- **File counts**: Average files per review
- **Model distribution**: Which models are used

### 11.3 Request Context Integration
Use existing `request-context.ts` to track review operations:
```typescript
import { withRequestContext } from '../core/request-context.js';

export function registerCodeReview(server: McpServer) {
    server.registerTool('code_review', schema, async (input) => {
        return withRequestContext('code_review', async (ctx) => {
            ctx.log('info', 'Code review started', { files: input.files });
            // ... implementation
        });
    });
}
```

### 11.4 Debug Mode
```bash
# Enable verbose SDK logging
export DEBUG="@github/copilot-sdk:*"

# Enable tool debug output
export LOG_LEVEL="debug"

npm run dev
```

## 12. Tool Registration & Aliases

### 12.1 Registration in `src/tools/index.ts`
```typescript
import { registerCodeReview } from './code-review/index.js';

export const REGISTERED_TOOL_NAMES = [
    'hello-world',
    'add_two_numbers',
    'add-two-numbers',    // UX alias
    'code_review',        // Primary name
    'code-review',        // UX alias for consistency
] as const;

export function registerTools(server: McpServer) {
    registerHelloWorld(server);
    registerAddTwoNumbers(server); // Also registers 'add-two-numbers' alias
    registerCodeReview(server);     // Should also register 'code-review' alias
}
```

### 12.2 Alias Implementation
```typescript
export function registerCodeReview(server: McpServer) {
    const schema = {
        description: 'Review code changes against project standards using Copilot agent.',
        inputSchema: z.object({ /* ... */ })
    };
    
    const handler = async (input: { files?: string[] }) => {
        // ... implementation
    };
    
    // Register primary name
    server.registerTool('code_review', schema, handler);
    
    // Register UX alias for consistency with kebab-case convention
    server.registerTool('code-review', schema, handler);
}
```

## 13. Output Format Specification

### 13.1 Expected Review Structure
The model should return Markdown with the following sections:

```markdown
# Code Review Summary

## Overall Assessment
[High-level summary of the code quality]

## Critical Issues (🔴)
### [File]: [Issue Title]
**Severity**: Critical
**Line**: [line number or range]
**Problem**: [description]
**Fix**:
​```typescript
[suggested code]
​```

## Warnings (🟡)
[Similar structure]

## Suggestions (🟢)
[Similar structure]

## Positive Observations
[What's done well]
```

### 13.2 Model Prompt Template
```typescript
const systemPrompt = `You are a senior software engineer performing a code review.

RETURN FORMAT:
Use the following Markdown template:

# Code Review Summary
## Overall Assessment
[summary]

## Issues
### 🔴 Critical Issues
[if any]

### 🟡 Warnings  
[if any]

### 🟢 Suggestions
[if any]

## Positive Observations
[always include]

For each issue, provide:
- File and line number
- Clear problem description
- Specific fix with code snippet

STANDARDS:
${standards}

Be concise but actionable. Prioritize security and correctness over style.`;
```

## 14. Performance Benchmarks

### 14.1 Expected Latency
- **Single file (<1000 lines)**: 5-10 seconds
- **10 files**: 20-40 seconds
- **50 files**: 60-120 seconds
- **With extended thinking**: +10-20 seconds

### 14.2 Token Usage Estimates
- **Input**: ~2000 tokens per file (average)
- **Output**: ~1000 tokens per review
- **Standards**: ~500 tokens

### 14.3 Concurrency Limits
- **Per-session limit**: 1 review at a time per MCP session
- **Global limit**: Determined by Copilot API rate limits
- **Recommendation**: Queue reviews server-side if needed

## 15. Migration Checklist

### Phase 1: Preparation
- [x] Design document created
- [ ] Install `@github/copilot-sdk@^0.1.23`
- [ ] Verify Copilot CLI installed and authenticated
- [ ] Create test fixtures

### Phase 2: Implementation
- [ ] Update `src/tools/code-review/index.ts`:
  - [ ] Remove all git operations (client sends file content)
  - [ ] Update input schema to accept `{name, content}[]`
  - [ ] Replace `server.createMessage` with Copilot SDK
  - [ ] Add resource limits (max files, file size, total size)
  - [ ] Add path validation (reject absolute paths, ".." traversal)
  - [ ] Add content size validation
  - [ ] Add timeout handling
  - [ ] Implement fallback standards
  - [ ] Add `code-review` alias registration
- [ ] Add configuration:
  - [ ] Environment variables in `.env.example`
  - [ ] Document model options
- [ ] Update `resources/code-review/standards.md`:
  - [ ] Add execFile recommendation
  - [ ] Add path validation rule

### Phase 3: Testing
- [ ] Write unit tests (with SDK mocking)
- [ ] Write integration tests
- [ ] Test error scenarios:
  - [ ] Empty files array
  - [ ] Single file too large
  - [ ] Total content too large
  - [ ] Too many files
  - [ ] Invalid file paths (absolute, ".." traversal)
  - [ ] Invalid input schema
  - [ ] SDK timeout
  - [ ] Authentication failure
- [ ] Verify cleanup on errors (session.destroy, client.stop)

### Phase 4: Documentation
- [ ] Update README with:
  - [ ] Copilot SDK requirement
  - [ ] Authentication setup
  - [ ] Configuration options
  - [ ] Usage examples
- [ ] Add troubleshooting guide
- [ ] Document model selection

### Phase 5: Deployment
- [ ] Run full test suite
- [ ] Verify no regressions in other tools
- [ ] Update version in `package.json`
- [ ] Tag release
- [ ] Monitor initial usage for errors

## 16. Approach Change Summary (Sampling → Copilot SDK Agent)

- **Removed approach**: MCP Sampling via `server.createMessage` + server-side git discovery.
- **New approach**: 
  - MCP tool handler invokes Copilot SDK agent runtime directly
  - Client (IDE plugin) sends file names and content to server
  - No server-side file system access or git operations required
- **Why**: 
  - Better lifecycle control and clearer session handling
  - Alignment with Copilot SDK technical preview capabilities
  - Client knows exactly which files need review (already open/edited)
  - Simpler security model (no command execution, no file system access)
  - Works even for unsaved files in editor buffers
- **Migration note**: 
  - **Breaking change**: Input schema changed from `files?: string[]` to `files: {name, content}[]`
  - Client must be updated to send file content
  - Server behavior is simpler and more secure
- **Package**: `@github/copilot-sdk` v0.1.23 (latest as of February 2026)
- **Status**: Technical Preview - suitable for development and testing, production use pending GA release.
