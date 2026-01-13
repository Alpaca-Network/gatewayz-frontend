/**
 * Tests for the Desktop Build Script
 *
 * These tests verify that the build-desktop.js script correctly handles
 * moving and restoring directories that are incompatible with static export.
 */

import fs from 'fs';
import path from 'path';

// Define paths for testing
const SCRIPTS_DIR = path.join(__dirname, '..', '..', '..', 'scripts');
const BUILD_SCRIPT = path.join(SCRIPTS_DIR, 'build-desktop.js');
const APP_DIR = path.join(SCRIPTS_DIR, '..', 'src', 'app');

// Directories that should be excluded from static export
const DIRS_TO_EXCLUDE = [
  'api',
  'insights/assets/[id]',
  'models',
  'organizations/[name]',
  'sandbox/[sandboxId]',
  'share/[token]',
];

describe('build-desktop.js', () => {
  let scriptContent: string;

  beforeAll(() => {
    scriptContent = fs.readFileSync(BUILD_SCRIPT, 'utf-8');
  });

  describe('Script structure', () => {
    it('should exist at the expected path', () => {
      expect(fs.existsSync(BUILD_SCRIPT)).toBe(true);
    });

    it('should be a valid Node.js script with shebang', () => {
      expect(scriptContent).toContain('#!/usr/bin/env node');
    });

    it('should have required function definitions', () => {
      expect(scriptContent).toContain('function moveExcludedDirs()');
      expect(scriptContent).toContain('function restoreExcludedDirs()');
      expect(scriptContent).toContain('async function main()');
    });
  });

  describe('Directory exclusion list', () => {
    it('should include the api directory', () => {
      expect(scriptContent).toContain("'api'");
    });

    it('should include the models directory (force-dynamic page)', () => {
      expect(scriptContent).toContain("'models'");
    });

    it('should include all dynamic route directories', () => {
      DIRS_TO_EXCLUDE.forEach((dir) => {
        expect(scriptContent).toContain(`'${dir}'`);
      });
    });
  });

  describe('Signal handlers for cleanup', () => {
    it('should handle SIGINT gracefully', () => {
      expect(scriptContent).toContain("process.on('SIGINT'");
    });

    it('should handle SIGTERM gracefully', () => {
      expect(scriptContent).toContain("process.on('SIGTERM'");
    });

    it('should call restoreExcludedDirs in signal handlers', () => {
      // Check that signal handlers restore directories
      const sigintIndex = scriptContent.indexOf("process.on('SIGINT'");
      const sigintEnd = scriptContent.indexOf('})', sigintIndex);
      const sigintBlock = scriptContent.slice(sigintIndex, sigintEnd);
      expect(sigintBlock).toContain('restoreExcludedDirs');
    });
  });

  describe('Backup cleanup', () => {
    it('should handle existing backup directory from failed builds', () => {
      expect(scriptContent).toContain('Found existing backup directory');
    });

    it('should always restore directories in finally block', () => {
      expect(scriptContent).toContain('finally');
      // Check that restoreExcludedDirs is called in finally
      const finallyIndex = scriptContent.indexOf('finally');
      const finallyEnd = scriptContent.indexOf('}', finallyIndex + 10);
      const finallyBlock = scriptContent.slice(finallyIndex, finallyEnd);
      expect(finallyBlock).toContain('restoreExcludedDirs');
    });
  });

  describe('Environment variable configuration', () => {
    it('should set NEXT_STATIC_EXPORT=true for static export', () => {
      expect(scriptContent).toContain("NEXT_STATIC_EXPORT: 'true'");
    });
  });

  describe('Required app directories exist', () => {
    it('should have api directory in app', () => {
      const apiDir = path.join(APP_DIR, 'api');
      expect(fs.existsSync(apiDir)).toBe(true);
    });

    it('should have models directory in app', () => {
      const modelsDir = path.join(APP_DIR, 'models');
      expect(fs.existsSync(modelsDir)).toBe(true);
    });
  });

  describe('Next.js integration', () => {
    it('should use npx next build command', () => {
      expect(scriptContent).toContain('npx next build');
    });

    it('should spread process.env to preserve existing variables', () => {
      expect(scriptContent).toContain('...process.env');
    });
  });
});
