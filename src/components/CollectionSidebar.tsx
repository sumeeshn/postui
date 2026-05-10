import type { Collection, CollectionRequest } from "../store/types.js";

interface SidebarItem {
  type: "collection" | "request";
  collectionId: string;
  request?: CollectionRequest;
}

interface CollectionSidebarProps {
  collections: Collection[];
  activeCollectionId: string | null;
  activeRequestId: string | null;
  focused: boolean;
  items: SidebarItem[];
  cursor: number;
  expanded: Set<string>;
}

export function CollectionSidebar({
  collections,
  activeCollectionId,
  activeRequestId,
  focused,
  items,
  cursor,
  expanded,
}: CollectionSidebarProps) {
  if (collections.length === 0) {
    return (
      <box style={{ width: "25%", border: true, borderColor: focused ? "#ffff00" : "#555", flexDirection: "column" }}>
        <text style={{ fg: "#888", padding: 1 }}>No collections yet</text>
      </box>
    );
  }

  return (
    <box style={{ width: "25%", border: true, borderColor: focused ? "#ffff00" : "#555", flexDirection: "column" }}>
      <box style={{ height: 1 }}>
        <text style={{ fg: "#ffff00", paddingX: 1 }}>Collections</text>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        {items.map((item, i) => {
          const isActive =
            (item.type === "request" && item.request?.id === activeRequestId) ||
            (item.type === "collection" && item.collectionId === activeCollectionId);
          const indent = item.type === "request" ? "  " : "";
          const icon =
            item.type === "collection"
              ? expanded.has(item.collectionId)
                ? "▼ "
                : "▶ "
              : `${item.request?.method} `;
          const fg = isActive ? "#00ff00" : i === cursor ? "#ffffff" : "#aaaaaa";
          const name =
            item.type === "collection"
              ? collections.find((c) => c.id === item.collectionId)?.name
              : item.request?.name;
          return (
            <box key={`${item.collectionId}-${item.request?.id ?? "col"}`} style={{ height: 1 }}>
              <text style={{ fg, paddingX: 1 }}>
                {indent}
                {icon}
                {name}
              </text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
