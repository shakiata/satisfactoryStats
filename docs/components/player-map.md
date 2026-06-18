# PlayerMap

`src/components/dashboard/PlayerMap.tsx`

**Purpose:** Shows all online players with their coordinates and rotation.

### Props

```typescript
interface Props {
  config: FRMConfig;
}
```

### Data Sources

| Endpoint    | Type       | Purpose                   |
| ----------- | ---------- | ------------------------- |
| `getPlayer` | `Player[]` | Player info and locations |

### Features

**Online Count:**

- Shows number of players currently in the game.

**Player Cards:**
Each player rendered as a card with:

- **Avatar:** Colored circle with player name initial
- **Player ID:** Truncated for display
- **Location box:** X, Y, Z coordinates in Unreal cm
- **Rotation:** Shown if available

### Edge Cases

- **Single player (just you):** Shows one card.
- **No player data:** Shows "No players online."
- **Missing rotation:** Rotation field simply not rendered.
