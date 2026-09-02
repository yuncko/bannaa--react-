import type { ReactProject } from "./types";

const BASE_URL = "https://omnirouter.li/v1";

// Ordered failover keys — if one fails (network, quota, auth), the next is tried.
const API_KEYS = [
  process.env.OMNIROUTER_API_KEY_1 ||
    "sk_live_O-7x7pVslijRRiuypDqxj15u5C20584ifibix-2Bgec",
  process.env.OMNIROUTER_API_KEY_2 ||
    "sk_live_DbBeZfjwdES_5n_VXUDFeru21eWZZtyzw5qOIxXx_rs",
  process.env.OMNIROUTER_API_KEY_3 ||
    "sk_live_qjibmoksE9l-u9vrtGKR8lQ25kHCrG7Liv_FTTbCsLU",
].filter(Boolean);

// Ordered failover models.
export const MODELS = ["claude-sonnet-5", "claude-sonnet-4-6", "gpt-5-6-luna", "gpt-5-6-terra"];

// Model display names and descriptions for UI
export const MODEL_INFO = [
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", description: "الأسرع والأكثر استقراراً (موصى به)" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "متوازن وموثوق" },
  { id: "gpt-5-6-luna", name: "GPT-5.6 Luna", description: "إبداعي (قد يكون أبطأ)" },
  { id: "gpt-5-6-terra", name: "GPT-5.6 Terra", description: "دقيق ومفصّل" },
] as const;

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

5. MODIFICATIONS & ITERATIONS:
   - When the user asks for a modification to an existing project, return the updated project JSON.
   - Update, add, or refine only the files that need changes, keeping the rest of the components consistent with the design system already established (same accent color, radius scale, spacing rhythm) unless the user explicitly asks to change the visual direction.

Before writing code, silently decide: (1) one accent color + neutral base that fits the topic, (2) one corner-radius scale, (3) one spacing rhythm, (4) the minimum set of sections that truly serve this specific product — then build strictly within those decisions. Return ONLY the valid JSON object now.`;

export function buildUserInput(prompt: string, previousProject?: ReactProject): string {
  if (previousProject && previousProject.files && Object.keys(previousProject.files).length > 0) {
    return [
      `USER MODIFICATION REQUEST: ${prompt}`,
      "",
      `CURRENT PROJECT: "${previousProject.title || "React Project"}"`,
      `FILES IN CURRENT PROJECT:`,
      JSON.stringify(
        {
          title: previousProject.title,
          description: previousProject.description,
          files: previousProject.files,
        },
        null,
        2
      ),
      "",
      "Please return the complete updated JSON with all updated files incorporating the requested changes.",
    ].join("\n");
  }

  return `USER PROMPT FOR NEW REACT APPLICATION:\n${prompt}`;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

async function callOnce(key: string, model: string, userInput: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: userInput },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} from ${model}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) {
      throw new Error(`Empty response from ${model}`);
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Retry on network failures, timeouts, rate limits, auth/quota and 5xx errors.
  return (
    /HTTP (401|402|403|429|5\d\d)/.test(message) ||
    /fetch failed|enotfound|econnrefused|network|aborted|timeout|empty response/i.test(message)
  );
}

/**
 * Calls Omnirouter chat completions with the specified model, failing over across all API keys.
 * If primaryModel is provided, only tries that model with all keys.
 * Otherwise falls back across all models.
 * Throws the last error if every combination fails.
 */
export async function generateRawOutput(userInput: string, primaryModel?: string): Promise<string> {
  if (API_KEYS.length === 0) {
    throw new Error("MISSING_API_KEY: لا توجد مفاتيح API للمزوّد");
  }

  let lastError: unknown = new Error("No attempts made");

  // If user selected a specific model, try it with all keys first
  if (primaryModel && MODELS.includes(primaryModel)) {
    for (const key of API_KEYS) {
      try {
        return await callOnce(key, primaryModel, userInput);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        console.error(`[omnirouter] ${primaryModel} with key failed, trying next key:`, err);
      }
    }
    // If primary model failed with all keys, fall back to other models
    console.warn(`[omnirouter] Primary model ${primaryModel} failed with all keys, falling back to other models`);
  }

  // Fallback: try all models in order
  const fallbackModels = primaryModel ? MODELS.filter(m => m !== primaryModel) : MODELS;
  for (const model of fallbackModels) {
    for (const key of API_KEYS) {
      try {
        return await callOnce(key, model, userInput);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        console.error(`[omnirouter] ${model} failed, trying next:`, err);
      }
    }
  }

  throw lastError;
}

/**
 * Extracts and parses a ReactProject object from the model's raw output.
 * Handles JSON parsing, markdown code fences, file marker blocks, and fallbacks.
 */
export function extractReactProject(raw: string): ReactProject {
  let text = (raw ?? "").trim();

  // Strip markdown code block fences if present
  const jsonFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonFenceMatch && jsonFenceMatch[1].trim().length > 0) {
    text = jsonFenceMatch[1].trim();
  }

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && parsed.files && typeof parsed.files === "object") {
      // Check if the model accidentally nested the entire JSON structure as a string inside a single file
      const fileKeys = Object.keys(parsed.files);
      if (fileKeys.length === 1 && typeof parsed.files[fileKeys[0]] === "string") {
        const innerContent = parsed.files[fileKeys[0]];
        // Try to parse it as JSON
        try {
          const innerParsed = JSON.parse(innerContent);
          if (innerParsed && typeof innerParsed === "object" && innerParsed.files && typeof innerParsed.files === "object") {
            // Model double-nested — use the inner structure
            return normalizeProject(innerParsed);
          }
        } catch {
          // Not nested JSON, continue with outer structure
        }
      }
      return normalizeProject(parsed);
    }
  } catch {
    // If text has JSON with leading/trailing text, extract substring between first { and last }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const substr = text.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(substr);
        if (parsed && typeof parsed === "object" && parsed.files && typeof parsed.files === "object") {
          // Check for nested JSON pattern here too
          const fileKeys = Object.keys(parsed.files);
          if (fileKeys.length === 1 && typeof parsed.files[fileKeys[0]] === "string") {
            try {
              const innerParsed = JSON.parse(parsed.files[fileKeys[0]]);
              if (innerParsed && typeof innerParsed === "object" && innerParsed.files && typeof innerParsed.files === "object") {
                return normalizeProject(innerParsed);
              }
            } catch {
              // Not nested, continue
            }
          }
          return normalizeProject(parsed);
        }
      } catch {
        // Fall through to custom parsing
      }
    }
  }

  // Fallback 1: Parse multi-file block markers (e.g. `// --- file: src/App.tsx ---`)
  const fileMarkerRegex = /(?:\/\/\s*---|###|\/\*)\s*(?:file:)?\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*(?:---|---\*\/|\n)([\s\S]*?)(?=(?:\/\/\s*---|###|\/\*)\s*(?:file:)?\s*[a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+|$)/g;
  const files: Record<string, string> = {};
  let match;
  while ((match = fileMarkerRegex.exec(text)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim().replace(/^```[a-zA-Z]*\n/, "").replace(/```$/, "").trim();
    if (filename && content) {
      files[filename] = content;
    }
  }

  if (Object.keys(files).length > 0) {
    return normalizeProject({
      title: "React Application",
      description: "Generated React application",
      files,
    });
  }

  // Fallback 2: If model returned single React component / JSX code
  let cleanCode = text
    .replace(/^```(?:tsx|jsx|typescript|javascript|html)?\n/i, "")
    .replace(/```$/i, "")
    .trim();

  // If it returned an HTML file containing React babel script, extract it
  const babelMatch = cleanCode.match(/<script type="text\/babel">([\s\S]*?)<\/script>/i);
  if (babelMatch && babelMatch[1].trim().length > 0) {
    cleanCode = babelMatch[1].trim();
  }

  return normalizeProject({
    title: "React Application",
    description: "Generated React application",
    files: {
      "src/App.tsx": cleanCode || `export default function App() { return <div className="p-8 text-center"><h1>React App</h1></div>; }`,
    },
  });
}

function normalizeProject(project: Partial<ReactProject>): ReactProject {
  const files: Record<string, string> = {};
  const rawFiles = project.files || {};

  for (const [key, val] of Object.entries(rawFiles)) {
    if (typeof val === "string") {
      let normalizedKey = key.trim();
      if (!normalizedKey.startsWith("src/") && !normalizedKey.includes("/")) {
        normalizedKey = "src/" + normalizedKey;
      }
      files[normalizedKey] = val;
    }
  }

  // Ensure App.tsx exists
  const hasApp = Object.keys(files).some((f) =>
    /src\/App\.(tsx|jsx|js|ts)$/i.test(f) || f === "App.tsx" || f === "App.jsx"
  );

  if (!hasApp && Object.keys(files).length > 0) {
    const firstKey = Object.keys(files)[0];
    files["src/App.tsx"] = files[firstKey];
  } else if (Object.keys(files).length === 0) {
    files["src/App.tsx"] = `import React from 'react';\nimport { Sparkles } from 'lucide-react';\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">\n      <div className="text-center">\n        <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />\n        <h1 className="text-3xl font-bold">مرحبًا بك في تطبيق React</h1>\n      </div>\n    </div>\n  );\n}`;
  }

  return {
    title: project.title || "React Project",
    description: project.description || "Modern React & TypeScript application",
    files,
    entryFile: "src/App.tsx",
  };
}
