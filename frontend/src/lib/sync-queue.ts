const DB_NAME = "fintrack-offline";
const STORE_NAME = "queue";
const DB_VERSION = 1;

interface QueuedRequest {
  id: string;
  method: string;
  path: string;
  body: string | null;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(
  method: string,
  path: string,
  body: string | null,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const item: QueuedRequest = {
    id: crypto.randomUUID(),
    method,
    path,
    body,
    timestamp: Date.now(),
  };
  store.add(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainQueue(baseUrl: string): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const items: QueuedRequest[] = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as QueuedRequest[]);
    req.onerror = () => reject(req.error);
  });

  items.sort((a, b) => a.timestamp - b.timestamp);
  let sent = 0;

  for (const item of items) {
    try {
      const res = await fetch(`${baseUrl}${item.path}`, {
        method: item.method,
        credentials: "include",
        headers: item.body
          ? { "Content-Type": "application/json" }
          : undefined,
        body: item.body,
      });
      if (res.ok || res.status === 409) {
        const delTx = db.transaction(STORE_NAME, "readwrite");
        delTx.objectStore(STORE_NAME).delete(item.id);
        await new Promise<void>((r) => {
          delTx.oncomplete = () => r();
        });
        sent++;
      }
    } catch {
      break;
    }
  }
  return sent;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    drainQueue(baseUrl).catch(() => {});
  });
}
