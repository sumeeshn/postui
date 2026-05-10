import type { HistoryEntry } from "../store/types.js";

interface HistoryPickerProps {
  entries: HistoryEntry[];
  query: string;
  cursor: number;
  onQueryInput: (value: string) => void;
}

export function HistoryPicker({ entries, query, cursor, onQueryInput }: HistoryPickerProps) {
  return (
    <box style={{ width: "80%", height: "70%", border: true, borderColor: "#ffff00", flexDirection: "column", backgroundColor: "#252526" }}>
      <box style={{ height: 1 }}>
        <text style={{ fg: "#ffff00", paddingX: 1 }}>History - Ctrl+R (Esc to close)</text>
      </box>
      <box style={{ height: 1, marginBottom: 1 }}>
        <input
          key="history-search"
          value={query}
          focused={true}
          placeholder="Fuzzy search history..."
          onInput={onQueryInput}
        />
      </box>
      <box style={{ height: 1, marginBottom: 1 }}>
        <text style={{ fg: "#888888", paddingX: 1 }}>{entries.length} entries (↑↓ navigate, Enter load, Esc close)</text>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        {entries.length === 0 ? (
          <box style={{ height: 1 }}>
            <text style={{ fg: "#888888", paddingX: 1 }}>No history entries found.</text>
          </box>
        ) : (
          entries.map((entry, i) => {
            const fg = i === cursor ? "#ffffff" : "#aaaaaa";
            const statusColor = entry.status !== null && entry.status < 400 ? "#00ff00" : "#ff5555";
            const methodLen = entry.method.length;
            const methodPad = entry.method.padEnd(7);
            return (
              <box key={`h-${entry.timestamp}-${i}`} style={{ height: 1 }}>
                <text style={{ fg, paddingX: 1 }}>
                  <text style={{ fg: "#c792ea" }}>{methodPad}</text>
                  <text style={{ fg: statusColor }}>{entry.status ?? "ERR".padEnd(4)}</text>{' '}
                  <text style={{ fg: "#00ffff" }}>{(entry.latency ?? 0).toString().padStart(5)}ms</text>{' '}
                  <text style={{ fg }}>{entry.url}</text>
                </text>
              </box>
            );
          })
        )}
      </box>
    </box>
  );
}
