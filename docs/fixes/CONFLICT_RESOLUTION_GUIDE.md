# Chat Page Conflict Resolution Guide

## Overview
You have conflicts between `feat/chat-page-mobile-design` and `master` branches in `src/app/chat/page.tsx`.

## Conflict #1: ChatSidebar Function Signature (Line ~673)

**Resolution:** Keep BOTH - Add `onClose` parameter from mobile branch

```typescript
// RESOLVED VERSION:
const ChatSidebar = ({ sessions, activeSessionId, switchToSession, createNewChat, onDeleteSession, onRenameSession, onClose }: {
    sessions: ChatSession[],
    activeSessionId: string | null,
    switchToSession: (id: string) => void,
    createNewChat: () => void,
    onDeleteSession: (sessionId: string) => void,
    onRenameSession: (sessionId: string, newTitle: string) => void,
    onClose?: () => void  // <- ADD THIS from mobile branch
}) => {
```

## Conflict #2: ChatSidebar Implementation (Line ~875)

**Resolution:** Keep VirtualSessionList from master + add mobile wrapper functions

```typescript
// RESOLVED VERSION:
const ChatSidebar = ({ sessions, activeSessionId, switchToSession, createNewChat, onDeleteSession, onRenameSession, onClose }: {
    // ... types ...
}) => {
    // Memoize grouped sessions
    const groupedSessions = useMemo(() => {
        const startedChats = sessions.filter(session =>
            session.messages.length > 0 || session.title !== 'Untitled Chat'
        );
        return startedChats.reduce((groups, session) => {
            const date = session.startTime;
            let groupName = format(date, 'MMMM d, yyyy');
            if (isToday(date)) groupName = 'Today';
            else if (isYesterday(date)) groupName = 'Yesterday';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(session);
            return groups;
        }, {} as Record<string, ChatSession[]>);
    }, [sessions]);

    // ADD these wrapper functions for mobile
    const wrappedSwitchToSession = (sessionId: string) => {
        switchToSession(sessionId);
        onClose?.();
    };

    const wrappedCreateNewChat = () => {
        createNewChat();
        onClose?.();
    };

    return (
        <aside className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 pb-0 h-full w-full overflow-hidden bg-background">
            <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold">Chat</h2>
            </div>

            <Button
                onClick={wrappedCreateNewChat}  // <- Use wrapped version
                className="w-full bg-foreground text-background hover:bg-foreground/90 h-10 sm:h-9 font-medium flex justify-between items-center gap-2 text-left text-sm touch-manipulation"
            >
                <span>New Chat</span>
                <img src="/uil_plus.svg" alt="Plus" width={18} height={18} className="sm:w-5 sm:h-5" />
            </Button>

            <div className="relative">
                <Input placeholder="Search Chats" className="pl-3 rounded-lg h-9 sm:h-8 text-sm" />
                <img
                    src="/material-symbols_search.svg"
                    alt="Search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5"
                />
            </div>

            {/* Use VirtualSessionList from master for performance */}
            <VirtualSessionList
                groupedSessions={groupedSessions}
                activeSessionId={activeSessionId}
                switchToSession={wrappedSwitchToSession}  // <- Use wrapped version
                onRenameSession={onRenameSession}
                onDeleteSession={onDeleteSession}
            />
        </aside>
    );
};
```

## Conflict #3: Header Layout (Line ~1053)

**Resolution:** Keep mobile-optimized header from feat branch, add FreeModelsBanner

```typescript
// RESOLVED VERSION:
return (
    <>
      <FreeModelsBanner />  {/* ADD from master */}
      <div className="flex h-screen max-h-[calc(100dvh-200px)] has-onboarding-banner:max-h-[calc(100dvh-280px)] bg-background overflow-hidden">
        {/* Left Sidebar - Desktop Only */}
        <div className="hidden lg:flex w-56 xl:w-72 border-r flex-shrink-0 overflow-hidden">
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            switchToSession={switchToSession}
            createNewChat={createNewChat}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
          />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
          {/* ... background logos ... */}

          {/* Mobile Header - Keep mobile-optimized version */}
          <header className="relative z-10 w-full bg-background/95 backdrop-blur-sm border-b border-border/50 lg:border-none lg:bg-transparent">
            {/* Mobile Layout */}
            <div className="flex lg:hidden flex-col gap-2 p-3">
              <div className="flex items-center gap-2 w-full">
                <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 pt-12 overflow-hidden">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Chat Sidebar</SheetTitle>
                    </SheetHeader>
                    <ChatSidebar
                      sessions={sessions}
                      activeSessionId={activeSessionId}
                      switchToSession={switchToSession}
                      createNewChat={createNewChat}
                      onDeleteSession={handleDeleteSession}
                      onRenameSession={handleRenameSession}
                      onClose={() => setMobileSidebarOpen(false)}  {/* ADD onClose */}
                    />
                  </SheetContent>
                </Sheet>

                {/* Title editing section */}
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  {isEditingTitle ? (
                    <Input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={() => {
                        if (editedTitle.trim() && editedTitle !== activeSession?.title && activeSessionId) {
                          handleRenameSession(activeSessionId, editedTitle.trim());
                        }
                        setIsEditingTitle(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editedTitle.trim() && editedTitle !== activeSession?.title && activeSessionId) {
                            handleRenameSession(activeSessionId, editedTitle.trim());
                          }
                          setIsEditingTitle(false);
                        } else if (e.key === 'Escape') {
                          setIsEditingTitle(false);
                        }
                      }}
                      autoFocus
                      className="text-base font-semibold h-auto px-2 py-1 min-w-0 flex-1"
                    />
                  ) : (
                    <h1 className="text-base font-semibold truncate min-w-0 flex-1">
                      {activeSession?.title || 'Untitled Chat'}
                    </h1>
                  )}
                </div>

                {!isEditingTitle && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => {
                      setEditedTitle(activeSession?.title || '');
                      setIsEditingTitle(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Model Selector Row */}
              <div className="w-full">
                <ModelSelect selectedModel={selectedModel} onSelectModel={handleModelSelect} />
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:flex items-center justify-between gap-4 p-6 max-w-7xl mx-auto">
              {/* ... desktop header content ... */}
            </div>
          </header>
          {/* ... rest of content ... */}
```

## Conflict #4: Message Rendering (Line ~1196)

**Resolution:** Keep mobile-responsive styles + master functionality

```typescript
// RESOLVED VERSION:
{messages.filter(msg => msg && msg.role).map((msg, index) => {
  const isAssistant = msg.role === 'assistant';
  const hasAssistantContent = Boolean(isAssistant && msg.content && msg.content.trim().length > 0);
  const showThinkingLoader = isAssistant && msg.isStreaming && !hasAssistantContent;
  const reasoningSource = getReasoningSource(msg.model);

  return (
    <div key={index} className={`flex items-start gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
      <div className={`flex flex-col gap-1 sm:gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full max-w-[95%] sm:max-w-full`}>
        {isAssistant && msg.reasoning && msg.reasoning.trim().length > 0 && (
          <ReasoningDisplay
            reasoning={msg.reasoning}
            isStreaming={msg.isStreaming}
            source={reasoningSource}
            className="w-full max-w-2xl"
          />
        )}

        {msg.role === 'user' ? (
          <div className="rounded-lg p-2.5 sm:p-3 bg-blue-600 dark:bg-blue-600 text-white max-w-full">
            {/* Image preview */}
            {msg.image && (
              <img
                src={msg.image}
                alt="Uploaded image"
                className="max-w-[150px] sm:max-w-[200px] lg:max-w-xs rounded-lg mb-2"
              />
            )}
            {/* Video preview - ADD from master */}
            {msg.video && (
              <video
                src={msg.video}
                controls
                className="max-w-[150px] sm:max-w-[200px] lg:max-w-xs rounded-lg mb-2 object-contain border border-white/20"
                title="Uploaded video"
              />
            )}
            {/* Audio preview - ADD from master */}
            {msg.audio && (
              <audio
                src={msg.audio}
                controls
                className="max-w-[280px] lg:max-w-md mb-2 border-0"
                title="Uploaded audio"
              />
            )}
            <div className="text-sm whitespace-pre-wrap text-white break-words">{msg.content}</div>
          </div>
        ) : showThinkingLoader ? (
          <ThinkingLoader modelName={getModelDisplayName(msg.model)} />
        ) : (
          <div className="rounded-lg p-2.5 sm:p-3 bg-muted/30 dark:bg-muted/20 border border-border max-w-full w-full">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                {getModelDisplayName(msg.model)}
              </p>
              {/* ADD streaming indicator from master */}
              {msg.isStreaming && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="font-medium">Streaming...</span>
                </div>
              )}
            </div>
            <div className="text-sm prose prose-sm max-w-none dark:prose-invert break-words">
              <MarkdownRenderer>{fixLatexSyntax(msg.content)}</MarkdownRenderer>
            </div>
            {/* Action buttons - mobile friendly */}
            <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="h-8 w-8 sm:h-7 sm:w-7 p-0 hover:bg-muted touch-manipulation"
                title="Copy response"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.share({ text: msg.content })}
                className="h-8 w-8 sm:h-7 sm:w-7 p-0 hover:bg-muted touch-manipulation"
                title="Share response"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              {handleRegenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  className="h-8 w-8 sm:h-7 sm:w-7 p-0 hover:bg-muted touch-manipulation"
                  title="Regenerate response"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
})}
```

## Conflict #5: Upload Buttons (Line ~1364)

**Resolution:** Keep ALL upload buttons from master with mobile-friendly styling

```typescript
// RESOLVED VERSION:
<div className="flex items-center gap-1 px-2 py-2 bg-muted/20 dark:bg-muted/40 rounded-lg border border-border">
  {/* Hidden file inputs */}
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    onChange={handleImageSelect}
    className="hidden"
  />
  <input
    ref={videoInputRef}
    type="file"
    accept="video/*"
    onChange={handleVideoSelect}
    className="hidden"
  />
  <input
    ref={audioInputRef}
    type="file"
    accept="audio/*"
    onChange={handleAudioSelect}
    className="hidden"
  />

  {/* Image button - only show if model supports it */}
  {selectedModel?.modalities?.includes('Image') && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg touch-manipulation flex-shrink-0"
      onClick={() => fileInputRef.current?.click()}
      disabled={!ready || (!authenticated && !hasApiKey)}
      title="Upload an image"
    >
      <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  )}

  {/* Video button - ADD from master */}
  {selectedModel?.modalities?.includes('Video') && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg touch-manipulation flex-shrink-0"
      onClick={() => videoInputRef.current?.click()}
      disabled={!ready || (!authenticated && !hasApiKey)}
      title="Upload a video"
    >
      <VideoIcon className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  )}

  {/* Audio button - ADD from master */}
  {selectedModel?.modalities?.includes('Audio') && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg touch-manipulation flex-shrink-0"
      onClick={() => audioInputRef.current?.click()}
      disabled={!ready || (!authenticated && !hasApiKey)}
      title="Upload audio"
    >
      <AudioIcon className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  )}

  {/* Message input */}
  <Input
    ref={messageInputRef}
    placeholder={!ready ? "Authenticating..." : (!authenticated && !hasApiKey) ? "Please log in..." : getPlaceholderText()}
    value={message}
    onChange={(e) => {
      setMessage(e.target.value);
      if (e.target.value.trim()) {
        setUserHasTyped(true);
        userHasTypedRef.current = true;
      }
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (userHasTyped && message.trim() && !isStreamingResponse) {
          handleSendMessage();
        }
      }
    }}
    onInput={() => {
      setUserHasTyped(true);
      userHasTypedRef.current = true;
    }}
    disabled={!ready || (!authenticated && !hasApiKey)}
    autoComplete="off"
    className="border-0 bg-transparent focus-visible:ring-0 text-sm sm:text-base text-foreground flex-1 min-w-0"
  />

  {/* Status indicators */}
  {(!ready || (!authenticated && !hasApiKey) || isStreamingResponse) && (
    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
  )}

  {/* Send button */}
  <Button
    size="icon"
    variant="ghost"
    onClick={handleSendMessage}
    disabled={loading || isStreamingResponse || !message.trim() || !ready || (!authenticated && !hasApiKey)}
    className="h-8 w-8 sm:h-7 sm:w-7 bg-primary hover:bg-primary/90 text-primary-foreground touch-manipulation flex-shrink-0"
    title={!ready
      ? "Waiting for authentication..."
      : (!authenticated && !hasApiKey)
        ? "Please log in"
        : isStreamingResponse
          ? "Please wait for the current response to finish"
          : "Send message"}
  >
    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
  </Button>
</div>
```

## Summary of Changes

### From Mobile Branch (feat/chat-page-mobile-design):
✅ Mobile-optimized header layout
✅ Touch-friendly button sizes
✅ Responsive spacing (sm: classes)
✅ Mobile sidebar with onClose callback
✅ Better mobile text sizing

### From Master Branch:
✅ VirtualSessionList for performance with large lists
✅ Video upload support
✅ Audio upload support
✅ Streaming indicator in messages
✅ FreeModelsBanner component
✅ Image/video/audio previews in messages

### Combined Result:
✅ Best mobile UX
✅ Best performance
✅ All features from both branches
✅ No functionality loss

## Next Steps

1. Apply these resolutions to `src/app/chat/page.tsx`
2. Test on mobile and desktop
3. Test video/audio uploads
4. Test with large chat history (VirtualSessionList)
5. Commit with message: "Merge feat/chat-page-mobile-design with master - resolved conflicts"
