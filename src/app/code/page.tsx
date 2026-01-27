/**
 * Code route - serves the same content as /claude-code
 *
 * This route exists to provide a clean URL (/code) with custom
 * Open Graph metadata for the Claude Code + GatewayZ page.
 * Metadata is defined in layout.tsx.
 */
export { default } from '../claude-code/page';
