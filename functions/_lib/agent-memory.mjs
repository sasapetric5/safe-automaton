const MAX_MEMORY_VALUE = 3_000;
const MAX_MEMORY_KEY = 80;
const MAX_LIST = 50;

function cleanKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateMemoryInput(input) {
  const key = cleanKey(input?.key);
  const value = typeof input?.value === "string" ? input.value.trim() : "";
  const category = typeof input?.category === "string" ? input.category.trim().slice(0, 40) : "general";
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(key) || key.length > MAX_MEMORY_KEY) {
    return { ok: false, code: "INVALID_MEMORY_KEY" };
  }
  if (!value || value.length > MAX_MEMORY_VALUE) {
    return { ok: false, code: "INVALID_MEMORY_VALUE" };
  }
  // Reject obvious credentials rather than risk persisting them as "memory".
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]/i.test(value)) {
    return { ok: false, code: "POSSIBLE_SECRET_REJECTED" };
  }
  return { ok: true, record: { key, value, category: category || "general" } };
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveMemory(store, input, now = new Date().toISOString(), id = crypto.randomUUID()) {
  const validated = validateMemoryInput(input);
  if (!validated.ok) return validated;
  const { key, value, category } = validated.record;
  const storageKey = "memory:v1:" + key;
  const existing = await store.get(storageKey);
  const valueHash = await sha256Hex(value);
  const record = {
    key, value, category, createdAt: existing ? JSON.parse(existing).createdAt : now,
    updatedAt: now, version: existing ? (JSON.parse(existing).version || 1) + 1 : 1
  };
  await store.put(storageKey, JSON.stringify(record));
  const audit = {
    id, at: now, operation: existing ? "memory.updated" : "memory.created",
    key, version: record.version, valueSha256: valueHash
  };
  await store.put("audit:v1:" + now + ":" + id, JSON.stringify(audit));
  return { ok: true, record: { ...record, valueSha256: valueHash }, audit };
}

export async function listMemory(store, cursor) {
  const page = await store.list({ prefix: "memory:v1:", limit: MAX_LIST, ...(cursor ? { cursor } : {}) });
  const records = [];
  for (const item of page.keys || []) {
    const raw = await store.get(item.name);
    if (raw) {
      try {
        const record = JSON.parse(raw);
        records.push({
          key: record.key, value: record.value, category: record.category,
          createdAt: record.createdAt, updatedAt: record.updatedAt, version: record.version
        });
      } catch { /* Ignore malformed records; never expose raw storage. */ }
    }
  }
  return { records, cursor: page.list_complete === false ? page.cursor || null : null };
}

export async function listAudit(store, cursor) {
  const page = await store.list({ prefix: "audit:v1:", limit: MAX_LIST, ...(cursor ? { cursor } : {}) });
  const records = [];
  for (const item of page.keys || []) {
    const raw = await store.get(item.name);
    if (raw) {
      try { records.push(JSON.parse(raw)); } catch { /* Ignore malformed records. */ }
    }
  }
  records.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return { records, cursor: page.list_complete === false ? page.cursor || null : null };
}
