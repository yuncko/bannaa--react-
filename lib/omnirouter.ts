// Importing this module from a Client Component is a build error. That guarantee
// is what keeps the API keys below out of the browser bundle. UI-facing model
// metadata lives in `lib/models.ts`, which is safe to import anywhere.
import "server-only";

import type { ReactProject } from "./types";
import { MODELS, isKnownModel } from "./models";
import { SANDBOX_MODULE_LIST } from "./sandbox-modules";
import { parseSseData, splitSseFrames } from "./stream-parser";

// Prompt construction, response parsing, and merging live in `lib/project.ts`
// because they need no credentials or network access. Re-exported so callers can
// keep treating the provider module as their single entry point.
export {
  buildUserInput,
  buildRepairInput,
  mergeProjects,
  extractReactProject,
  extractProjectResponse,
  normalizeProject,
  pickEntryFile,
} from "./project";
export type { ProjectResponse } from "./project";

const BASE_URL = process.env.OMNIROUTER_BASE_URL || "https://omnirouter.li/v1";

/**
 * Ordered failover keys — if one fails (network, quota, auth), the next is tried.
 *
 * Read from the environment on every access rather than captured at module load,
 * so a rotated key takes effect without a rebuild. There are deliberately no
 * hardcoded fallbacks: a leaked repository must not carry working credentials.
 */
function loadApiKeys(): string[] {
  return [
    process.env.OMNIROUTER_API_KEY_1,
    process.env.OMNIROUTER_API_KEY_2,
    process.env.OMNIROUTER_API_KEY_3,
  ]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

/** Stable, non-reversible label for logs so keys are never written to stdout. */
function keyLabel(index: number, key: string): string {
  return `key_${index + 1}(len=${key.length})`;
}

/**
 * Strips anything that looks like a provider credential out of text that may be
 * logged or returned to the client — provider error bodies sometimes echo the
 * Authorization header back.
 */
export function redactSecrets(text: string): string {
  let safe = text.replace(/sk[-_][A-Za-z0-9_-]{8,}/g, "[REDACTED_KEY]");
  safe = safe.replace(/(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [REDACTED_KEY]");
  for (const key of loadApiKeys()) {
    safe = safe.split(key).join("[REDACTED_KEY]");
  }
  return safe;
}

/**
 * The single source of truth, prompt-side, for what the preview sandbox can
 * import. The package list itself lives in `lib/sandbox-modules.ts` so the
 * resolver in `lib/bundler.ts` and these prompts cannot drift: anything
 * advertised here but absent there resolves to a no-op stub and trips the
 * missing-module warning, which is how the previous list (recharts, date-fns,
 * react-router-dom) silently broke generated code.
 */
const RUNTIME_MODULES_RULE = `The preview sandbox resolves ONLY these packages: ${SANDBOX_MODULE_LIST}. Any other package (recharts, chart.js, date-fns, react-router-dom, axios, react-hook-form, swiper, three, gsap, …) does NOT exist there and will fail at runtime — implement the behaviour yourself with React, plain TypeScript, Tailwind, and inline SVG instead. There is no router: model navigation with local state. There is no charting library: draw charts with inline SVG or Tailwind-styled divs. There is no date library: use the built-in Date and Intl APIs.`;

export const SYSTEM_INSTRUCTION = `You are "بنّاء" (Bannaa), a world-class Senior React & TypeScript Architect and Award-Winning Product Designer, on par with the design teams at Linear, Vercel, Stripe, and Apple. You are obsessed with restraint, clarity, and craft — not decoration.

YOUR MISSION:
Generate a COMPLETE, production-ready, modular React + TypeScript + Tailwind CSS application based on the user's prompt. You create REAL multi-file React projects (like Lovable.dev), NOT plain HTML documents. The result must look like it was designed by a senior product designer with real taste, not generated from a generic template.

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object (no markdown wrapping before or after, or wrapped in a single \`\`\`json code block):
{
  "title": "Short descriptive app title (e.g., SaaS Analytics Dashboard)",
  "description": "One sentence summary of the app and its features",
  "files": {
    "src/App.tsx": "// Main root component composing the page and managing top-level state",
    "src/components/Navbar.tsx": "// Header/Navbar component with logo, links, actions, mobile menu",
    "src/components/Hero.tsx": "// Hero section with CTA, badges, metrics, visuals",
    "src/components/Features.tsx": "// Feature cards with Lucide icons, hover effects, tabs/filters",
    "src/components/Pricing.tsx": "// Interactive pricing tiers with monthly/yearly toggle",
    "src/components/Testimonials.tsx": "// Testimonials / Social proof cards",
    "src/components/Footer.tsx": "// Comprehensive footer with links, newsletter, copyright",
    "src/types.ts": "// TypeScript interfaces, types, and mock data models"
  }
}

STRICT ARCHITECTURAL RULES:
1. MODULAR COMPONENT STRUCTURE:
   - Split the application into clean, dedicated files inside "src/components/...".
   - "src/App.tsx" MUST be the main entry component, importing and composing the subcomponents.
   - Every component file must have \`export default ComponentName;\` or \`export function ComponentName\`.
   - Use ES Module imports: \`import React, { useState, useEffect } from 'react';\`, \`import Navbar from './components/Navbar';\`, etc.

2. ICONS & ASSETS:
   - Use "lucide-react" for all icons, and use them sparingly and purposefully — never as pure decoration. (\`import { Sparkles, ArrowRight, ArrowLeft, Check, CheckCircle, Menu, X, Search, Star, Shield, Zap, TrendingUp, Heart, ShoppingCart, User, Users, Plus, Trash2, Eye, Lock, Mail, Globe, ChevronDown, ChevronRight, Download, Play, Clock, Calendar, DollarSign, Activity, BarChart2, Layers, Settings, Sun, Moon, Filter, Sliders, Share2 } from 'lucide-react';\`).
   - For real images, use high-resolution Unsplash URLs (e.g., \`https://images.unsplash.com/photo-...?...&auto=format&fit=crop&w=800&q=80\`). Never use broken local asset paths. Only include an image if it genuinely earns its place — do not pad sections with stock photos just to fill space.

3. DESIGN PHILOSOPHY — TASTE OVER TEMPLATES (READ CAREFULLY):
   You must actively avoid the generic "AI-generated SaaS template" look: purple-to-pink gradient hero + 3 feature cards + fake testimonials + emoji-in-a-circle icons. That look is a cliché and is FORBIDDEN unless the user explicitly asks for it.

   a) ONE DELIBERATE COLOR SYSTEM, NOT A RAINBOW:
      - Pick ONE primary accent color (a single hue) that fits the brand/topic of the prompt, plus a neutral base (near-black/near-white grays, e.g. slate or zinc/neutral scale). That's it.
      - Do NOT mix multiple unrelated gradients (violet AND amber AND emerald on the same page). Gradients, when used, must stay within one or two adjacent hues and be subtle — never the default purple-to-pink AI cliché.
      - Most great interfaces are ~90% neutral (background, text, borders) and ~10% accent color, used only for the things that truly need attention: primary CTAs, active states, key data points, links.

   b) RUTHLESS SIMPLICITY — REMOVE, DON'T ADD:
      - Every section must justify its existence. If a section doesn't add real information or move the user toward an action, cut it.
      - Do NOT auto-include filler sections (fake stats counters, generic "trusted by" logo strips, decorative badges, three-things-in-a-row cards) unless they genuinely fit the specific product in the prompt.
      - Prefer fewer, more considered sections over many shallow ones. A landing page with 4 excellent, well-composed sections beats one with 9 generic ones.
      - Avoid redundant repetition of the same message/CTA more than twice on a single page.
      - Avoid visual clutter: no unnecessary borders, shadows, icons, or badges stacked on top of each other. If in doubt, remove it.

   c) TYPOGRAPHY & HIERARCHY:
      - Establish a clear, confident type hierarchy: one large, tight-leading headline (font-bold, tracking-tight), a calmer supporting paragraph, and clearly smaller body/label text. Avoid making everything the same size and weight.
      - Use generous line-height for body text and tighter line-height for headings.
      - Avoid centering every single block of text by default — use left/right-aligned (per RTL/LTR) text for longer content and reserve centered text for short, punchy hero moments.

   d) LAYOUT, SPACING & RHYTHM:
      - Use a consistent spacing scale (Tailwind's default scale is fine) — do not randomly mix px-3, px-5, px-7 in the same layout. Pick a rhythm (e.g. 4/6/8/12/16/24) and stay consistent across sections.
      - Give sections real breathing room (generous vertical padding, e.g. py-20/py-24/py-32 depending on content weight) instead of cramming everything tightly.
      - Align elements to a clear grid. Avoid awkward asymmetry unless it's intentional and well-balanced.

   e) COMPONENT CRAFT:
      - Buttons, cards, and inputs must look considered: consistent corner radius across the whole app (pick one radius scale, e.g. rounded-lg/rounded-xl, and use it everywhere — don't mix rounded-full buttons with rounded-none cards).
      - Borders and shadows should be subtle and purposeful (e.g. a single soft shadow on elevated surfaces), not stacked heavy drop-shadows plus glows plus borders on every card.
      - Hover/focus states should feel calm and premium (small opacity/color/translate shifts), not exaggerated bouncy scale effects on everything.
      - Dark mode, when used, should be a true refined dark (deep neutral, not pure black) with enough contrast — light mode should be soft off-white, not stark white-on-white with no depth.

   f) MATCH THE DESIGN TO THE ACTUAL PRODUCT:
      - The aesthetic must fit the specific subject in the prompt (a bakery site should feel warm and tactile, a developer tool should feel precise and technical, a kids' app should feel playful) rather than defaulting to the same "modern SaaS dark mode" look for every request.
      - Rich interactivity is still expected (working tab switching, modals, search/filter, cart drawers, theme toggle, accordions, form validation, toasts) — but only where it serves the actual content, not as decoration.
      - Mobile-first responsive layouts using Tailwind CSS classes, with the same restraint and hierarchy carried through to small screens.

4. LANGUAGE & LOCALIZATION:
   - If the prompt is in Arabic or for an Arab audience, write all text in clear, elegant Arabic, use RTL layout (\`dir="rtl"\`), and format numbers/currencies appropriately.
   - If the prompt is in English, write all text in English with LTR layout.

5. MODIFICATIONS & ITERATIONS (TARGETED EDITS — IMPORTANT):
   - When the user asks for a modification to an existing project, return ONLY the files you actually changed or added. Do NOT re-emit files whose content is byte-for-byte identical to what you were given. The caller merges your response over the existing project, so an omitted file is kept unchanged.
   - Always include the complete, final content of each file you do return. Never return a diff, a fragment, an ellipsis, or a comment such as "// rest unchanged".
   - To remove a file, list its path in an optional top-level "deletedFiles" array of strings.
   - Keep "title" and "description" accurate; repeat them unchanged if the change does not affect them.
   - Stay consistent with the design system already established (same accent color, radius scale, spacing rhythm) unless the user explicitly asks to change the visual direction.

6. RUNTIME ENVIRONMENT — NO EXTRA DEPENDENCIES:
   - ${RUNTIME_MODULES_RULE}
   - There is no build step, no CSS file, and no \`public/\` folder: style exclusively with Tailwind utility classes, and do not emit \`package.json\`, \`index.html\`, \`vite.config\`, \`tailwind.config\`, or \`.css\` files.
   - Only import a Lucide icon that really exists in lucide-react. Brand logos (Github, Twitter, Linkedin, Instagram, Facebook) are NOT part of the set — draw those as inline SVG.

Before writing code, silently decide: (1) one accent color + neutral base that fits the topic, (2) one corner-radius scale, (3) one spacing rhythm, (4) the minimum set of sections that truly serve this specific product — then build strictly within those decisions. Return ONLY the valid JSON object now.`;

/** Hard ceiling on generated files, both to bound cost and to reject runaway output. */
const MAX_OUTPUT_TOKENS = 32_000;

/**
 * Instruction for the automatic repair pass. Kept separate from the design
 * prompt so a repair request spends tokens on the failure, not on aesthetics.
 */
export const REPAIR_INSTRUCTION = `You are a senior React + TypeScript engineer fixing a runtime or compilation error in a generated project.

You will receive the project files and the exact error produced when the app was executed in a browser sandbox.

RULES:
1. Diagnose the real cause, then fix it. Do not restyle, redesign, rename, or "improve" anything unrelated to the error.
2. Return ONLY a valid JSON object (no markdown wrapping, no prose):
   {
     "title": "unchanged project title",
     "description": "unchanged description",
     "files": { "src/Path.tsx": "complete fixed file content" }
   }
3. Include ONLY the files you changed, with their complete final content. Omitted files are kept as-is.
4. ${RUNTIME_MODULES_RULE} If the error is a missing or unresolved module, rewrite the code to drop that dependency rather than keeping the import.
5. Common causes to check: a component used but never imported, a default vs named export mismatch, an undefined value read before initialisation, a hook called conditionally, a .map over a possibly-undefined array, or a Lucide icon name that does not exist.

Return ONLY the JSON object now.`;


interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
}

/** Options shared by the streaming and non-streaming request paths. */
export interface CallOptions {
  /** System prompt to use; defaults to the design instruction. */
  system?: string;
  /** Caller-owned cancellation, wired to the client disconnecting. */
  signal?: AbortSignal;
  /** Invoked with each content delta when streaming. */
  onDelta?: (delta: string) => void;
  /**
   * Called before each attempt with the model about to be tried.
   *
   * Failover can start a second stream after the first emitted partial text, so
   * a streaming caller must treat this as "discard whatever you accumulated".
   */
  onAttempt?: (model: string) => void;
}

/** Raised when the model stopped at the output cap, leaving JSON unterminated. */
export class TruncatedOutputError extends Error {
  constructor(model: string) {
    super(
      `HTTP 200 truncated: ${model} hit the output token limit (finish_reason=length)`
    );
    this.name = "TruncatedOutputError";
  }
}

function buildRequestBody(model: string, userInput: string, options: CallOptions, stream: boolean) {
  return JSON.stringify({
    model,
    messages: [
      { role: "system", content: options.system ?? SYSTEM_INSTRUCTION },
      { role: "user", content: userInput },
    ],
    // Low but non-zero: the output must be strictly parseable JSON, and 0.7 was
    // buying variance in syntax rather than in design.
    temperature: 0.3,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream,
  });
}

/** Combines the caller's signal with a wall-clock timeout. */
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), ms);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function callOnce(
  key: string,
  model: string,
  userInput: string,
  options: CallOptions = {}
): Promise<string> {
  const { signal, cleanup } = withTimeout(options.signal, 180_000);
  const streaming = Boolean(options.onDelta);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: buildRequestBody(model, userInput, options, streaming),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} from ${model}: ${redactSecrets(body).slice(0, 300)}`
      );
    }

    const { content, finishReason } = streaming
      ? await readStream(res, options.onDelta!)
      : await readWhole(res);

    if (!content.trim()) {
      throw new Error(`Empty response from ${model}`);
    }

    // A truncated project parses into a plausible-looking single-file result, so
    // it has to be rejected here rather than downstream.
    if (finishReason === "length") {
      throw new TruncatedOutputError(model);
    }

    return content;
  } finally {
    cleanup();
  }
}

async function readWhole(res: Response): Promise<{ content: string; finishReason?: string }> {
  const data = (await res.json()) as ChatCompletionResponse;
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    finishReason: data.choices?.[0]?.finish_reason ?? undefined,
  };
}

async function readStream(
  res: Response,
  onDelta: (delta: string) => void
): Promise<{ content: string; finishReason?: string }> {
  if (!res.body) throw new Error("Streaming response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = splitSseFrames(buffer);
      buffer = rest;

      for (const frame of frames) {
        if (frame === "[DONE]") continue;
        const { content: delta, finishReason: reason } = parseSseData(frame);
        if (reason) finishReason = reason;
        if (delta) {
          content += delta;
          onDelta(delta);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content, finishReason };
}

function isRetryable(err: unknown): boolean {
  // A user-initiated cancel must never be retried against the next key.
  if (err instanceof Error && err.name === "AbortError") return false;

  const message = err instanceof Error ? err.message : String(err);
  // Retry on network failures, timeouts, rate limits, auth/quota, 5xx, and
  // truncated output (a different model or key may fit the response).
  return (
    /HTTP (401|402|403|429|5\d\d)/.test(message) ||
    /truncated/i.test(message) ||
    /fetch failed|enotfound|econnrefused|network|aborted|timeout|empty response/i.test(message)
  );
}

/**
 * Calls Omnirouter chat completions with the specified model, failing over across all API keys.
 * If primaryModel is provided, it is tried with every key first, then the
 * remaining models. Passing `onDelta` switches the request to SSE streaming.
 * Throws the last error if every combination fails.
 */
export async function generateRawOutput(
  userInput: string,
  primaryModel?: string,
  options: CallOptions = {}
): Promise<string> {
  const apiKeys = loadApiKeys();

  if (apiKeys.length === 0) {
    throw new Error(
      "MISSING_API_KEY: لا توجد مفاتيح API للمزوّد. أضف OMNIROUTER_API_KEY_1..3 إلى متغيّرات البيئة."
    );
  }

  let lastError: unknown = new Error("No attempts made");

  // Retrying a stream after partial output would duplicate text on the client,
  // so `onAttempt` fires first to let the caller reset what it has shown.
  const attempt = (key: string, model: string) => {
    options.onAttempt?.(model);
    return callOnce(key, model, userInput, options);
  };

  // If user selected a specific model, try it with all keys first
  if (primaryModel && isKnownModel(primaryModel)) {
    for (const [index, key] of apiKeys.entries()) {
      try {
        return await attempt(key, primaryModel);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        console.error(
          `[omnirouter] ${primaryModel} with ${keyLabel(index, key)} failed, trying next key:`,
          redactSecrets(err instanceof Error ? err.message : String(err))
        );
      }
    }
    // If primary model failed with all keys, fall back to other models
    console.warn(`[omnirouter] Primary model ${primaryModel} failed with all keys, falling back to other models`);
  }

  // Fallback: try all models in order
  const fallbackModels = primaryModel
    ? MODELS.filter((m) => m !== primaryModel)
    : [...MODELS];
  for (const model of fallbackModels) {
    for (const [index, key] of apiKeys.entries()) {
      try {
        return await attempt(key, model);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        console.error(
          `[omnirouter] ${model} with ${keyLabel(index, key)} failed, trying next:`,
          redactSecrets(err instanceof Error ? err.message : String(err))
        );
      }
    }
  }

  throw lastError;
}
