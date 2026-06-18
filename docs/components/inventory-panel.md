# InventoryPanel

`src/components/dashboard/InventoryPanel.tsx`

**Purpose:** Global inventory tracker — world totals, per-container storage, and dimensional depot items.

### Props

```typescript
interface Props {
  config: FRMConfig;
  settings: AppSettings;
}
```

### Data Sources

| Endpoint        | Type                 | Purpose                             |
| --------------- | -------------------- | ----------------------------------- |
| `getWorldInv`   | `WorldInvItem[]`     | Aggregated total across all storage |
| `getStorageInv` | `StorageContainer[]` | Per-container inventories           |
| `getCloudInv`   | `CloudInvItem[]`     | Dimensional Depot items             |

### Features

**Summary Cards (4 metrics):**

- **World Items** — total unique item types across all storage
- **Containers** — number of storage containers
- **Dimensional Depot** — cloud inventory item count
- **Total Stored** — sum of all `Amount` values

**View Tabs:**

- **World Inventory** — aggregated view sorted by amount (descending)
  - Searchable by item name or `ClassName`
  - Each item shows: icon, name, amount, max amount, fill %
- **Storage Containers** — expandable list by container ID
  - Each container shows location coordinates
  - Expanded view lists all contained items
- **Cloud Inventory** — Dimensional Depot aggregated view (same layout as World)

### Internal Components

- `ItemIcon` — lazy-loads icon PNG with fallback badge
- `FillBar` — visual fill percentage bar:
  - Red: >95% (nearly full)
  - Amber: 70–95%
  - Blue: <70%
- `SummaryCard` — metric card with label, value, and optional subtitle

### Edge Cases

- **No storage containers:** World Inventory still shows (based on world-wide totals).
- **Empty container:** Expanded view says "Empty."
- **Icon missing:** Falls back to colored badge with first letter.
- **Dimensional Depot not unlocked:** Cloud tab shows "Not available" message.
