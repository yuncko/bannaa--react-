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
  type GenerateErrorBody,
  type GenerateErrorCode,
  type StreamEvent,
} from "@/lib/stream-protocol";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { costForRun, formatMoney, type RunKind } from "@/lib/billing";
import { debitCredits, getBalanceCents, refundCredits } from "@/lib/credits";
import { getSessionUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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

/** What this request costs and who is paying for it. */
interface Charge {
  kind: RunKind;
  amountCents: number;
  /** Idempotency key, so a retried request is billed once. */
  reference: string;
}

function errorResponse(
  code: GenerateErrorCode,
  error: string,
  status: number,
  extra?: Omit<GenerateErrorBody, "error" | "code">,
  headers?: Record<string, string>
): NextResponse {
  const body: GenerateErrorBody = { error, code, ...extra };
  return NextResponse.json(body, { status, headers });
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
    return errorResponse(
      "rate_limited",
      `عدد كبير من الطلبات. انتظر ${limit.retryAfter} ثانية ثم أعد المحاولة.`,
      429,
      undefined,
      {
        "Retry-After": String(limit.retryAfter),
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": "0",
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_request", "طلب غير صالح.", 400);
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return errorResponse("invalid_request", parsed.error, 400);
  }

  // Billing runs after validation so a malformed request is never charged, and
  // after the rate limit so an abusive caller never reaches the database.
  const gate = await authorizeAndCharge(parsed);
  if ("response" in gate) return gate.response;

  return parsed.stream
    ? streamResponse(req, parsed, gate.charge)
    : blockingResponse(parsed, gate.charge);
}

/**
 * Establishes who is paying, then reserves the cost of the run.
 *
 * The charge happens up front rather than on success, for two reasons. The
 * provider bills us for the attempt whichever way it ends, and a check-then-charge
 * order lets two concurrent requests both pass the same balance check. The refund
 * on failure gives the user the same outcome as charging late.
 *
 * A deployment without Supabase keeps working unbilled: the generator does not
 * depend on auth, and taking the whole site down because a migration has not been
 * applied would be the wrong trade.
 */
async function authorizeAndCharge(
  parsed: ParsedRequest
): Promise<{ charge: Charge | null } | { response: NextResponse }> {
  if (!isSupabaseConfigured) return { charge: null };

  const user = await getSessionUser();
  if (!user) {
    return {
      response: errorResponse(
        "auth_required",
        "سجّل الدخول للبدء — ستحصل على رصيد ترحيبي بقيمة 5$ فورًا.",
        401
      ),
    };
  }

  const kind: RunKind = parsed.repair ? "repair" : parsed.previousProject ? "edit" : "create";
  const amountCents = costForRun(parsed.modelId, kind);

  // A fresh reference per request. It does not deduplicate client retries — the
  // client sends no idempotency key — but it is what lets the refund verify that
  // this exact charge happened and refuse to credit twice.
  const reference = crypto.randomUUID();

  const result = await debitCredits(
    amountCents,
    { model: parsed.modelId ?? "default", kind },
    reference
  );

  if (result.unavailable) {
    // The wallet could not be reached. Failing closed would take generation down
    // for everyone on a transient database error, so the run proceeds unbilled and
    // the gap is left in the log where it can be reconciled.
    console.error("[/api/generate] billing unavailable — running unbilled", {
      user: user.id,
      amountCents,
    });
    return { charge: null };
  }

  if (!result.charged) {
    return {
      response: errorResponse(
        "insufficient_credits",
        `رصيدك ${formatMoney(result.balanceCents)} ولا يكفي لهذا الطلب (${formatMoney(amountCents)}). اشترك لمتابعة البناء.`,
        402,
        { balanceCents: result.balanceCents, requiredCents: amountCents }
      ),
    };
  }

  return { charge: { kind, amountCents, reference } };
}

/**
 * Streaming path: emits NDJSON events as the model writes, then one `done` event
 * carrying the merged project.
 */
function streamResponse(
  req: NextRequest,
  parsed: ParsedRequest,
  charge: Charge | null
): Response {
  const encoder = new TextEncoder();
  const isEdit = Boolean(parsed.previousProject);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      // The run was billed before the stream opened, so anything that ends without
      // a project has to give the money back.
      let settled = false;
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
          settled = true;
          send({ type: "done", project });
          if (charge) {
            // After `done`, so a slow balance read cannot delay the project the
            // user is waiting for. The event is advisory; `/account` is the record.
            const balanceCents = await currentBalance();
            if (balanceCents !== null) {
              send({ type: "balance", balanceCents, chargedCents: charge.amountCents });
            }
          }
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
        // Covers every non-success exit, cancellation included: the user got no
        // project, so they keep their credit.
        if (charge && !settled) {
          await refundCredits(charge.amountCents, charge.reference);
        }
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
async function blockingResponse(
  parsed: ParsedRequest,
  charge: Charge | null
): Promise<Response> {
  try {
    const { input, system } = buildInput(parsed);
    const raw = await generateRawOutput(input, parsed.modelId, { system });
    const isEdit = Boolean(parsed.previousProject);
    const response = extractProjectResponse(raw, { allowPartial: isEdit });
    const project = mergeProjects(parsed.previousProject, response.project, response.deletedFiles);

    if (!project.files || Object.keys(project.files).length === 0) {
      if (charge) await refundCredits(charge.amountCents, charge.reference);
      return errorResponse(
        "provider_error",
        "تعذّر توليد مشروع React صالح من النموذج. حاول إعادة صياغة الطلب بشكل أوضح.",
        502
      );
    }

    const balanceCents = charge ? await currentBalance() : null;
    return NextResponse.json({
      project,
      ...(balanceCents !== null && charge
        ? { balanceCents, chargedCents: charge.amountCents }
        : {}),
    });
  } catch (err) {
    if (charge) await refundCredits(charge.amountCents, charge.reference);
    const message = redactSecrets(err instanceof Error ? err.message : String(err));
    console.error("[/api/generate] error:", message);
    const { status, error } = describeError(message);
    return errorResponse("provider_error", error, status);
  }
}

/** Balance after a charge, or `null` when it cannot be read — never fatal. */
async function currentBalance(): Promise<number | null> {
  try {
    return await getBalanceCents();
  } catch {
    return null;
  }
}
