/// <reference lib="webworker" />
import init, {
  transliterate,
  engine_version,
  scheme_version,
  encode_legacy,
} from '../../../../core/lipiflow-wasm/pkg/lipiflow_wasm';
import type { EngineMessage, EngineRequest, EncodingSpan } from './protocol';
const scope = self as DedicatedWorkerGlobalScope;
const send = (message: EngineMessage) => scope.postMessage(message);
const ready = init()
  .then(() => {
    send({ type: 'ready', engineVersion: engine_version(), schemeVersion: scheme_version() });
  })
  .catch(() => {
    send({ type: 'error' });
  });
scope.onmessage = async ({ data }: MessageEvent<EngineRequest>) => {
  if (data.type !== 'convert' && data.type !== 'encode') return;
  try {
    await ready;
    if (data.type === 'encode') {
      const result = JSON.parse(encode_legacy(data.text)) as {
        text: string;
        unsupported: string[];
        spans: EncodingSpan[];
      };
      send({ type: 'converted', id: data.id, ...result });
    } else {
      send({ type: 'converted', id: data.id, text: transliterate(data.text) });
    }
  } catch {
    send({ type: 'error', id: data.id });
  }
};
