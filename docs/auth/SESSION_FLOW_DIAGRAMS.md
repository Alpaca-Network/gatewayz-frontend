# Session Creation & Chat Flow Diagrams

## 1. Complete Chat Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER OPENS /chat                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  ChatPageContent Component Mounts    │
        │  - Initialize state hooks            │
        │  - Set up refs (creatingSessionRef)  │
        └──────────────────────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
        ┌─────────────────────┐    ┌──────────────────────┐
        │ Load Existing       │    │ Check for Auto-Send  │
        │ Sessions from API   │    │ Message in URL       │
        │ loadChatSessions()  │    └──────────┬───────────┘
        └──────────┬──────────┘               │
                   │                   ┌──────┴──────┐
                   │                   │             │
                   │                Yes│            No│
                   │                   ▼             │
                   │         ┌──────────────────┐   │
                   │         │ setShouldAutoSend│   │
                   │         │ = true           │   │
                   │         └──────────────────┘   │
                   │                   │             │
                   └───────────┬───────┘─────────────┘
                               │
                               ▼
                ┌──────────────────────────────────┐
                │ Wait for Authentication           │
                │ (Privy or Local Auth)            │
                └──────────────┬───────────────────┘
                               │
                ┌──────────────┴────────────────┐
                │                               │
                ▼                               ▼
        ┌────────────────┐         ┌─────────────────────┐
        │ Auth Failed    │         │ Auth Success        │
        │ Show Login UI  │         │ Extract API Key     │
        └────────────────┘         └──────────┬──────────┘
                                             │
                                ┌────────────┴────────────┐
                                │                         │
                                ▼                         ▼
                        ┌──────────────┐      ┌──────────────────┐
                        │ Auto-Send    │      │ Wait for Manual   │
                        │ Message Param│      │ User Action       │
                        │ Exists?      │      └──────────────────┘
                        └──────────────┘
```

---

## 2. Session Creation Flow (Detailed)

```
┌─────────────────────────────────────────────────────┐
│     createNewChat() Called                           │
│     (User clicks "New Chat" or Auto-Send)           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────┐
        │ Check creatingSessionRef     │
        │ Is creation in progress?     │
        └──────────────┬───────────────┘
                   ┌───┴────┐
                   │        │
                  Yes       No
                   │        │
                   ▼        ▼
        ┌──────────────┐  ┌────────────────────────────┐
        │ Return Early │  │ Set creatingSessionRef=true│
        │ (Debounce)  │  │ Begin creation process     │
        └──────────────┘  └────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │ Check for Existing          │
                        │ Untitled Chat Session       │
                        └────────────┬─────────────────┘
                              ┌─────┴────────┐
                              │              │
                           Found         Not Found
                              │              │
                              ▼              ▼
                    ┌─────────────────┐  ┌───────────────────┐
                    │ Switch to       │  │ Call API:         │
                    │ Existing Chat   │  │ createSession()   │
                    │ & Return        │  └───────────┬───────┘
                    └─────────────────┘              │
                                                     ▼
                                         ┌─────────────────────┐
                                         │ API Request:        │
                                         │ POST /chat/sessions │
                                         │ { title, model }    │
                                         └────────┬────────────┘
                                                  │
                                    ┌─────────────┴────────────┐
                                    │                          │
                                    ▼                          ▼
                                ┌────────┐          ┌──────────────┐
                                │ Success│          │ Error (500)  │
                                │ (200)  │          │              │
                                └───┬────┘          └─────┬────────┘
                                    │                     │
                                    ▼                     ▼
                            ┌──────────────┐    ┌─────────────────┐
                            │ Create       │    │ Show Toast Error│
                            │ ChatSession  │    │ Return null     │
                            │ from API     │    └─────────────────┘
                            │ Response     │
                            └───┬──────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ setActiveSession │
                        │ = newSession.id  │
                        └───┬──────────────┘
                            │
                            ▼
                        ┌──────────────────┐
                        │ setSessions      │
                        │ += newSession    │
                        └───┬──────────────┘
                            │
                            ▼
                        ┌──────────────────┐
                        │ Reset Flags:     │
                        │ shouldAutoSend=0 │
                        │ creating=false   │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Return newSession│
                        └──────────────────┘
```

---

## 3. Auto-Send Decision Tree

```
┌──────────────────────────────────────────┐
│     Auto-Send Effect Triggered           │
│     (URL has ?message= parameter)        │
└──────────────┬───────────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │ shouldAutoSend?     │
     └──┬──────────────────┘
        │
     ┌──┴──┐
    No   Yes
     │    │
     ▼    ▼
   Skip  ┌──────────────┐
        │ activeSession│
        │ ID exists?   │
        └──┬───────────┘
           │
        ┌──┴──┐
       No    Yes
        │     │
        ▼     ▼
       Need  ┌──────────────────┐
       To    │ Message text not │
       Create│ empty?           │
       Session│ (trim().length>0)│
             └──┬───────────────┘
                │
             ┌──┴──┐
            No    Yes
             │     │
             ▼     ▼
            Skip  ┌──────────────────┐
                 │ Model selected?  │
                 │ (selectedModel!=  │
                 │  null)           │
                 └──┬───────────────┘
                    │
                 ┌──┴──┐
                No    Yes
                 │     │
                 ▼     ▼
                Skip  ┌──────────────────┐
                     │ NOT Loading?     │
                     │ (loading==false) │
                     └──┬───────────────┘
                        │
                     ┌──┴──┐
                    No    Yes
                     │     │
                     ▼     ▼
                    Skip  ┌──────────────────┐
                         │ NOT Streaming?   │
                         │ (isStreaming==F) │
                         └──┬───────────────┘
                            │
                         ┌──┴──┐
                        No    Yes
                         │     │
                         ▼     ▼
                        Skip  ┌──────────────────┐
                             │ ALL CONDITIONS   │
                             │ MET!             │
                             │ handleSendMessage│
                             └──────────────────┘
```

---

## 4. Message Sending Flow

```
┌──────────────────────────────────────┐
│    handleSendMessage() Called         │
└──────────────┬───────────────────────┘
               │
               ▼
    ┌────────────────────────────┐
    │ Validate:                  │
    │ - Message exists           │
    │ - Session exists           │
    │ - Model exists             │
    │ - Has API key              │
    └────────────┬───────────────┘
                 │
              ┌──┴──────┐
           Valid    Invalid
             │         │
             │         ▼
             │    ┌──────────────┐
             │    │ Show Error   │
             │    │ Toast        │
             │    └──────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Add Message to Chat    │
    │ - User message appears │
    │ - Empty AI response    │
    │ - Start streaming flag │
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ Call Backend:              │
    │ POST /api/chat/completions │
    │ { messages, model, stream }│
    └────────────┬───────────────┘
                 │
              ┌──┴──────────────────┐
              │                     │
              ▼                     ▼
        ┌──────────────┐     ┌─────────────┐
        │ Streaming    │     │ Non-Streaming
        │ Response     │     │ Response    
        └──┬───────────┘     └──────┬──────┘
           │                        │
           ▼                        ▼
    ┌────────────────────┐  ┌──────────────┐
    │ Stream chunks as  │  │ Get full     │
    │ SSE (text/event-  │  │ response     │
    │ stream)           │  └──────┬───────┘
    │ Append to AI msg  │         │
    └────────┬───────────┘         ▼
             │              ┌────────────────┐
             │              │ Parse JSON     │
             │              │ response       │
             │              └────────┬───────┘
             │                       │
             └────────────┬──────────┘
                          │
                          ▼
                 ┌─────────────────────┐
                 │ Update Chat Message │
                 │ with AI Response    │
                 └─────────────────────┘
                          │
              ┌───────────┴──────────┐
              │                      │
              ▼                      ▼
        ┌──────────────┐    ┌──────────────┐
        │ Success:     │    │ Error:       │
        │ - Save to DB │    │ - Check type │
        │ - Show toast │    │ - Timeout?   │
        │ - Reset form │    │ - Rate limit?│
        │ - Reset flags│    │ - 500 error? │
        └──────────────┘    └──────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
            ┌──────────────────┐    ┌───────────────────┐
            │ Not 500/404      │    │ Is 500 or 404     │
            │ (timeout/rate)   │    │ (Model Failed)    │
            │ Show error & quit│    │ Attempt Fallback  │
            └──────────────────┘    └──────────┬────────┘
                                              │
                                   ┌──────────┴─────────┐
                                   │                    │
                                   ▼                    ▼
                            ┌────────────────┐  ┌─────────────┐
                            │ Already        │  │ First       │
                            │ Attempted?     │  │ Attempt:    │
                            │ (tracked via   │  │ Switch Model│
                            │  fallbackRef)  │  │ Retry       │
                            └────┬───────────┘  └─────────────┘
                                 │
                              ┌──┴──┐
                             Yes    No
                              │     │
                              ▼     ▼
                           Quit  Execute Fallback
```

---

## 5. Error Handling & Retry Logic

```
┌──────────────────────┐
│ Backend Request Sent │
└──────────────┬───────┘
               │
               ▼
    ┌──────────────────┐
    │ Response Received│
    │ or Error         │
    └──────────┬───────┘
               │
    ┌──────────┴────────────┐
    │                       │
    ▼                       ▼
┌────────┐          ┌──────────────┐
│Status  │          │ Error Type   │
│200/201 │          │ (catch block)│
└───┬────┘          └──────┬───────┘
    │                      │
    ▼                      ├─ Network Error
  Success              ├─ Timeout Error
                       ├─ AbortError
                       └─ Parse Error
                            │
                            ▼
                     ┌──────────────┐
                     │ Retry Logic: │
                     │ Max Retries=3│
                     │ Exponential  │
                     │ Backoff      │
                     └──────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
            ┌──────────┐      ┌───────────────┐
            │Retry <3? │      │ Retries >= 3? │
            └──┬───────┘      └───────────────┘
             ┌─┴─┐                    │
            Yes No                   ▼
             │   │            ┌──────────────┐
             ▼   ▼            │ Return Error │
          Retry Error         │ to Client    │
                              └──────────────┘

┌────────────────────────────────────┐
│ If 429 Rate Limit Error:           │
├────────────────────────────────────┤
│ 1. Parse Retry-After header        │
│ 2. Calculate backoff delay:        │
│    - Base: 1000ms                  │
│    - Multiplier: 2^retryCount      │
│    - Jitter: +0-500ms              │
│    - Max: 10000ms                  │
│ 3. Sleep for calculated time       │
│ 4. Retry request                   │
│ 5. If retries exhausted: Return429 │
└────────────────────────────────────┘
```

---

## 6. State Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                     Chat State Tree                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  sessions: ChatSession[]                                 │
│    ├─ id: string (api-XXX or local-XXX)                 │
│    ├─ title: string                                      │
│    ├─ messages: Message[]                                │
│    ├─ apiSessionId?: number                              │
│    ├─ createdAt: Date                                    │
│    └─ updatedAt: Date                                    │
│                                                           │
│  activeSessionId: string | null                          │
│    └─ References: sessions[?].id                         │
│                                                           │
│  selectedModel: ModelOption | null                       │
│    ├─ value: string (model ID)                          │
│    ├─ label: string                                      │
│    └─ category: string                                   │
│                                                           │
│  message: string                                         │
│    └─ Current user input in text field                   │
│                                                           │
│  loading: boolean                                        │
│    └─ True while creating session or sending message    │
│                                                           │
│  isStreamingResponse: boolean                            │
│    └─ True while streaming AI response                   │
│                                                           │
│  shouldAutoSend: boolean                                 │
│    └─ Set true if ?message= in URL                       │
│                                                           │
│  Refs (not state):                                       │
│    ├─ creatingSessionRef: boolean                        │
│    ├─ autoSendTriggeredRef: boolean                      │
│    ├─ userHasTypedRef: boolean                           │
│    └─ fallbackAttemptRef: {messageId, attempts}         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Effect Dependencies Flow

```
Effect Chain:
┌──────────────────────────────┐
│ useEffect 1: Load Sessions   │
│ Depends: []                  │
│ Triggers: On mount           │
└──────────┬───────────────────┘
           │
           ▼
    ┌─────────────┐
    │ sessions[]  │ Updated
    │ is set      │
    └──────┬──────┘
           │
           ▼
┌──────────────────────────────┐
│ useEffect 2: Auto-Send Check │
│ Depends: [shouldAutoSend,    │
│           activeSessionId,   │
│           message,           │
│           selectedModel,     │
│           loading,           │
│           isStreaming,       │
│           pendingMessage]    │
└──────────┬───────────────────┘
           │
       ┌───┴────┐
      Can    Cannot
      Auto-   Auto-
      Send    Send
       │         │
       ▼         ▼
    Send    Wait for
    Message  conditions
             to change
```

---

**Visual Format**: Mermaid  
**Last Updated**: 2025-01-17  
**Status**: Complete

