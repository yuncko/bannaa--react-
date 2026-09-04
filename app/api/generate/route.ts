import { NextRequest, NextResponse } from "next/server";
import {
  REPAIR_INSTRUCTION,
  buildRepairInput,
  buildUserInput,
  extractProjectResponse,
  extractReactProject,
  generateRawOutput,
  mergeProjects,
  redactSecrets,
} from "@/lib/omnirouter";
import { parsePartialProject } from "@/lib/stream-parser";
import {
  STREAM_CONTENT_TYPE,
  encodeEvent,
  type StreamEvent,
} from "@/lib/stream-protocol";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import type { ReactProject } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PROMPT_LENGTH = 5000;

interface ParsedRequest {
  prompt: string;
  modelId?: string;
  previousProject?: ReactProject;
  stream: boolean;
  repair?: { message: string; file?: string; stack?: string };
}

/** Maps a provider failure onto a user-facing Arabic message and HTTP status. */
function describeError(message: string): { status: number; error: string } {
  if (/MISSING_API_KEY/.test(message)) {
    return {
      status: 500,
      error:
        "لم يتم إعداد مفاتيح API للمزوّد على الخادم. أضف OMNIROUTER_API_KEY_1..3 إلى متغيّرات البيئة.",
    };
  }
  if (/HTTP 401|HTTP 403|api key|unauthenticated|forbidden|permission/i.test(message)) {
    return {
      status: 401,
      error: "مفتاح API غير صالح أو لا يملك الصلاحية. تحقّق من مفاتيح المزوّد.",
    };
  }
  if (/HTTP 402|HTTP 429|quota|credit|rate limit/i.test(message)) {
    return {
      status: 429,
      error: "تم تجاوز حد الاستخدام أو نفد الرصيد لجميع المفاتيح. حاول بعد قليل.",
    };
  }
  if (/truncated|finish_reason=length/i.test(message)) {
    return {
      status: 502,
      error:
        "المشروع أكبر من الحد الأقصى لمخرجات النموذج. اطلب نطاقًا أصغر أو قسّم الطلب إلى خطوات.",
    };
  }
  if (/fetch failed|enotfound|econnrefused|network|timeout/i.test(message)) {
    return {
      status: 503,
      error: "تعذّر الوصول إلى خادم المزوّد. تحقّق من اتصالك بالإنترنت أو إعدادات الشبكة.",
    };
  }
  return { status: 500, error: "حدث خطأ أثناء التواصل مع المزوّد: " + message };
}

function parseBody(body: unknown): ParsedRequest | { error: string } {
  const {
    prompt,
    modelId,
    previousProject,
    previousCode,
    stream,
    repair,
  } = (body ?? {}) as Record<string, unknown>;

  const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (!cleanPrompt) {
    return { error: "الرجاء كتابة وصف لتطبيق React الذي تريده." };
  }
  if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
    return { error: "الوصف طويل جدًا، اختصره قليلًا وأعد المحاولة." };
  }

  let base: ReactProject | undefined;
  if (previousProject && typeof previousProject === "object" && "files" in previousProject) {
    base = previousProject as ReactProject;
  } else if (typeof previousCode === "string" && previousCode.trim()) {
    base = extractReactProject(previousCode);
  }

  const repairInfo =
    repair && typeof repair === "object" && typeof (repair as { message?: unknown }).message === "string"
      ? {
          message: (repair as { message: string }).message.slice(0, 2000),
          file: typeof (repair as { file?: unknown }).file === "string"
            ? ((repair as { file: string }).file)
            : undefined,
          stack: typeof (repair as { stack?: unknown }).stack === "string"
            ? ((repair as { stack: string }).stack)
            : undefined,
        }
      : undefined;

  return {
    prompt: cleanPrompt,
    modelId: typeof modelId === "string" ? modelId : undefined,
    previousProject: base,
    stream: stream !== false,
    repair: repairInfo,
  };
}

/**
 * Builds the provider input for this request.
 *
 * A repair request carries the sandbox's error instead of a user instruction, so
 * it swaps in the repair system prompt: fixing a crash and redesigning a page are
 * different jobs and should not share one instruction.
 */
function buildInput(req: ParsedRequest): { input: string; system?: string } {
  if (req.repair && req.previousProject) {
    return {
      input: buildRepairInput(
        req.previousProject,
        req.repair.message,
        req.repair.file,
        req.repair.stack
      ),
      system: REPAIR_INSTRUCTION,
    };
  }
  return { input: buildUserInput(req.prompt, req.previousProject) };
}

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(clientKey(req.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `عدد كبير من الطلبات. انتظر ${limit.retryAfter} ثانية ثم أعد المحاولة.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfter),
          "X-RateLimit-Limit": String(limit.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  return parsed.stream ? streamResponse(req, parsed) : blockingResponse(parsed);
}

/**
 * Streaming path: emits NDJSON events as the model writes, then one `done` event
 * carrying the merged project.
 */
function streamResponse(req: NextRequest, parsed: ParsedRequest): Response {
  const encoder = new TextEncoder();
  const isEdit = Boolean(parsed.previousProject);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };

      // Only the growth of each file is worth a frame; re-sending unchanged
      // content on every token would put the whole project on the wire per chunk.
      let sentLengths = new Map<string, number>();
      let sentTitle = "";
      let accumulated = "";
      let lastFlush = 0;

      const flush = (force: boolean) => {
        // ~60ms between frames keeps the reveal smooth without one event per token.
        const now = Date.now();
        if (!force && now - lastFlush < 60) return;
        lastFlush = now;

        const partial = parsePartialProject(accumulated);

        if (partial.title && partial.title !== sentTitle) {
          sentTitle = partial.title;
          send({ type: "title", title: partial.title, description: partial.description });
        }

        for (const [path, content] of Object.entries(partial.files)) {
          if (sentLengths.get(path) === content.length) continue;
          sentLengths.set(path, content.length);
          send({ type: "file", path, content, done: true });
        }

        if (partial.activeFile) {
          const { path, content } = partial.activeFile;
          if (sentLengths.get(path) !== content.length) {
            sentLengths.set(path, content.length);
            send({ type: "file", path, content, done: false });
          }
        }
      };

      try {
        const { input, system } = buildInput(parsed);

        const raw = await generateRawOutput(input, parsed.modelId, {
          system,
          signal: req.signal,
          onAttempt: (model) => {
            // A retry restarts the response from scratch: drop what was shown so
            // the client does not splice two different generations together.
            accumulated = "";
            sentLengths = new Map();
            sentTitle = "";
            send({ type: "meta", model, isEdit });
          },
          onDelta: (delta) => {
            accumulated += delta;
            flush(false);
          },
        });

        accumulated = raw;
        flush(true);

        const response = extractProjectResponse(raw, { allowPartial: isEdit });
        const project = mergeProjects(
          parsed.previousProject,
          response.project,
          response.deletedFiles
        );

        if (!project.files || Object.keys(project.files).length === 0) {
          send({
            type: "error",
            error: "تعذّر توليد مشروع React صالح من النموذج. حاول إعادة صياغة الطلب بشكل أوضح.",
            retryable: true,
          });
        } else {
          send({ type: "done", project });
        }
      } catch (err) {
        // A client-side cancel is not an error worth reporting; the socket is gone.
        if (err instanceof Error && err.name === "AbortError") {
          closed = true;
        } else {
          const message = redactSecrets(err instanceof Error ? err.message : String(err));
          console.error("[/api/generate] stream error:", message);
          send({ type: "error", error: describeError(message).error, retryable: true });
        }
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": STREAM_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      // Defeats proxy buffering, which would otherwise hold the whole response
      // and erase the point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Non-streaming path, kept for clients that cannot read a stream. */
async function blockingResponse(parsed: ParsedRequest): Promise<Response> {
  try {
    const { input, system } = buildInput(parsed);
    const raw = await generateRawOutput(input, parsed.modelId, { system });
    const isEdit = Boolean(parsed.previousProject);
    const response = extractProjectResponse(raw, { allowPartial: isEdit });
    const project = mergeProjects(parsed.previousProject, response.project, response.deletedFiles);

    if (!project.files || Object.keys(project.files).length === 0) {
      return NextResponse.json(
        {
          error: "تعذّر توليد مشروع React صالح من النموذج. حاول إعادة صياغة الطلب بشكل أوضح.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ project });
  } catch (err) {
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    console.error("[/api/generate] error:", message);
    const { status, error } = describeError(message);
    return NextResponse.json({ error }, { status });
  }
}
