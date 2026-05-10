import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync, unlinkSync } from "fs";
import { join } from "path";
export type { Collection, Environment, Config, HistoryEntry, CollectionRequest, AuthConfig } from "./types.js";
import type { Collection, Environment, Config, HistoryEntry, AuthConfig } from "./types.js";

const POSTUI_DIR = ".postui";
const COLLECTIONS_DIR = join(POSTUI_DIR, "collections");
const ENVIRONMENTS_DIR = join(POSTUI_DIR, "environments");
const CONFIG_FILE = join(POSTUI_DIR, "config.json");
const HISTORY_FILE = join(POSTUI_DIR, "history.jsonl");
const GLOBALS_FILE = join(POSTUI_DIR, "globals.json");

function ensureDirs() {
  if (!existsSync(POSTUI_DIR)) mkdirSync(POSTUI_DIR, { recursive: true });
  if (!existsSync(COLLECTIONS_DIR)) mkdirSync(COLLECTIONS_DIR, { recursive: true });
  if (!existsSync(ENVIRONMENTS_DIR)) mkdirSync(ENVIRONMENTS_DIR, { recursive: true });
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

// Collections

export function listCollections(): Collection[] {
  ensureDirs();
  if (!existsSync(COLLECTIONS_DIR)) return [];
  return readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Collection>(join(COLLECTIONS_DIR, f)))
    .filter((c): c is Collection => c !== null);
}

export function loadCollection(id: string): Collection | null {
  ensureDirs();
  return readJson<Collection>(join(COLLECTIONS_DIR, `${id}.json`));
}

export function saveCollection(collection: Collection) {
  ensureDirs();
  writeJson(join(COLLECTIONS_DIR, `${collection.id}.json`), collection);
}

export function deleteCollection(id: string) {
  const path = join(COLLECTIONS_DIR, `${id}.json`);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

// Environments

export function listEnvironments(): Environment[] {
  ensureDirs();
  if (!existsSync(ENVIRONMENTS_DIR)) return [];
  return readdirSync(ENVIRONMENTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Environment>(join(ENVIRONMENTS_DIR, f)))
    .filter((e): e is Environment => e !== null);
}

export function loadEnvironment(id: string): Environment | null {
  ensureDirs();
  return readJson<Environment>(join(ENVIRONMENTS_DIR, `${id}.json`));
}

export function saveEnvironment(env: Environment) {
  ensureDirs();
  writeJson(join(ENVIRONMENTS_DIR, `${env.id}.json`), env);
}

// Config

export function loadConfig(): Config {
  ensureDirs();
  return readJson<Config>(CONFIG_FILE) ?? { activeEnvironment: null, activeCollection: null };
}

export function saveConfig(config: Config) {
  ensureDirs();
  writeJson(CONFIG_FILE, config);
}

// Globals

export function loadGlobals(): Record<string, string> {
  ensureDirs();
  return readJson<Record<string, string>>(GLOBALS_FILE) ?? {};
}

export function saveGlobals(globals: Record<string, string>) {
  ensureDirs();
  writeJson(GLOBALS_FILE, globals);
}

// History

export function appendHistory(entry: HistoryEntry) {
  ensureDirs();
  appendFileSync(HISTORY_FILE, JSON.stringify(entry) + "\n");
}

export function searchHistory(query: string): HistoryEntry[] {
  ensureDirs();
  if (!existsSync(HISTORY_FILE)) return [];
  const lines = readFileSync(HISTORY_FILE, "utf-8").split("\n").filter(Boolean);
  const entries = lines.map((l) => JSON.parse(l) as HistoryEntry);
  if (!query) return entries;
  const q = query.toLowerCase();
  return entries.filter(
    (e) => e.method.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
  );
}

export function loadAllHistory(): HistoryEntry[] {
  ensureDirs();
  if (!existsSync(HISTORY_FILE)) return [];
  const lines = readFileSync(HISTORY_FILE, "utf-8").split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l) as HistoryEntry);
}

// Variable resolution

export function resolveVariables(
  text: string,
  globals: Record<string, string>,
  envVars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return envVars[varName] ?? globals[varName] ?? match;
  });
}

// Auth

export function getEffectiveAuth(
  requestAuth: AuthConfig | undefined,
  collectionAuth: AuthConfig | undefined
): AuthConfig | null {
  if (requestAuth && requestAuth.type) return requestAuth;
  if (collectionAuth && collectionAuth.type) return collectionAuth;
  return null;
}
