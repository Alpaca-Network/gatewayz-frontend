import { describe, it, expect } from "vitest";
import { ISandboxSession } from "../types";
import {
  hasSubmodules,
  initializeSubmodules,
  updateSubmodules,
  getSubmoduleStatus,
  commitSubmoduleChanges,
  pushSubmodules,
} from "./git-submodules";

// Mock sandbox session for testing
function createMockSession(
  commandResults: Record<string, string | Error> = {},
): ISandboxSession {
  return {
    sandboxId: "test-sandbox",
    sandboxProvider: "docker" as const,
    repoDir: "/repo",
    homeDir: "/home/user",
    runCommand: async (cmd: string) => {
      // Match command patterns
      for (const [pattern, result] of Object.entries(commandResults)) {
        if (cmd.includes(pattern)) {
          if (result instanceof Error) {
            throw result;
          }
          return result;
        }
      }
      return "";
    },
    runBackgroundCommand: async () => {},
    writeTextFile: async () => {},
    writeFile: async () => {},
    readTextFile: async () => "",
    hibernate: async () => {},
    shutdown: async () => {},
  } as ISandboxSession;
}

describe("git-submodules", () => {
  describe("hasSubmodules", () => {
    it("should return true when .gitmodules exists", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
      });

      const result = await hasSubmodules({ session });
      expect(result).toBe(true);
    });

    it("should return false when .gitmodules does not exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await hasSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should return false on command error", async () => {
      const session = createMockSession({
        "test -f .gitmodules": new Error("Command failed"),
      });

      const result = await hasSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should pass repoRoot as cwd when provided", async () => {
      let capturedCwd: string | undefined;

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("test -f .gitmodules")) {
            capturedCwd = options?.cwd;
            return "yes";
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      await hasSubmodules({ session, repoRoot: "/custom/path" });
      expect(capturedCwd).toBe("/custom/path");
    });
  });

  describe("initializeSubmodules", () => {
    it("should initialize submodules when .gitmodules exists", async () => {
      const calledCommands: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string) => {
          calledCommands.push(cmd);
          if (cmd.includes("test -f .gitmodules")) return "yes";
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await initializeSubmodules({ session });

      expect(result).toBe(true);
      expect(calledCommands.some((c) => c.includes("git submodule init"))).toBe(
        true,
      );
      expect(
        calledCommands.some((c) => c.includes("git submodule update")),
      ).toBe(true);
    });

    it("should return false when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await initializeSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should return false and warn when initialization fails", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule init": new Error("Init failed"),
      });

      const result = await initializeSubmodules({ session });
      expect(result).toBe(false);
    });
  });

  describe("updateSubmodules", () => {
    it("should update submodules when .gitmodules exists", async () => {
      const calledCommands: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string) => {
          calledCommands.push(cmd);
          if (cmd.includes("test -f .gitmodules")) return "yes";
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await updateSubmodules({ session });

      expect(result).toBe(true);
      expect(calledCommands.some((c) => c.includes("git submodule sync"))).toBe(
        true,
      );
      expect(
        calledCommands.some((c) => c.includes("git submodule update")),
      ).toBe(true);
    });

    it("should return false when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await updateSubmodules({ session });
      expect(result).toBe(false);
    });

    it("should return false and warn when update fails", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule sync": "",
        "git submodule update": new Error("Update failed"),
      });

      const result = await updateSubmodules({ session });
      expect(result).toBe(false);
    });
  });

  describe("getSubmoduleStatus", () => {
    it("should return no changes when submodules are up to date", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status":
          " 1234567890abcdef lib/foo (v1.0.0)\n 234567890abcdef1 lib/bar (v2.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(false);
      expect(result.changedSubmodules).toEqual([]);
    });

    it("should detect changed submodules with + prefix", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status":
          "+1234567890abcdef lib/foo (v1.0.1)\n 234567890abcdef1 lib/bar (v2.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual(["lib/foo"]);
    });

    it("should detect uninitialized submodules with - prefix", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status": "-1234567890abcdef lib/foo\n lib/bar",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual(["lib/foo"]);
    });

    it("should detect conflicted submodules with U prefix", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status": "U1234567890abcdef lib/foo (v1.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual(["lib/foo"]);
    });

    it("should return no changes when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(false);
      expect(result.changedSubmodules).toEqual([]);
    });

    it("should detect multiple types of changes simultaneously", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status":
          "+1234567890abcdef lib/changed (v1.0.1)\n" +
          "-234567890abcdef1 lib/uninit\n" +
          "U34567890abcdef12 lib/conflict (v1.0.0)\n" +
          " 4567890abcdef123 lib/ok (v2.0.0)",
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(true);
      expect(result.changedSubmodules).toEqual([
        "lib/changed",
        "lib/uninit",
        "lib/conflict",
      ]);
    });

    it("should handle error in status check gracefully", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule status": new Error("Status failed"),
      });

      const result = await getSubmoduleStatus({ session });

      expect(result.hasChanges).toBe(false);
      expect(result.changedSubmodules).toEqual([]);
    });
  });

  describe("commitSubmoduleChanges", () => {
    it("should commit changes in submodules with modifications", async () => {
      const committedSubmodules: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("test -f .gitmodules")) {
            return "yes";
          }
          if (cmd.includes("git submodule foreach")) {
            return "lib/foo\nlib/bar";
          }
          if (cmd.includes("git status --porcelain")) {
            // lib/foo has changes, lib/bar doesn't
            if (options?.cwd?.includes("lib/foo")) {
              return "M file.txt";
            }
            return "";
          }
          if (cmd.includes("git add -A")) {
            return "";
          }
          if (cmd.includes("git commit")) {
            if (options?.cwd?.includes("lib/foo")) {
              committedSubmodules.push("lib/foo");
            }
            return "";
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual(["lib/foo"]);
      expect(committedSubmodules).toContain("lib/foo");
    });

    it("should return empty array when no submodules exist", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "",
      });

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual([]);
    });

    it("should skip submodules without changes", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule foreach": "lib/foo",
        "git status --porcelain": "",
      });

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual([]);
    });

    it("should use --recursive flag in git submodule foreach", async () => {
      const calledCommands: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string) => {
          calledCommands.push(cmd);
          if (cmd.includes("test -f .gitmodules")) return "yes";
          if (cmd.includes("git submodule foreach")) return "";
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      const foreachCmd = calledCommands.find((c) =>
        c.includes("git submodule foreach"),
      );
      expect(foreachCmd).toBeDefined();
      expect(foreachCmd).toContain("--recursive");
    });

    it("should use bashQuote for commit message escaping", async () => {
      const calledCommands: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          calledCommands.push(cmd);
          if (cmd.includes("test -f .gitmodules")) return "yes";
          if (cmd.includes("git submodule foreach")) return "lib/foo";
          if (cmd.includes("git status --porcelain")) {
            if (options?.cwd?.includes("lib/foo")) return "M file.txt";
            return "";
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      await commitSubmoduleChanges({
        session,
        commitMessage: "fix: it's a test with 'quotes'",
      });

      const commitCmd = calledCommands.find((c) => c.includes("git commit"));
      expect(commitCmd).toBeDefined();
      // bashQuote wraps in single quotes and escapes internal single quotes
      expect(commitCmd).toContain("git commit -m ");
      // Should not use the old manual escaping pattern
      expect(commitCmd).not.toContain("'\\''");
    });

    it("should handle multiple submodules with mixed changes", async () => {
      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("test -f .gitmodules")) return "yes";
          if (cmd.includes("git submodule foreach"))
            return "lib/foo\nlib/bar\nlib/baz";
          if (cmd.includes("git status --porcelain")) {
            if (options?.cwd?.includes("lib/foo")) return "M file.txt";
            if (options?.cwd?.includes("lib/baz")) return "A new-file.txt";
            return "";
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Update deps",
      });

      expect(result).toEqual(["lib/foo", "lib/baz"]);
    });

    it("should handle individual submodule commit failure gracefully", async () => {
      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("test -f .gitmodules")) return "yes";
          if (cmd.includes("git submodule foreach")) return "lib/foo\nlib/bar";
          if (cmd.includes("git status --porcelain")) {
            return "M file.txt"; // Both have changes
          }
          if (cmd.includes("git commit")) {
            if (options?.cwd?.includes("lib/foo")) {
              throw new Error("Commit failed in submodule");
            }
            return "";
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      // lib/foo failed, lib/bar succeeded
      expect(result).toEqual(["lib/bar"]);
    });

    it("should return empty array when foreach command fails", async () => {
      const session = createMockSession({
        "test -f .gitmodules": "yes",
        "git submodule foreach": new Error("foreach failed"),
      });

      const result = await commitSubmoduleChanges({
        session,
        commitMessage: "Test commit",
      });

      expect(result).toEqual([]);
    });
  });

  describe("pushSubmodules", () => {
    it("should push specified submodules on a branch", async () => {
      const pushedSubmodules: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("git symbolic-ref HEAD")) {
            return "refs/heads/main";
          }
          if (cmd === "git push") {
            if (options?.cwd?.includes("lib/foo")) {
              pushedSubmodules.push("lib/foo");
            }
            if (options?.cwd?.includes("lib/bar")) {
              pushedSubmodules.push("lib/bar");
            }
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await pushSubmodules({
        session,
        submodulePaths: ["lib/foo", "lib/bar"],
      });

      expect(result).toEqual(["lib/foo", "lib/bar"]);
      expect(pushedSubmodules).toEqual(["lib/foo", "lib/bar"]);
    });

    it("should return empty array when no submodules provided", async () => {
      const session = createMockSession({});

      const result = await pushSubmodules({
        session,
        submodulePaths: [],
      });

      expect(result).toEqual([]);
    });

    it("should throw error when push fails to prevent invalid parent references", async () => {
      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("git symbolic-ref HEAD")) {
            return "refs/heads/main";
          }
          if (cmd === "git push") {
            if (options?.cwd?.includes("lib/foo")) {
              throw new Error("Push failed");
            }
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      await expect(
        pushSubmodules({
          session,
          submodulePaths: ["lib/foo", "lib/bar"],
        }),
      ).rejects.toThrow("Failed to push submodule(s): lib/foo");
    });

    it("should handle detached HEAD state with explicit refspec", async () => {
      const pushedCommands: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (cmd.includes("git symbolic-ref HEAD")) {
            return "detached";
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return "abc123def456";
          }
          if (cmd.includes("git push")) {
            pushedCommands.push(cmd);
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      const result = await pushSubmodules({
        session,
        submodulePaths: ["lib/foo"],
      });

      expect(result).toEqual(["lib/foo"]);
      expect(
        pushedCommands.some((c) => c.includes("HEAD:refs/heads/main")),
      ).toBe(true);
    });

    it("should use repoRoot to construct submodule cwd paths", async () => {
      const capturedCwds: string[] = [];

      const session: ISandboxSession = {
        sandboxId: "test-sandbox",
        sandboxProvider: "docker" as const,
        repoDir: "/repo",
        homeDir: "/home/user",
        runCommand: async (cmd: string, options?: { cwd?: string }) => {
          if (options?.cwd) capturedCwds.push(options.cwd);
          if (cmd.includes("git symbolic-ref HEAD")) {
            return "refs/heads/main";
          }
          return "";
        },
        runBackgroundCommand: async () => {},
        writeTextFile: async () => {},
        writeFile: async () => {},
        readTextFile: async () => "",
        hibernate: async () => {},
        shutdown: async () => {},
      } as ISandboxSession;

      await pushSubmodules({
        session,
        submodulePaths: ["lib/foo"],
        repoRoot: "/workspace/project",
      });

      expect(capturedCwds).toContain("/workspace/project/lib/foo");
    });
  });
});
