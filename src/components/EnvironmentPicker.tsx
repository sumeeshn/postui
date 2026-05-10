interface EnvItem {
  id: string | null;
  name: string;
}

interface EnvironmentPickerProps {
  items: EnvItem[];
  cursor: number;
  activeEnvId: string | null;
}

export function EnvironmentPicker({ items, cursor, activeEnvId }: EnvironmentPickerProps) {
  return (
    <box style={{ width: "50%", height: "60%", border: true, borderColor: "#ffff00", flexDirection: "column", backgroundColor: "#252526" }}>
      <box style={{ height: 1 }}>
        <text style={{ fg: "#ffff00", paddingX: 1 }}>Environment Picker - Ctrl+E (Esc to close)</text>
      </box>
      <box style={{ height: 1, marginBottom: 1 }}>
        <text style={{ fg: "#888888", paddingX: 1 }}>Select an environment (arrow keys to navigate, Enter to confirm)</text>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        {items.map((item, i) => {
          const active = item.id === activeEnvId;
          const fg = active ? "#00ff00" : i === cursor ? "#ffffff" : "#aaaaaa";
          const prefix = active ? "▶ " : "  ";
          return (
            <box key={item.id ?? "__none__"} style={{ height: 1 }}>
              <text style={{ fg, paddingX: 1 }}>{prefix}{item.name}</text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
