import type { Event, EventHint } from "@sentry/types";

type EventException = NonNullable<NonNullable<Event["exception"]>["values"]>[number];

const WALLET_ERROR_PATTERNS = [
  "chrome.runtime.sendmessage",
  "runtime.sendmessage",
  "must specify an extension id",
  "extension id (string)",
  "from a webpage must specify an extension id",
];

const WALLET_STACK_HINTS = ["privy", "inpage", "wallet", "ethereum"];

const normalize = (value?: string | null) => value?.toLowerCase() ?? "";

const messageLooksLikeWalletError = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = normalize(value);
  return WALLET_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const exceptionValuesContainWalletError = (exceptions?: EventException[]): boolean => {
  if (!exceptions?.length) {
    return false;
  }

  return exceptions.some((exception) => {
    if (messageLooksLikeWalletError(exception.value) || messageLooksLikeWalletError(exception.type)) {
      return true;
    }

    const stackFrames = exception.stacktrace?.frames ?? [];
    if (stackFrames.length === 0) {
      return false;
    }

    return stackFrames.some((frame) => {
      const functionName = normalize(frame.function);
      const filename = normalize(frame.filename);
      const absPath = normalize(frame.abs_path);

      return WALLET_STACK_HINTS.some((pattern) => {
        return (
          functionName.includes(pattern) ||
          filename.includes(pattern) ||
          absPath.includes(pattern)
        );
      });
    });
  });
};

export function shouldFilterWalletExtensionError(event: Event, hint?: EventHint): boolean {
  const hintException = hint?.originalException;
  const hintMessage = typeof hintException === "string"
    ? hintException
    : hintException instanceof Error
      ? hintException.message || hintException.stack || ""
      : "";

  const candidateMessages = [
    hintMessage,
    event.message,
    event.logentry?.message,
    (hint?.syntheticException instanceof Error && (hint.syntheticException.message || hint.syntheticException.stack)) || "",
  ];

  if (candidateMessages.some(messageLooksLikeWalletError)) {
    return true;
  }

  if (exceptionValuesContainWalletError(event.exception?.values)) {
    return true;
  }

  const breadcrumbs = event.breadcrumbs ?? [];
  if (breadcrumbs.some((breadcrumb) => messageLooksLikeWalletError(breadcrumb.message))) {
    return true;
  }

  return false;
}
