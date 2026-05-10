import { createCliRenderer, RGBA, SyntaxStyle } from "@opentui/core";
import type { SelectOption } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TextareaRenderable } from "@opentui/core";
import { CollectionSidebar } from "./components/CollectionSidebar.js";
import * as store from "./store/index.js";
import type { CollectionRequest } from "./store/types.js";

const HTTP_METHODS: SelectOption[] = [
  { name: "GET", value: "GET", description: "" },
  { name: "POST", value: "POST", description: "" },
  { name: "PUT", value: "PUT", description: "" },
  { name: "DELETE", value: "DELETE", description: "" },
  { name: "PATCH", value: "PATCH", description: "" },
];

const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#C792EA") },
  string: { fg: RGBA.fromHex("#C3E88D") },
  number: { fg: RGBA.fromHex("#F78C6C") },
  default: { fg: RGBA.fromHex("#A6ACCD") },
});

interface SidebarItem {
  type: "collection" | "request";
  collectionId: string;
  request?: CollectionRequest;
}

function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [reqTab, setReqTab] = useState<"headers" | "body">("headers");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");

  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const [collections, setCollections] = useState<store.Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sidebarCursor, setSidebarCursor] = useState(0);

  const headersRef = useRef<TextareaRenderable>(null);
  const bodyRef = useRef<TextareaRenderable>(null);

  const [focusIdx, setFocusIdx] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | null>(null);

  useEffect(() => {
    setCollections(store.listCollections());
  }, []);

  const sidebarItems = useMemo((): SidebarItem[] => {
    const items: SidebarItem[] = [];
    for (const col of collections) {
      items.push({ type: "collection", collectionId: col.id });
      if (expanded.has(col.id)) {
        for (const req of col.requests) {
          items.push({ type: "request", collectionId: col.id, request: req });
        }
      }
    }
    return items;
  }, [collections, expanded]);

  const toggleExpand = useCallback((collectionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }, []);

  const saveCurrentRequest = useCallback(() => {
    if (!activeCollectionId || !activeRequestId) {
      setSaveStatus(null);
      return;
    }
    const collection = store.loadCollection(activeCollectionId);
    if (!collection) return;

    let parsedHeaders: Record<string, string> = {};
    if (headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch {
        setSaveStatus(null);
        return;
      }
    }

    const idx = collection.requests.findIndex((r) => r.id === activeRequestId);
    if (idx === -1) return;
    const req = collection.requests[idx]!;
    collection.requests[idx] = {
      id: req.id,
      name: req.name,
      method,
      url,
      headers: parsedHeaders,
      body: body || null,
    };

    store.saveCollection(collection);
    setCollections(store.listCollections());
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [activeCollectionId, activeRequestId, method, url, headers, body]);

  const doRequest = useCallback(async () => {
    try {
      const startTime = performance.now();

      let parsedHeaders: Record<string, string> = {};
      if (headers.trim()) {
        try {
          parsedHeaders = JSON.parse(headers);
        } catch (e) {
          setResponse("Error parsing headers as JSON.");
          setStatus(null);
          return;
        }
      }

      const reqInit: RequestInit = {
        method,
        headers: parsedHeaders,
      };

      if (method !== "GET" && method !== "HEAD") {
        reqInit.body = body;
      }

      const res = await fetch(url, reqInit);
      const resText = await res.text();
      const endTime = performance.now();

      let formattedRes = resText;
      try {
        const json = JSON.parse(resText);
        formattedRes = JSON.stringify(json, null, 2);
      } catch (e) {
        // Not json, keep text
      }

      setResponse(formattedRes);
      setStatus(res.status);
      setLatency(Math.round(endTime - startTime));

      store.appendHistory({
        timestamp: new Date().toISOString(),
        method,
        url,
        headers: parsedHeaders,
        body: body || null,
        status: res.status,
        latency: Math.round(endTime - startTime),
      });
    } catch (e: any) {
      setResponse(`Request failed: ${e.message}`);
      setStatus(null);
      setLatency(null);
    }
  }, [url, method, headers, body]);

  const loadRequest = useCallback((collectionId: string, request: CollectionRequest) => {
    setActiveCollectionId(collectionId);
    setActiveRequestId(request.id);
    setMethod(request.method);
    setUrl(request.url);
    setHeaders(JSON.stringify(request.headers, null, 2));
    setBody(request.body ?? "");
    setFocusIdx(1);
  }, []);

  useKeyboard((key) => {
    if (key.name === "tab" && key.shift) {
      setFocusIdx((i) => (i - 1 + 5) % 5);
    } else if (key.name === "tab") {
      setFocusIdx((i) => (i + 1) % 5);
    }

    if (focusIdx === 0) {
      if (key.name === "up") {
        setSidebarCursor((c) => Math.max(0, c - 1));
      } else if (key.name === "down") {
        setSidebarCursor((c) => Math.min(sidebarItems.length - 1, c + 1));
      } else if (key.name === "return" || key.name === "enter") {
        const item = sidebarItems[sidebarCursor];
        if (!item) return;
        if (item.type === "collection") {
          toggleExpand(item.collectionId);
        } else if (item.request) {
          loadRequest(item.collectionId, item.request);
        }
      } else if (key.name === "right") {
        const item = sidebarItems[sidebarCursor];
        if (item?.type === "collection" && !expanded.has(item.collectionId)) {
          toggleExpand(item.collectionId);
        }
      } else if (key.name === "left") {
        const item = sidebarItems[sidebarCursor];
        if (item?.type === "collection" && expanded.has(item.collectionId)) {
          toggleExpand(item.collectionId);
        }
      }
      return;
    }

    if (focusIdx === 1) {
      if (key.name === "up" || key.name === "left") {
        setMethod((prev) => {
          const idx = HTTP_METHODS.findIndex((m) => m.value === prev);
          return HTTP_METHODS[(idx - 1 + HTTP_METHODS.length) % HTTP_METHODS.length]!.value;
        });
      }
      if (key.name === "down" || key.name === "right") {
        setMethod((prev) => {
          const idx = HTTP_METHODS.findIndex((m) => m.value === prev);
          return HTTP_METHODS[(idx + 1) % HTTP_METHODS.length]!.value;
        });
      }
    }

    if (key.ctrl && key.name === "p") {
      doRequest();
    }
    if (key.ctrl && key.name === "s") {
      saveCurrentRequest();
    }
    if (key.ctrl && key.name === "h") {
      setReqTab("headers");
      setFocusIdx(3);
    }
    if (key.ctrl && key.name === "b") {
      setReqTab("body");
      setFocusIdx(3);
    }
    if (key.ctrl && key.name === "c") {
      process.exit(0);
    }
  });

  return (
    <box flexDirection="row" style={{ flexGrow: 1, backgroundColor: "#1e1e1e" }}>
      <CollectionSidebar
        collections={collections}
        activeCollectionId={activeCollectionId}
        activeRequestId={activeRequestId}
        focused={focusIdx === 0}
        items={sidebarItems}
        cursor={sidebarCursor}
        expanded={expanded}
      />
      <box flexDirection="column" style={{ flexGrow: 1, padding: 1 }}>
        <box flexDirection="row" style={{ height: 3, marginBottom: 1 }}>
          <box style={{ width: 15, border: true, borderColor: focusIdx === 1 ? "#ffff00" : "#555", alignItems: "center", justifyContent: "center" }}>
            <text style={{ fg: focusIdx === 1 ? "#ffff00" : "#ffffff" }}>
              {focusIdx === 1 ? <strong>{method} ▲▼</strong> : `${method} ▲▼`}
            </text>
          </box>
          <box style={{ flexGrow: 1, border: true, borderColor: focusIdx === 2 ? "#ffff00" : "#555" }}>
            <input
              key={`url-${activeRequestId}`}
              value={url}
              focused={focusIdx === 2}
              placeholder="Enter request URL (e.g., https://jsonplaceholder.typicode.com/posts/1)"
              onInput={setUrl}
              onSubmit={doRequest}
            />
          </box>
        </box>

        <box flexDirection="row" style={{ height: 1, marginBottom: 1, gap: 2 }}>
          <text style={{ fg: reqTab === "headers" ? "#ffff00" : "#aaaaaa" }}>Headers (Ctrl+H)</text>
          <text style={{ fg: reqTab === "body" ? "#ffff00" : "#aaaaaa" }}>Body (Ctrl+B)</text>
        </box>

        <box style={{ height: 10, border: true, borderColor: focusIdx === 3 ? "#ffff00" : "#555", marginBottom: 1 }}>
          {reqTab === "headers" ? (
            <textarea
              key={`headers-${activeRequestId}`}
              ref={headersRef}
              focused={focusIdx === 3}
              initialValue={headers}
              placeholder="Headers in JSON format e.g. { \u0022Content-Type\u0022: \u0022application/json\u0022 }"
              onContentChange={() => setHeaders(headersRef.current?.plainText || "")}
            />
          ) : (
            <textarea
              key={`body-${activeRequestId}`}
              ref={bodyRef}
              focused={focusIdx === 3}
              initialValue={body}
              placeholder="Request Body..."
              onContentChange={() => setBody(bodyRef.current?.plainText || "")}
            />
          )}
        </box>

        <box flexDirection="row" style={{ height: 1, marginBottom: 1, gap: 2 }}>
          <text style={{ fg: "#00ff00" }}>Response Status: {status !== null ? status : "N/A"}</text>
          <text style={{ fg: "#00ffff" }}>Time: {latency !== null ? `${latency}ms` : "N/A"}</text>
          {saveStatus === "saved" && <text style={{ fg: "#00ff00" }}>Saved!</text>}
          <text style={{ fg: "#aaaaaa" }}>Ctrl+P Send | Ctrl+S Save | Tab Focus</text>
        </box>

        <box style={{ flexGrow: 1, border: true, borderColor: focusIdx === 4 ? "#ffff00" : "#555" }}>
          <scrollbox focused={focusIdx === 4} style={{ width: "100%", height: "100%" }}>
            <code content={response} filetype="json" syntaxStyle={syntaxStyle} width="100%" height="100%" />
          </scrollbox>
        </box>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
