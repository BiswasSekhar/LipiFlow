export type EngineRequest = { type: 'convert' | 'encode'; id: number; text: string };
export type EncodingSpan = {
  unicode_start: number;
  unicode_end: number;
  encoded_start: number;
  encoded_end: number;
};
export type EngineMessage =
  | { type: 'ready'; engineVersion: string; schemeVersion: string }
  | { type: 'converted'; id: number; text: string; unsupported?: string[]; spans?: EncodingSpan[] }
  | { type: 'error'; id?: number };
export function isCurrentResult(
  message: EngineMessage,
  currentId: number,
): message is Extract<EngineMessage, { type: 'converted' }> {
  return message.type === 'converted' && message.id === currentId;
}
