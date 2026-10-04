import type { EngineMessage, EngineRequest } from './protocol';

// One WASM worker per page. Independent clients retain their own request IDs.
// This also avoids WebKit racing duplicate worker WASM fetches offline.
export interface EngineClient {
  onmessage: ((event: MessageEvent<EngineMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: (() => void) | null;
  postMessage(message: EngineRequest): void;
  terminate(): void;
}
const clients = new Set<EngineClient>();
const pending = new Map<number, { client: EngineClient; localId: number }>();
let instance: Worker | null = null;
let ready: Extract<EngineMessage, { type: 'ready' }> | null = null;
let failed = false;
let nextId = 0;

function start() {
  instance?.terminate();
  instance = null;
  ready = null;
  pending.clear();
  failed = true;
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  instance = worker;
  failed = false;
  worker.onmessage = ({ data }: MessageEvent<EngineMessage>) => {
    if (instance !== worker) return;
    if (data.type === 'ready' || (data.type === 'error' && data.id === undefined)) {
      if (data.type === 'ready') ready = data;
      else failed = true;
      clients.forEach((client) => client.onmessage?.({ data } as MessageEvent<EngineMessage>));
    } else if ('id' in data && data.id !== undefined) {
      const request = pending.get(data.id);
      pending.delete(data.id);
      if (request && clients.has(request.client)) {
        request.client.onmessage?.({
          data: { ...data, id: request.localId },
        } as MessageEvent<EngineMessage>);
      }
    }
  };
  worker.onerror = (event) => {
    if (instance !== worker) return;
    failed = true;
    clients.forEach((client) => client.onerror?.(event));
  };
  worker.onmessageerror = () => {
    if (instance !== worker) return;
    failed = true;
    clients.forEach((client) => client.onmessageerror?.());
  };
}

export function createEngineClient(): EngineClient {
  if (!instance || failed) start();
  const client: EngineClient = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage(message) {
      if (!clients.has(client)) return;
      const id = ++nextId;
      pending.set(id, { client, localId: message.id });
      instance?.postMessage({ ...message, id });
    },
    terminate() {
      clients.delete(client);
      for (const [id, request] of pending) if (request.client === client) pending.delete(id);
      if (!clients.size) {
        instance?.terminate();
        instance = null;
        ready = null;
        pending.clear();
      }
    },
  };
  clients.add(client);
  // Let the hook attach listeners before replaying an already initialized worker.
  const initialReady = ready;
  if (initialReady)
    queueMicrotask(() => {
      if (clients.has(client))
        client.onmessage?.({ data: initialReady } as MessageEvent<EngineMessage>);
    });
  return client;
}
