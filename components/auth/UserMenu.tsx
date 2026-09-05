"use client";

/**
 * Account chip for the app shell.
 *
 * Renders the signed-in user with a dropdown, or a sign-in call to action when
 * `user` is null. The user is resolved on the server and passed in as a prop —
 * the page shell is a client component, so it cannot read the session itself.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { userInitial, userLabel, type AuthUser } from "@/lib/auth-user";
import { LockIcon, LogOutIcon, UserIcon } from "@/components/Icons";

interface UserMenuProps {
  user: AuthUser | null;
  /** `compact` drops the name, for the narrow sidebar header. */
  variant?: "default" | "compact";
}

export default function UserMenu({ user, variant = "default" }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        {variant === "default" && (
          <Link
            href="/login"
            className="rounded-lg px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            تسجيل الدخول
          </Link>
        )}
        <Link
          href="/signup"
          className="rounded-lg border border-border-subtle bg-bg-panel/60 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
        >
          {variant === "compact" ? "دخول" : "إنشاء حساب"}
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 py-1 pe-2.5 ps-1 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
      >
        <Avatar user={user} />
        {variant === "default" && (
          <span className="max-w-[9rem] truncate">{userLabel(user)}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated shadow-2xl shadow-black/60"
        >
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-3">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{userLabel(user)}</p>
              {user.email && (
                <p className="dir-ltr truncate text-start text-[11px] text-ink-faint">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <MenuLink href="/account" icon={<UserIcon className="h-3.5 w-3.5" />}>
            حسابي
          </MenuLink>
          <MenuLink href="/account/password" icon={<LockIcon className="h-3.5 w-3.5" />}>
            تغيير كلمة المرور
          </MenuLink>

          <form action={signOut} className="border-t border-border-subtle">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-ink-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              تسجيل الخروج
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, size = "sm" }: { user: AuthUser; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[11px]";

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar hosts differ per OAuth provider; next/image would need each one allow-listed in next.config.
      <img
        src={user.avatarUrl}
        alt=""
        className={`${box} flex-shrink-0 rounded-full border border-border-subtle object-cover`}
      />
    );
  }

  return (
    <span
      className={`${box} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep font-bold text-white`}
    >
      {userInitial(user)}
    </span>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-3 py-2.5 text-xs text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink"
    >
      {icon}
      {children}
    </Link>
  );
}
