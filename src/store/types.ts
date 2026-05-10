export interface AuthConfig {
  type: "bearer" | "basic" | "apikey" | null;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apikeyKey?: string;
  apikeyValue?: string;
  apikeyIn?: "header" | "query";
}

export interface CollectionRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  auth?: AuthConfig;
}

export interface Collection {
  id: string;
  name: string;
  requests: CollectionRequest[];
  auth?: AuthConfig;
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface Config {
  activeEnvironment: string | null;
  activeCollection: string | null;
}

export interface HistoryEntry {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  status: number | null;
  latency: number | null;
}
