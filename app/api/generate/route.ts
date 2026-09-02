import { NextRequest, NextResponse } from "next/server";
import {
  buildUserInput,
  extractReactProject,
  generateRawOutput,
} from "@/lib/omnirouter";
import type { ReactProject } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "طلب غير صالح." },
      { status: 400 }
    );
  }

  const { prompt, modelId, previousProject, previousCode } = (body ?? {}) as {
    prompt?: unknown;
    modelId?: unknown;
    previousProject?: unknown;
    previousCode?: unknown;
  };

  const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const cleanModelId = typeof modelId === "string" ? modelId : undefined;
  let cleanPreviousProject: ReactProject | undefined = undefined;

  if (previousProject && typeof previousProject === "object" && "files" in previousProject) {
    cleanPreviousProject = previousProject as ReactProject;
  } else if (typeof previousCode === "string" && previousCode.trim()) {
    cleanPreviousProject = extractReactProject(previousCode);
  }

  if (!cleanPrompt) {
    return NextResponse.json(
      { error: "الرجاء كتابة وصف لتطبيق React الذي تريده." },
      { status: 400 }
    );
  }

  if (cleanPrompt.length > 5000) {
    return NextResponse.json(
      { error: "الوصف طويل جدًا، اختصره قليلًا وأعد المحاولة." },
      { status: 400 }
    );
  }

  try {
    const rawOutput = await generateRawOutput(
      buildUserInput(cleanPrompt, cleanPreviousProject),
      cleanModelId
    );
    const project = extractReactProject(rawOutput);

    if (!project || !project.files || Object.keys(project.files).length === 0) {
      return NextResponse.json(
        {
          error:
            "تعذّر توليد مشروع React صالح من النموذج. حاول إعادة صياغة الطلب بشكل أوضح.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error("[/api/generate] error:", err);

    const message = err instanceof Error ? err.message : String(err);

    if (/HTTP 401|api key|unauthenticated|forbidden|permission/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "مفتاح API غير صالح أو لا يملك الصلاحية. تحقّق من مفاتيح المزوّد.",
        },
        { status: 401 }
      );
    }

    if (/HTTP 402|quota|credit|429|rate/i.test(message)) {
      return NextResponse.json(
        {
          error: "تم تجاوز حد الاستخدام أو نفد الرصيد لجميع المفاتيح. حاول بعد قليل.",
        },
        { status: 429 }
      );
    }

    if (/fetch failed|enotfound|econnrefused|network|aborted|timeout/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "تعذّر الوصول إلى خادم المزوّد. تحقّق من اتصالك بالإنترنت أو إعدادات الشبكة.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "حدث خطأ أثناء التواصل مع المزوّد: " + message },
      { status: 500 }
    );
  }
}
