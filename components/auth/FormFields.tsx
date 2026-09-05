"use client";

/**
 * Form primitives for the auth screens.
 *
 * Split out because the sign-in, sign-up, reset, and new-password forms all need
 * the same field chrome, error wiring, and pending state, and duplicating the
 * accessibility plumbing four times is how `aria-describedby` drifts out of sync.
 */

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckIcon, ErrorIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/auth-messages";

const FIELD_SHELL =
  "flex items-center gap-2.5 rounded-xl border border-border-subtle bg-bg-panel/70 px-3 transition-colors focus-within:border-accent/60 focus-within:bg-bg-panel-soft/70";
const FIELD_SHELL_ERROR = "border-red-400/50 focus-within:border-red-400/70";
const INPUT =
  "w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none";

interface TextFieldProps {
  name: string;
  label: string;
  type?: "text" | "email";
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  error?: string;
  icon?: React.ReactNode;
  /** Latin text in an RTL page needs its own direction or punctuation flips. */
  ltr?: boolean;
}

export function TextField({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  autoComplete,
  required,
  autoFocus,
  error,
  icon,
  ltr,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className={`${FIELD_SHELL} ${error ? FIELD_SHELL_ERROR : ""}`}>
        {icon && <span className="flex-shrink-0 text-ink-faint">{icon}</span>}
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${INPUT} ${ltr ? "dir-ltr text-start" : ""}`}
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface PasswordFieldProps {
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  icon?: React.ReactNode;
  /** Renders the strength meter and the length hint — sign-up only. */
  showStrength?: boolean;
  /** Slot for a "forgot password?" link beside the label. */
  action?: React.ReactNode;
}

export function PasswordField({
  name,
  label,
  placeholder,
  autoComplete,
  error,
  icon,
  showStrength,
  action,
}: PasswordFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");

  const strength = showStrength ? passwordStrength(value) : null;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
          {label}
        </label>
        {action}
      </div>
      <div className={`${FIELD_SHELL} ${error ? FIELD_SHELL_ERROR : ""}`}>
        {icon && <span className="flex-shrink-0 text-ink-faint">{icon}</span>}
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          onChange={showStrength ? (e) => setValue(e.target.value) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : showStrength ? hintId : undefined}
          className={`${INPUT} dir-ltr text-start`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // The label states the resulting action, which is what a screen reader
          // user needs; an "eye" icon alone says nothing about current state.
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="flex-shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:text-ink"
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>

      {strength && value.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < strength.score
                    ? strength.score <= 1
                      ? "bg-red-400/70"
                      : strength.score === 2
                        ? "bg-amber-400/70"
                        : "bg-emerald-400/70"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-ink-faint">{strength.label}</span>
        </div>
      )}

      {showStrength && !error && (
        <p id={hintId} className="mt-1.5 text-[11px] text-ink-faint">
          {MIN_PASSWORD_LENGTH} أحرف على الأقل.
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-300">
      <ErrorIcon className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  );
}

/** Form-level failure. `role="alert"` so it is announced when it appears. */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-200"
    >
      <ErrorIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Success notice, e.g. "check your inbox". */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-200"
    >
      <CheckIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Primary submit.
 *
 * Reads `useFormStatus` rather than taking a `pending` prop so it works inside
 * any form without the parent threading state down.
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-accent to-accent-deep px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-accent/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border-subtle" />
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}
