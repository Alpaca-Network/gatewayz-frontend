#!/usr/bin/env python3
import os
import sys
import argparse
from typing import List, Dict

try:
    from anthropic import Anthropic
except ImportError:
    print("Please install the SDK first: pip install anthropic", file=sys.stderr)
    sys.exit(1)

DEFAULT_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")
# Model names evolve; this default targets Claude Sonnet 4.5. You can override
# with:  export CLAUDE_MODEL="claude-opus-4-1-20250805"  or use --model.
# (See Anthropic docs for the latest model IDs.)

def main():
    parser = argparse.ArgumentParser(description="Tiny terminal chat with Claude")
    parser.add_argument("-m", "--model", default=DEFAULT_MODEL, help="Claude model ID")
    parser.add_argument("-s", "--system", default="You are a helpful, concise assistant.",
                        help="System prompt")
    parser.add_argument("--max-tokens", type=int, default=1024, help="Max output tokens")
    parser.add_argument("--no-stream", action="store_true", help="Disable streaming output")
    args = parser.parse_args()

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)

    client = Anthropic()  # uses ANTHROPIC_API_KEY from env

    print(f"Model: {args.model}")
    print("Type /reset to clear history, /exit to quit.\n")

    messages: List[Dict[str, str]] = []

    while True:
        try:
            user = input("\033[1mYou:\033[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not user:
            continue
        if user.lower() == "/exit":
            print("Bye!")
            break
        if user.lower() == "/reset":
            messages.clear()
            print("History cleared.")
            continue

        messages.append({"role": "user", "content": user})

        try:
            if args.no_stream:
                # Non-streaming
                resp = client.messages.create(
                    model=args.model,
                    max_tokens=args.max_tokens,
                    system=args.system,
                    messages=messages,
                )  # returns a Message
                # content is a list of content blocks; print text blocks
                text = "".join(
                    part.text for block in resp.content if hasattr(block, "text")
                    for part in (block,)
                ) if hasattr(resp, "content") else str(resp)
                print("\033[36mClaude:\033[0m " + text)
                messages.append({"role": "assistant", "content": text})
            else:
                # Streaming (preferred)
                # SDK helper provides a text stream for easy printing.
                with client.messages.stream(
                    model=args.model,
                    max_tokens=args.max_tokens,
                    system=args.system,
                    messages=messages,
                ) as stream:
                    print("\033[36mClaude:\033[0m ", end="", flush=True)
                    for chunk in stream.text_stream:
                        print(chunk, end="", flush=True)
                    print()
                    final = stream.get_final_message()
                    # Store assistant turn back into history
                    final_text = "".join(
                        part.text for block in final.content if hasattr(block, "text")
                        for part in (block,)
                    )
                    messages.append({"role": "assistant", "content": final_text})
                    # Optional usage stats
                    if getattr(final, "usage", None):
                        print(f"[usage: in={final.usage.input_tokens}, out={final.usage.output_tokens}]")
        except Exception as e:
            print(f"\n[Error] {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
