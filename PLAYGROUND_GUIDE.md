# AI SDK Playground - User Guide

The AI SDK Playground is an interactive testing environment for exploring chain-of-thought reasoning with various AI models.

## 🎯 Features

### Chain-of-Thought Reasoning Display
- **Real-time Streaming**: Watch models think through problems step-by-step
- **Expandable Sections**: Click to show/hide reasoning
- **Visual Indicators**: "Thinking..." label while reasoning streams
- **Completion Status**: Check mark when thinking completes
- **AI SDK Badge**: Clear indication of reasoning source

### Model Selection
- **Multiple Models**: Claude 3.5 Sonnet, Claude Opus 4, GPT-4o, GPT-4 Turbo, Gemini 1.5 Pro
- **Thinking Detection**: Automatic detection of thinking capability
- **Brain Icon Badge**: Visual indicator when thinking is enabled
- **One-Click Switching**: Switch models mid-conversation

### Parameter Controls
- **Temperature** (0-2): Control randomness
  - 0 = Deterministic (same output always)
  - 1 = Balanced
  - 2 = Maximum creativity
- **Max Tokens** (256-4096): Limit response length
  - Shorter = Quicker responses
  - Longer = More detailed reasoning
- **Top P** (0-1): Nucleus sampling
  - Lower = More focused
  - 1 = All tokens considered

### Conversation Management
- **Message History**: Keep track of all messages with timestamps
- **Copy to Clipboard**: One-click copy of any message
- **Clear All**: Reset conversation and start fresh
- **Cancel**: Stop streaming if taking too long

## 📋 How to Use

### 1. Access the Playground
Navigate to `/playground` in your application.

### 2. Select a Model
- Click "Settings" button to show/hide settings
- Choose from available models
- Notice the "Chain-of-thought enabled" indicator for supported models

### 3. Adjust Parameters (Optional)
- Temperature: Slide to control randomness
- Max Tokens: Set maximum response length
- Top P: Fine-tune output diversity

### 4. Send a Message
- Type your prompt in the textarea
- Press `Ctrl+Enter` or click "Send"
- Watch reasoning appear in real-time

### 5. View Results
- Reasoning appears in a dedicated expandable section (amber background)
- Content appears below reasoning
- Click chevron to expand/collapse reasoning

## 💡 Best Practices

### For Testing Reasoning Models
```
"Explain how photosynthesis works. Break it down step-by-step."
```
Models like Claude 3.5 Sonnet will show detailed thinking about the process.

### For Comparing Models
1. Ask the same question with Claude 3.5 Sonnet (with thinking)
2. Switch to GPT-4o (content only)
3. Observe the differences in reasoning approach

### For Complex Problems
```
"Solve this math problem: If it takes 3 people 5 hours to paint a house,
how long would it take 5 people to paint the same house? Think carefully."
```
Longer max_tokens allow models to think more thoroughly.

### For Creative Tasks
- Increase temperature to 1.5 or higher
- Increase max_tokens for more elaborate responses
- Try "Imagine..." or "Describe..." prompts

## 🎨 UI Components

### Settings Panel
Located at the top, toggle with the Settings button:
- Model selector with thinking badge
- Temperature slider
- Max tokens slider
- Top P slider
- Clear messages button

### Message Area
Central area showing:
- User messages (blue, right-aligned)
- Assistant messages (gray, left-aligned)
- Reasoning sections (amber, collapsible)
- Copy buttons on assistant messages

### Input Area
At the bottom:
- Large textarea for entering prompts
- Ctrl+Enter keyboard shortcut
- Send/Cancel buttons
- Authentication status

## 🔍 Understanding Reasoning Display

### Thinking Phase
- **Label**: "Thinking... (click to hide)"
- **Color**: Amber background
- **Indicator**: Pulsing line at the end
- **Expandable**: Click chevron to collapse while thinking continues

### Completed Reasoning
- **Label**: "Show reasoning" / "Hide reasoning"
- **No Indicator**: Steady display (not animated)
- **Content**: Full thinking process preserved
- **Toggleable**: Click to expand/collapse

## ⚙️ Parameter Guide

### Temperature
```
0.0 (Deterministic)
├─ Best for: Factual, consistent answers
├─ Use when: You need predictable outputs
└─ Example: Math problems, factual queries

0.7 (Balanced) ← Default
├─ Best for: General purpose
├─ Use when: Unsure about temperature
└─ Example: Most conversations

1.5 (Creative)
├─ Best for: Stories, creative writing
├─ Use when: You want variety
└─ Example: Brainstorming, creative tasks

2.0 (Maximum)
├─ Best for: Experimental/exploration
├─ Use when: Testing creativity limits
└─ Example: Wild ideas, unexpected combinations
```

### Max Tokens
```
256 (Minimal)
├─ Use when: Quick answers needed
├─ Saves time and tokens
└─ Best for: Simple questions

1024 (Standard) ← Recommended
├─ Use for: Balanced responses
├─ Allows some reasoning
└─ Best for: Most conversations

2048 (Extended) ← Default
├─ Use for: Detailed answers
├─ Good for reasoning
└─ Best for: Complex problems

4096 (Maximum)
├─ Use when: Very detailed needed
├─ May be slow
└─ Best for: Research, analysis
```

### Top P
```
0.5 (Focused)
├─ Use when: Consistent outputs needed
├─ More predictable
└─ Best for: Technical writing

1.0 (All Tokens) ← Default & Recommended
├─ Use for: General conversation
├─ Natural variety
└─ Best for: Most use cases
```

## 🐛 Troubleshooting

### Reasoning Not Showing?
- ✓ Check if model supports thinking (shows badge)
- ✓ Check if parameters show streaming reasoning
- ✓ Try increasing max_tokens
- ✓ Refresh page and try again

### Messages Slow to Load?
- ✓ Reduce max_tokens
- ✓ Try a different model
- ✓ Check internet connection

### Can't Send Messages?
- ✓ Check if authenticated (login required)
- ✓ Check if input is not empty
- ✓ Wait for previous message to complete

### Model Not Available?
- ✓ Check if logged in
- ✓ Check API key is configured
- ✓ Refresh the page

## 🎓 Learning Resources

### Understanding Chain-of-Thought
See `AI_SDK_INTEGRATION.md` for technical details on how reasoning works.

### Model Capabilities
Check `AI_SDK_INTEGRATION_SUMMARY.md` for model specifications.

### Implementation Details
See `src/app/playground/page.tsx` for the playground code.

## 💬 Example Prompts

### For Testing Reasoning
```
"Think about the ethical implications of AI. Consider multiple perspectives."
```

### For Math & Logic
```
"If a train leaves at 9 AM going 60 mph, and another leaves at 10 AM going 80 mph,
when will the second train catch up? Show your work."
```

### For Creative Writing
```
"Write a short story about an AI learning to appreciate nature."
```

### For Analysis
```
"Analyze the pros and cons of remote work. Think about different stakeholders."
```

### For Problem-Solving
```
"I'm trying to organize my code better. What are some patterns I should consider?
Think about scalability, maintainability, and team workflow."
```

## 🚀 Tips & Tricks

1. **Copy Code**: Use the copy button to save code snippets from responses
2. **Compare Models**: Keep playground open in two tabs with different models
3. **Adjust Mid-Conversation**: Change temperature between messages to test effects
4. **Read Reasoning First**: Understand the thinking before the conclusion
5. **Check Thinking Length**: Longer thinking usually means more complex analysis

## 📝 Notes

- **Messages are temporary**: Refresh page to reset
- **No persistent history**: Current session only
- **Authentication required**: Must be logged in
- **API usage tracked**: Your usage counts toward quotas

## 🎉 Getting Started

1. Go to `/playground`
2. Select Claude 3.5 Sonnet
3. Ask: "Explain quantum computing briefly"
4. Watch the reasoning process unfold!

---

For more information, see [README_AI_SDK.md](./README_AI_SDK.md) or [QUICKSTART_AI_SDK.md](./QUICKSTART_AI_SDK.md).
