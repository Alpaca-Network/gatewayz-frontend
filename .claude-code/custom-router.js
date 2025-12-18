/**
 * Custom router for GatewayZ integration with Claude Code
 *
 * This router dynamically selects the optimal model based on:
 * - Task type (background, webSearch, etc.)
 * - Context length requirements
 * - Model capabilities
 */

module.exports = async function router(req, config) {
  const { body, context } = req;
  const message = body?.messages?.[body.messages.length - 1]?.content || '';
  const contextLength = JSON.stringify(body?.messages || []).length;

  // Check for specific task types in the request
  const isWebSearch = context?.task === 'webSearch' ||
                      message.toLowerCase().includes('search') ||
                      message.toLowerCase().includes('find online');

  const isBackgroundTask = context?.task === 'background' ||
                           context?.background === true;

  const isLongContext = contextLength > 50000 ||
                        body?.messages?.length > 20;

  const isReasoningTask = message.toLowerCase().includes('analyze') ||
                          message.toLowerCase().includes('explain') ||
                          message.toLowerCase().includes('think through') ||
                          context?.task === 'think';

  // Route to appropriate model
  if (isWebSearch) {
    return "gatewayz,google/gemini-2.5-pro";
  }

  if (isLongContext) {
    return "gatewayz,qwen/qwen2-72b-a16b-2507";
  }

  if (isReasoningTask) {
    return "gatewayz,anthropic/claude-3-5-sonnet-20241022";
  }

  if (isBackgroundTask) {
    return "gatewayz,google/gemini-2.5-pro";
  }

  // Default: use GPT-4o mini for standard tasks
  return "gatewayz,openai/gpt-4o-mini";
};
