import { createCliRenderer, RGBA, SyntaxStyle } from "@opentui/core";
import type { SelectOption } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { useState, useCallback, useRef } from "react";
import type { TextareaRenderable } from "@opentui/core";

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

function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [reqTab, setReqTab] = useState<"headers" | "body">("headers");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");

  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const headersRef = useRef<TextareaRenderable>(null);
  const bodyRef = useRef<TextareaRenderable>(null);
  
  // Focus Index: 0 = Method, 1 = URL, 2 = ReqArea, 3 = ResArea
  const [focusIdx, setFocusIdx] = useState(1);

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
    } catch (e: any) {
      setResponse(`Request failed: ${e.message}`);
      setStatus(null);
      setLatency(null);
    }
  }, [url, method, headers, body]);

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocusIdx((i) => (i + 1) % 4);
    }
    
    // Handle Method Cycle when focusIdx === 0
    if (focusIdx === 0) {
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
    if (key.ctrl && key.name === "h") {
      setReqTab("headers");
      setFocusIdx(2);
    }
    if (key.ctrl && key.name === "b") {
      setReqTab("body");
      setFocusIdx(2);
    }
    if (key.ctrl && key.name === "c") {
      process.exit(0);
    }
  });

  return (
    <box flexDirection="column" style={{ flexGrow: 1, padding: 1, backgroundColor: "#1e1e1e" }}>
      {/* Top Bar */}
      <box flexDirection="row" style={{ height: 3, marginBottom: 1 }}>
        <box style={{ width: 15, border: true, borderColor: focusIdx === 0 ? "#ffff00" : "#555", alignItems: "center", justifyContent: "center" }}>
          <text style={{ fg: focusIdx === 0 ? "#ffff00" : "#ffffff" }}>
            {focusIdx === 0 ? <strong>{method} ▲▼</strong> : `${method} ▲▼`}
          </text>
        </box>
        <box style={{ flexGrow: 1, border: true, borderColor: focusIdx === 1 ? "#ffff00" : "#555" }}>
          <input 
            focused={focusIdx === 1} 
            placeholder="Enter request URL (e.g., https://jsonplaceholder.typicode.com/posts/1)" 
            onInput={setUrl} 
            onSubmit={doRequest} 
          />
        </box>
      </box>

      {/* Tabs */}
      <box flexDirection="row" style={{ height: 1, marginBottom: 1, gap: 2 }}>
        <text style={{ fg: reqTab === "headers" ? "#ffff00" : "#aaaaaa" }}>Headers (Ctrl+H)</text>
        <text style={{ fg: reqTab === "body" ? "#ffff00" : "#aaaaaa" }}>Body (Ctrl+B)</text>
      </box>

      {/* Req Area */}
      <box style={{ height: 10, border: true, borderColor: focusIdx === 2 ? "#ffff00" : "#555", marginBottom: 1 }}>
        {reqTab === "headers" ? (
          <textarea 
            ref={headersRef}
            focused={focusIdx === 2} 
            placeholder="Headers in JSON format e.g. { \u0022Content-Type\u0022: \u0022application/json\u0022 }" 
            onContentChange={() => setHeaders(headersRef.current?.plainText || "")}
          />
        ) : (
          <textarea 
            ref={bodyRef}
            focused={focusIdx === 2} 
            placeholder="Request Body..." 
            onContentChange={() => setBody(bodyRef.current?.plainText || "")}
          />
        )}
      </box>

      {/* Response Info */}
      <box flexDirection="row" style={{ height: 1, marginBottom: 1, gap: 2 }}>
        <text style={{ fg: "#00ff00" }}>Response Status: {status !== null ? status : "N/A"}</text>
        <text style={{ fg: "#00ffff" }}>Time: {latency !== null ? `${latency}ms` : "N/A"}</text>
        <text style={{ fg: "#aaaaaa" }}>Press Ctrl+P to Send, Tab to Switch Focus</text>
      </box>

      {/* Res Area */}
      <box style={{ flexGrow: 1, border: true, borderColor: focusIdx === 3 ? "#ffff00" : "#555" }}>
        <scrollbox focused={focusIdx === 3} style={{ width: "100%", height: "100%" }}>
          <code content={response} filetype="json" syntaxStyle={syntaxStyle} width="100%" height="100%" />
        </scrollbox>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
