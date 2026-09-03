/**
 * Client-safe model metadata.
 *
 * This module is imported by client components (e.g. the model picker in
 * `components/Hero.tsx`). It must never contain credentials, base URLs with
 * embedded tokens, or anything else that should stay on the server.
 * Provider calls and API keys live in `lib/omnirouter.ts`, which is server-only.
 */

// Ordered failover models.
export const MODELS = [
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "gpt-5-6-luna",
  "gpt-5-6-terra",
] as const;

export type ModelId = (typeof MODELS)[number];

// Model display names and descriptions for UI
export const MODEL_INFO = [
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", description: "الأسرع والأكثر استقراراً (موصى به)" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "متوازن وموثوق" },
  { id: "gpt-5-6-luna", name: "GPT-5.6 Luna", description: "إبداعي (قد يكون أبطأ)" },
  { id: "gpt-5-6-terra", name: "GPT-5.6 Terra", description: "دقيق ومفصّل" },
] as const;

export function isKnownModel(value: string): value is ModelId {
  return (MODELS as readonly string[]).includes(value);
}
