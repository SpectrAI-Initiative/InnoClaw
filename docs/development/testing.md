# Testing

This guide covers how to write and run tests for InnoClaw.

## Test Framework

InnoClaw uses [Vitest](https://vitest.dev/) (v4+) as its test framework, configured in `vitest.config.ts`.

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Test file patterns
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with Vitest directly
npx vitest run

# Run tests in watch mode (re-runs on file changes)
npx vitest

# Run a specific test file
npx vitest run src/lib/rag/chunker.test.ts

# Run tests matching a pattern
npx vitest run --grep "should chunk text"
```

## Writing Tests

### Test File Location

Test files should be co-located with the source files they test:

```
src/
├── lib/
│   ├── rag/
│   │   ├── chunker.ts
│   │   └── chunker.test.ts    # Tests for chunker.ts
│   └── utils/
│       ├── helpers.ts
│       └── helpers.test.ts    # Tests for helpers.ts
```

### Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-module";

describe("myFunction", () => {
  it("should return expected result", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });

  it("should handle edge cases", () => {
    expect(myFunction("")).toBe("");
    expect(myFunction(null)).toBeNull();
  });
});
```

### Path Aliases

Use the `@/` alias to import from the `src/` directory:

```typescript
import { someUtil } from "@/lib/utils/helpers";
```

## Test Categories

### Unit Tests

Test individual functions and modules in isolation:

```bash
npx vitest run src/lib/rag/
```

### Integration Tests

Test interactions between modules (e.g., API routes with database):

```bash
npx vitest run src/app/api/
```

## Best Practices

- **Co-locate** test files with source files (e.g., `module.test.ts` next to `module.ts`)
- **Use descriptive names** for test cases that explain expected behavior
- **Test edge cases** — empty inputs, null values, boundary conditions
- **Mock external dependencies** — API calls, file system operations
- **Keep tests focused** — each test should verify one specific behavior
