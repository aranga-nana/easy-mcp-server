# Code Review Standards & Guidelines

## General Principles
- **Readability**: Code should be self-documenting. Use descriptive variable and function names.
- **Maintainability**: Functions should be small and focused (Single Responsibility Principle).
- **Type Safety**: Avoid `any`. Use strict typing and interfaces.
- **Error Handling**: proper try-catch blocks where external calls are made. No silent failures.

## Security
- **Input Validation**: usage of Zod schemas for all external inputs is mandatory.
- **Secrets**: No hardcoded API keys, tokens, or credentials. Use environment variables.
- **Injection**: Ensure no shell injection possibilities (use `execFile` over `exec`).

## Performance
- **Async/Await**: Proper usage of asynchronous patterns. Avoid blocking the event loop.
- **Loops**: Avoid expensive operations inside hot loops.

## Documentation
- **JSDoc**: All exported functions must have JSDoc comments describing parameters and return types.
