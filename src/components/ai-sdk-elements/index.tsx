/**
 * AI SDK Elements
 *
 * Custom implementation of AI SDK Elements patterns
 * https://ai-sdk.dev/elements
 *
 * These components provide a consistent, composable interface for
 * building chat interfaces with the Vercel AI SDK.
 */

export {
  Message,
  MessageContent,
  MessageList,
  MessageAvatar,
  MessageMetadata,
  type MessageProps,
  type MessageContentProps,
  type MessageListProps,
  type MessageAvatarProps,
  type MessageMetadataProps,
} from './message';

export {
  PromptForm,
  PromptInput,
  PromptSubmit,
  PromptContainer,
  PromptActions,
  PromptLoading,
  type PromptFormProps,
  type PromptInputProps,
  type PromptSubmitProps,
  type PromptContainerProps,
  type PromptActionsProps,
  type PromptLoadingProps,
} from './prompt';
