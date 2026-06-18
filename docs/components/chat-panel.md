# ChatPanel

`src/components/dashboard/ChatPanel.tsx`

**Purpose:** In-game chat interface — read messages from the game and send messages back.

### Props

```typescript
interface Props {
  config: FRMConfig;
}
```

### Data Sources

| Endpoint                 | Type            | Purpose                                |
| ------------------------ | --------------- | -------------------------------------- |
| `getChatMessages`        | `ChatMessage[]` | Chat message history (polled every 3s) |
| `sendChatMessage` (POST) | `void`          | Sends a message into the game          |

### Features

**Message List:**

- Auto-scrolls to bottom on new messages
- Each message shows:
  - **Player name** (bold)
  - **Message text**
  - **Timestamp** (HH:MM format)
- **"You" messages:** Right-aligned with accent highlight
- **Other players:** Left-aligned with info color

**Message Input:**

- Textarea at the bottom
- **Enter** = send
- **Shift+Enter** = newline
- Disabled while sending

**Live Polling:**

- Fetches messages every **3 seconds** (hardcoded, independent of `config.refreshRate`)
- Sends via `sendChatMessage(config, message)` which POSTs to FRM

### Edge Cases

- **Chat endpoint not available:** Shows "Chat not available" message.
- **Empty message:** Send button disabled.
- **Send failure:** Error shown inline, message preserved in input.
- **Long messages:** Textarea grows, messages wrap.
