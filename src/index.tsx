import { createCliRenderer, RGBA, SyntaxStyle } from "@opentui/core";
import type { SelectOption } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TextareaRenderable } from "@opentui/core";
import { CollectionSidebar } from "./components/CollectionSidebar.js";
import { EnvironmentPicker } from "./components/EnvironmentPicker.js";
import { HistoryPicker } from "./components/HistoryPicker.js";
import * as store from "./store/index.js";
import type { CollectionRequest, AuthConfig } from "./store/types.js";

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

function nextAuthType(current: "bearer" | "basic" | "apikey" | null, dir: number): "bearer" | "basic" | "apikey" | null {
  const types: Array<"bearer" | "basic" | "apikey" | null> = [null, "bearer", "basic", "apikey"];
  const idx = types.indexOf(current);
  return types[(idx + dir + types.length) % types.length]!;
}

function authFieldCount(type: string | null): number {
  if (type === "bearer") return 1;
  if (type === "basic") return 2;
  if (type === "apikey") return 3;
  return 0;
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  null: "None",
  bearer: "Bearer Token",
  basic: "Basic Auth",
  apikey: "API Key",
};

function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [reqTab, setReqTab] = useState<"headers" | "body" | "auth">("headers");
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

  // Auth state
  const [authType, setAuthType] = useState<"bearer" | "basic" | "apikey" | null>(null);
  const [bearerToken, setBearerToken] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [apikeyKey, setApikeyKey] = useState("");
  const [apikeyValue, setApikeyValue] = useState("");
  const [apikeyIn, setApikeyIn] = useState<"header" | "query">("header");
  const [authFieldIdx, setAuthFieldIdx] = useState(0);

  // Environment state
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);

  // Overlay state
  const [overlayType, setOverlayType] = useState<"env" | "history" | null>(null);
  const [envItems, setEnvItems] = useState<Array<{ id: string | null; name: string }>>([]);
  const [envCursor, setEnvCursor] = useState(0);
  const [allHistory, setAllHistory] = useState<store.HistoryEntry[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyCursor, setHistoryCursor] = useState(0);
  const prevFocusRef = useRef(0);

  useEffect(() => {
    setCollections(store.listCollections());
    const config = store.loadConfig();
    if (config.activeEnvironment !== undefined) {
      setActiveEnvId(config.activeEnvironment);
    }
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

  const filteredHistory = useMemo(() => {
    if (!historyQuery) return allHistory;
    const q = historyQuery.toLowerCase();
    return allHistory.filter(
      (e) => e.method.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
    );
  }, [allHistory, historyQuery]);

  const toggleExpand = useCallback((collectionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlayType(null);
    setFocusIdx(prevFocusRef.current);
  }, []);

  const openEnvPicker = useCallback(() => {
    prevFocusRef.current = focusIdx;
    const envs = store.listEnvironments();
    const items = [{ id: null, name: "None (globals only)" }];
    for (const env of envs) {
      items.push({ id: env.id, name: env.name });
    }
    setEnvItems(items);
    setEnvCursor(0);
    setOverlayType("env");
  }, [focusIdx]);

  const openHistoryPicker = useCallback(() => {
    prevFocusRef.current = focusIdx;
    const entries = store.loadAllHistory();
    setAllHistory(entries.reverse());
    setHistoryQuery("");
    setHistoryCursor(0);
    setOverlayType("history");
  }, [focusIdx]);

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

    const auth: AuthConfig | undefined = authType === null ? undefined : {
      type: authType,
      ...(authType === "bearer" ? { bearerToken } : {}),
      ...(authType === "basic" ? { basicUsername, basicPassword } : {}),
      ...(authType === "apikey" ? { apikeyKey, apikeyValue, apikeyIn } : {}),
    };

    collection.requests[idx] = {
      id: req.id,
      name: req.name,
      method,
      url,
      headers: parsedHeaders,
      body: body || null,
      auth,
    };

    store.saveCollection(collection);
    setCollections(store.listCollections());
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [activeCollectionId, activeRequestId, method, url, headers, body, authType, bearerToken, basicUsername, basicPassword, apikeyKey, apikeyValue, apikeyIn]);

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

      // Resolve variables
      const globals = store.loadGlobals();
      const envVars = activeEnvId ? (store.loadEnvironment(activeEnvId)?.variables ?? {}) : {};

      const resolve = (text: string) => store.resolveVariables(text, globals, envVars);
      const resolvedUrl = resolve(url);
      const resolvedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsedHeaders)) {
        resolvedHeaders[k] = resolve(v);
      }
      const resolvedBody = body ? resolve(body) : null;

      // Apply auth
      let finalUrl = resolvedUrl;
      const headersWithAuth = { ...resolvedHeaders };

      const collection = activeCollectionId ? store.loadCollection(activeCollectionId) : null;

      const requestAuth: AuthConfig | undefined = authType === null ? undefined : {
        type: authType,
        ...(authType === "bearer" ? { bearerToken } : {}),
        ...(authType === "basic" ? { basicUsername, basicPassword } : {}),
        ...(authType === "apikey" ? { apikeyKey, apikeyValue, apikeyIn } : {}),
      };

      const effectiveAuth = store.getEffectiveAuth(requestAuth, collection?.auth);

      if (effectiveAuth && effectiveAuth.type) {
        switch (effectiveAuth.type) {
          case "bearer":
            headersWithAuth["Authorization"] = `Bearer ${effectiveAuth.bearerToken}`;
            break;
          case "basic":
            headersWithAuth["Authorization"] = `Basic ${btoa(`${effectiveAuth.basicUsername}:${effectiveAuth.basicPassword}`)}`;
            break;
          case "apikey":
            if (effectiveAuth.apikeyIn === "header") {
              headersWithAuth[effectiveAuth.apikeyKey!] = effectiveAuth.apikeyValue!;
            } else {
              const separator = finalUrl.includes("?") ? "&" : "?";
              finalUrl = `${finalUrl}${separator}${encodeURIComponent(effectiveAuth.apikeyKey!)}${encodeURIComponent(effectiveAuth.apikeyValue!)}`;
            }
            break;
        }
      }

      const reqInit: RequestInit = {
        method,
        headers: headersWithAuth,
      };

      if (method !== "GET" && method !== "HEAD") {
        reqInit.body = resolvedBody;
      }

      const res = await fetch(finalUrl, reqInit);
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
  }, [url, method, headers, body, activeEnvId, activeCollectionId, authType, bearerToken, basicUsername, basicPassword, apikeyKey, apikeyValue, apikeyIn]);

  const loadRequest = useCallback((collectionId: string, request: CollectionRequest) => {
    setActiveCollectionId(collectionId);
    setActiveRequestId(request.id);
    setMethod(request.method);
    setUrl(request.url);
    setHeaders(JSON.stringify(request.headers, null, 2));
    setBody(request.body ?? "");

    const auth = request.auth;
    if (auth && auth.type) {
      setAuthType(auth.type);
      setBearerToken(auth.bearerToken ?? "");
      setBasicUsername(auth.basicUsername ?? "");
      setBasicPassword(auth.basicPassword ?? "");
      setApikeyKey(auth.apikeyKey ?? "");
      setApikeyValue(auth.apikeyValue ?? "");
      setApikeyIn(auth.apikeyIn ?? "header");
    } else {
      setAuthType(null);
      setBearerToken("");
      setBasicUsername("");
      setBasicPassword("");
      setApikeyKey("");
      setApikeyValue("");
      setApikeyIn("header");
    }

    setFocusIdx(1);
  }, []);

  useKeyboard((key) => {
    // Overlay handlers (highest priority)
    if (overlayType === "env") {
      if (key.name === "escape") { closeOverlay(); return; }
      if (key.name === "up") { setEnvCursor((c) => Math.max(0, c - 1)); return; }
      if (key.name === "down") { setEnvCursor((c) => Math.min(envItems.length - 1, c + 1)); return; }
      if (key.name === "enter" || key.name === "return") {
        const selected = envItems[envCursor];
        if (selected) {
          setActiveEnvId(selected.id);
          store.saveConfig({ activeEnvironment: selected.id, activeCollection: activeCollectionId });
        }
        closeOverlay();
        return;
      }
      return;
    }

    if (overlayType === "history") {
      if (key.name === "escape") { closeOverlay(); return; }
      if (key.name === "up") { setHistoryCursor((c) => Math.max(0, c - 1)); return; }
      if (key.name === "down") { setHistoryCursor((c) => Math.min(filteredHistory.length - 1, c + 1)); return; }
      if (key.name === "enter" || key.name === "return") {
        const selected = filteredHistory[historyCursor];
        if (selected) {
          setMethod(selected.method);
          setUrl(selected.url);
          setHeaders(JSON.stringify(selected.headers, null, 2));
          setBody(selected.body ?? "");
          setActiveCollectionId(null);
          setActiveRequestId(null);
          setAuthType(null);
          setBearerToken("");
          setBasicUsername("");
          setBasicPassword("");
          setApikeyKey("");
          setApikeyValue("");
          setApikeyIn("header");
        }
        closeOverlay();
        setFocusIdx(2);
        return;
      }
      return;
    }

    // Ctrl+ shortcuts
    if (key.ctrl) {
      if (key.name === "p") { doRequest(); return; }
      if (key.name === "s") { saveCurrentRequest(); return; }
      if (key.name === "h") { setReqTab("headers"); setFocusIdx(3); return; }
      if (key.name === "b") { setReqTab("body"); setFocusIdx(3); return; }
      if (key.name === "a") { setReqTab("auth"); setFocusIdx(3); setAuthFieldIdx(0); return; }
      if (key.name === "e") {
        if (overlayType === "env") { closeOverlay(); } else { openEnvPicker(); }
        return;
      }
      if (key.name === "r") {
        if (overlayType === "history") { closeOverlay(); } else { openHistoryPicker(); }
        return;
      }
      if (key.name === "c") { process.exit(0); return; }
    }

    // Auth tab field navigation
    if (focusIdx === 3 && reqTab === "auth") {
      const fieldCount = authFieldCount(authType);

      if (key.name === "tab" && !key.shift) {
        if (fieldCount > 0) { setAuthFieldIdx((i) => (i + 1) % (fieldCount + 1)); }
        return;
      }
      if (key.name === "tab" && key.shift) {
        if (fieldCount > 0) { setAuthFieldIdx((i) => (i - 1 + fieldCount + 1) % (fieldCount + 1)); }
        return;
      }
      if (key.name === "up") {
        if (authFieldIdx === 0) {
          setAuthType((prev) => nextAuthType(prev, -1));
        } else {
          setAuthFieldIdx((i) => i - 1);
        }
        return;
      }
      if (key.name === "down") {
        if (authFieldIdx >= fieldCount) {
          setAuthType((prev) => nextAuthType(prev, 1));
        } else {
          setAuthFieldIdx((i) => i + 1);
        }
        return;
      }
      if (authFieldIdx === 0) {
        if (key.name === "left" || key.name === "right") {
          setAuthType((prev) => nextAuthType(prev, key.name === "left" ? -1 : 1));
          return;
        }
      }
      if (authType === "apikey" && authFieldIdx === 3) {
        if (key.name === "left" || key.name === "right") {
          setApikeyIn((prev) => prev === "header" ? "query" : "header");
          return;
        }
      }
      return;
    }

    // Tab cycling for non-auth panels
    if (key.name === "tab" && key.shift) {
      setFocusIdx((i) => (i - 1 + 5) % 5);
      return;
    }
    if (key.name === "tab") {
      setFocusIdx((i) => (i + 1) % 5);
      return;
    }

    // Sidebar navigation
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

    // Method selector
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
  });

  return (
    <box flexDirection="row" style={{ flexGrow: 1, backgroundColor: "#1e1e1e" }}>
      {overlayType ? (
        <box style={{ flexGrow: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1e1e1e" }}>
          {overlayType === "env" ? (
            <EnvironmentPicker items={envItems} cursor={envCursor} activeEnvId={activeEnvId} />
          ) : (
            <HistoryPicker entries={filteredHistory} query={historyQuery} cursor={historyCursor} onQueryInput={setHistoryQuery} />
          )}
        </box>
      ) : (
        <>
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
              <text style={{ fg: reqTab === "auth" ? "#ffff00" : "#aaaaaa" }}>Auth (Ctrl+A)</text>
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
              ) : reqTab === "body" ? (
                <textarea
                  key={`body-${activeRequestId}`}
                  ref={bodyRef}
                  focused={focusIdx === 3}
                  initialValue={body}
                  placeholder="Request Body..."
                  onContentChange={() => setBody(bodyRef.current?.plainText || "")}
                />
              ) : (
                <box flexDirection="column" style={{ padding: 1 }}>
                  <box style={{ height: 1 }}>
                    <text style={{ fg: authFieldIdx === 0 ? "#ffff00" : "#aaaaaa" }}>
                      Type: {AUTH_TYPE_LABELS[String(authType)]} {authFieldIdx === 0 ? "▲▼" : ""}
                    </text>
                  </box>
                  {authType === "bearer" && (
                    <box style={{ height: 1 }}>
                      <text style={{ fg: "#aaaaaa" }}>Token: </text>
                      <box style={{ flexGrow: 1 }}>
                        <input
                          key="auth-bearer-token"
                          value={bearerToken}
                          focused={authFieldIdx === 1}
                          placeholder="Enter Bearer token"
                          onInput={setBearerToken}
                        />
                      </box>
                    </box>
                  )}
                  {authType === "basic" && (
                    <>
                      <box style={{ height: 1 }}>
                        <text style={{ fg: "#aaaaaa" }}>Username: </text>
                        <box style={{ flexGrow: 1 }}>
                          <input
                            key="auth-basic-user"
                            value={basicUsername}
                            focused={authFieldIdx === 1}
                            placeholder="Username"
                            onInput={setBasicUsername}
                          />
                        </box>
                      </box>
                      <box style={{ height: 1 }}>
                        <text style={{ fg: "#aaaaaa" }}>Password: </text>
                        <box style={{ flexGrow: 1 }}>
                          <input
                            key="auth-basic-pass"
                            value={basicPassword}
                            focused={authFieldIdx === 2}
                            placeholder="Password"
                            onInput={setBasicPassword}
                          />
                        </box>
                      </box>
                    </>
                  )}
                  {authType === "apikey" && (
                    <>
                      <box style={{ height: 1 }}>
                        <text style={{ fg: "#aaaaaa" }}>Key: </text>
                        <box style={{ flexGrow: 1 }}>
                          <input
                            key="auth-apikey-key"
                            value={apikeyKey}
                            focused={authFieldIdx === 1}
                            placeholder="Key name (e.g. X-API-Key)"
                            onInput={setApikeyKey}
                          />
                        </box>
                      </box>
                      <box style={{ height: 1 }}>
                        <text style={{ fg: "#aaaaaa" }}>Value: </text>
                        <box style={{ flexGrow: 1 }}>
                          <input
                            key="auth-apikey-value"
                            value={apikeyValue}
                            focused={authFieldIdx === 2}
                            placeholder="API key value"
                            onInput={setApikeyValue}
                          />
                        </box>
                      </box>
                      <box style={{ height: 1 }}>
                        <text style={{ fg: authFieldIdx === 3 ? "#ffff00" : "#aaaaaa" }}>
                          In: {apikeyIn} {authFieldIdx === 3 ? "▲▼" : ""}
                        </text>
                      </box>
                    </>
                  )}
                  {authType === null && (
                    <box style={{ height: 1 }}>
                      <text style={{ fg: "#888888" }}>No authentication configured.</text>
                    </box>
                  )}
                </box>
              )}
            </box>

            <box flexDirection="row" style={{ height: 1, marginBottom: 1, gap: 2 }}>
              <text style={{ fg: "#00ff00" }}>Response Status: {status !== null ? status : "N/A"}</text>
              <text style={{ fg: "#00ffff" }}>Time: {latency !== null ? `${latency}ms` : "N/A"}</text>
              {saveStatus === "saved" && <text style={{ fg: "#00ff00" }}>Saved!</text>}
              <text style={{ fg: "#aaaaaa" }}>Ctrl+P Send | Ctrl+S Save | Ctrl+E Env | Ctrl+R History | Tab Focus</text>
            </box>

            <box style={{ flexGrow: 1, border: true, borderColor: focusIdx === 4 ? "#ffff00" : "#555" }}>
              <scrollbox focused={focusIdx === 4} style={{ width: "100%", height: "100%" }}>
                <code content={response} filetype="json" syntaxStyle={syntaxStyle} width="100%" height="100%" />
              </scrollbox>
            </box>
          </box>
        </>
      )}
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
