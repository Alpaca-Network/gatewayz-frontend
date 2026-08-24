# @terragon/sandbox

Sandbox abstraction layer for Terragon coding agents. Provides unified interface across multiple sandbox providers (E2B, Docker, Daytona).

## Features

### Multi-Provider Support

- **E2B**: Production sandbox provider with fast startup times
- **Docker**: Local development and testing
- **Daytona**: Optional provider behind feature flag

### Git Operations

Comprehensive git support including:

- Repository cloning with blobless clones (`--filter=blob:none`)
- Branch management (create, checkout, merge)
- Commit and push with automatic rebase
- Pull request workflows
- **Git Submodules** (auto-detected and fully supported)

### Git Submodule Support

The sandbox automatically detects and handles repositories with git submodules:

#### Auto-Detection

Submodules are automatically detected by checking for `.gitmodules` file. No configuration needed.

#### Clone

When a repository is cloned:

1. Repository is cloned with `--filter=blob:none` (blobless clone)
2. If `.gitmodules` exists, submodules are automatically initialized
3. Submodules are cloned with `--depth=1` (shallow) for performance
4. Recursive submodule support (nested submodules)

#### Commit

When committing changes:

1. Changes within submodule directories are detected
2. Submodule changes are committed first (in their respective repositories)
3. Submodule commits are pushed to their remotes
4. Parent repository commits the updated submodule pointers
5. Parent repository is pushed

#### Pull/Rebase

After pulling or rebasing:

1. Submodules are synced (`git submodule sync`)
2. Submodules are updated to match parent repository's pointers
3. New submodules are automatically initialized

#### Performance

- Shallow clones (`--depth=1`) minimize clone time
- Parallel operations (`--jobs=4`) speed up multi-submodule repos
- Auto-detection prevents overhead for repos without submodules

#### Example Workflow

```typescript
import { createSandbox } from "@terragon/sandbox";

// Clone repo - submodules auto-detected and initialized
const sandbox = await createSandbox({
  githubRepoFullName: "org/repo-with-submodules",
  // ... other options
});

// Make changes to files (including inside submodules)
await sandbox.runCommand("echo 'changed' > submodule/file.txt");

// Commit - submodule changes handled automatically
await gitCommitAndPushBranch(sandbox.session, {
  githubAppName: "terragon-bot",
  generateCommitMessage: async (diff) => "Update submodule",
});
// Result:
// 1. Commits changes in submodule
// 2. Pushes submodule commit
// 3. Commits updated pointer in parent repo
// 4. Pushes parent repo

// Pull latest changes - submodules updated automatically
await gitPullUpstream(sandbox.session);
```

### Daemon System

- Node.js daemon running in each sandbox
- Coordinates agent operations
- Handles file operations and command execution
- MCP (Model Context Protocol) server integration

### Environment Management

- Environment variable injection
- MCP configuration
- Agent credentials (Anthropic, OpenAI, Gemini, Amp)
- Custom setup scripts

## Installation

```bash
pnpm add @terragon/sandbox
```

## Usage

### Basic Sandbox Creation

```typescript
import { createSandbox } from "@terragon/sandbox";

const sandbox = await createSandbox({
  githubRepoFullName: "owner/repo",
  userName: "Agent Name",
  userEmail: "agent@example.com",
  githubAccessToken: "ghp_...",
  createNewBranch: true,
  threadName: "my-task",
  onStatusUpdate: async (status) => {
    console.log("Sandbox status:", status);
  },
});
```

### Git Operations

```typescript
import {
  gitCommitAndPushBranch,
  gitPullUpstream,
  gitPushWithRebase,
} from "@terragon/sandbox/commands";

// Commit and push changes
await gitCommitAndPushBranch(session, {
  githubAppName: "terragon-bot",
  generateCommitMessage: async (diff) => {
    return "Your commit message";
  },
});

// Pull latest changes from upstream
await gitPullUpstream(session);

// Push with automatic rebase on conflicts
const result = await gitPushWithRebase(session, {
  branch: "my-branch",
  setUpstream: true,
});
```

### Submodule Operations

```typescript
import {
  hasSubmodules,
  initializeSubmodules,
  updateSubmodules,
  getSubmoduleStatus,
  commitSubmoduleChanges,
  pushSubmodules,
} from "@terragon/sandbox/commands/git-submodules";

// Check if repo has submodules
const repoHasSubmodules = await hasSubmodules({ session });

// Initialize submodules (done automatically on clone)
await initializeSubmodules({ session });

// Update submodules after pull/rebase (done automatically)
await updateSubmodules({ session });

// Check submodule status
const status = await getSubmoduleStatus({ session });
console.log("Changed submodules:", status.changedSubmodules);

// Commit submodule changes (done automatically in commit flow)
const committed = await commitSubmoduleChanges({
  session,
  commitMessage: "Update dependencies",
});
```

## Architecture

### Sandbox Providers

Each provider implements the `ISandboxProvider` interface:

```typescript
interface ISandboxProvider {
  create(options: CreateSandboxOptions): Promise<ISandboxSession>;
  resume(sandboxId: string): Promise<ISandboxSession>;
  hibernate(sandboxId: string): Promise<void>;
  delete(sandboxId: string): Promise<void>;
}
```

### Sandbox Session

The `ISandboxSession` interface provides:

```typescript
interface ISandboxSession {
  sandboxId: string;
  repoDir: string;
  runCommand(cmd: string, options?: CommandOptions): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  readTextFile(path: string): Promise<string>;
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test git-submodules.test.ts

# Watch mode
pnpm test:watch
```

## Git Submodule Implementation Details

### Files

- `src/commands/git-submodules.ts` - Core submodule operations
- `src/commands/git-submodules.test.ts` - Comprehensive test suite
- `src/setup.ts` - Clone and initialization logic
- `src/commands/git-commit-and-push.ts` - Commit workflow with submodule support
- `src/commands/git-pull-upstream.ts` - Pull with submodule updates
- `src/commands/git-push-with-rebase.ts` - Rebase with submodule updates

### Git Commands Used

| Operation  | Commands                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Initialize | `git submodule init`<br>`git submodule update --depth=1 --recursive --jobs=4`                        |
| Update     | `git submodule sync --recursive`<br>`git submodule update --init --recursive --depth=1 --jobs=4`     |
| Status     | `git submodule status --recursive`                                                                   |
| Commit     | `git add -A` (in submodule)<br>`git commit -m "message"` (in submodule)<br>`git push` (in submodule) |

### Error Handling

Submodule operations fail gracefully:

- Missing `.gitmodules`: Operations skip silently
- Initialization failure: Logs warning, continues without submodules
- Commit/push failure: Logs warning, continues with parent repo operations
- Authentication issues: Propagated to parent with helpful error messages

## Environment Variables

### Required

- `GITHUB_ACCESS_TOKEN` - GitHub token for cloning private repos
- `ANTHROPIC_API_KEY` - Claude API access (or Claude OAuth)

### Optional

- `E2B_API_KEY` - E2B sandbox provider
- `DAYTONA_API_KEY` - Daytona sandbox provider (behind feature flag)
- `OPENAI_API_KEY` - For commit message generation
- `GEMINI_API_KEY` - Gemini model support
- `AMP_API_KEY` - Amp model support

## Contributing

1. Make changes to sandbox code
2. Write tests for new features
3. Run `pnpm test` to verify
4. Update this README if adding new features

## License

See root LICENSE file.
