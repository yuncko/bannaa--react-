"use client";

/**
 * Google / GitHub sign-in buttons.
 *
 * Each is its own `<form>` posting to the same server action, so the flow starts
 * with a real submission and works without JavaScript. Each button also owns its
 * own action state: sharing one would spin both buttons on either click, and show
 * a GitHub failure under the Google button.
 */

import { useActionState } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/Icons";
import { FormAlert } from "./FormFields";
import { signInWithProvider, type AuthFormState } from "@/app/auth/actions";

const PROVIDERS = [
  { id: "google", label: "المتابعة عبر Google", Icon: GoogleIcon },
  { id: "github", label: "المتابعة عبر GitHub", Icon: GitHubIcon },
] as const;

export default function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {PROVIDERS.map((provider) => (
        <ProviderButton key={provider.id} {...provider} next={next} />
      ))}
    </div>
  );
}

function ProviderButton({
  id,
  label,
  Icon,
  next,
}: {
  id: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
  next?: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    signInWithProvider,
    undefined
  );

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="provider" value={id} />
        {next && <input type="hidden" name="next" value={next} />}
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border-subtle bg-bg-panel/70 px-4 py-2.5 text-sm font-medium text-ink transition-all hover:border-border-strong hover:bg-bg-panel-soft/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink" />
          ) : (
            <Icon className="h-[18px] w-[18px] flex-shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </button>
      </form>
      <FormAlert message={state?.errors?.form} />
    </div>
  );
}
