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
import {
  SOLD_OUT_LABEL,
  balanceState,
  formatMoney,
  type WalletView,
} from "@/lib/billing";
import { LockIcon, LogOutIcon, UserIcon, WalletIcon } from "@/components/Icons";
import BalancePill from "@/components/billing/BalancePill";

interface UserMenuProps {
  user: AuthUser | null;
  /** Null when Supabase is unconfigured or the wallet could not be read. */
  wallet?: WalletView | null;
  /** `compact` drops the name, for the narrow sidebar header. */
  variant?: "default" | "compact";
}

export default function UserMenu({ user, wallet = null, variant = "default" }: UserMenuProps) {
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
    <div ref={rootRef} className="relative flex items-center gap-2">
      {/* Outside the dropdown on purpose: a balance you have to open a menu to see
          is a balance that runs out by surprise. */}
      {wallet && <BalancePill balanceCents={wallet.balanceCents} />}

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

          {wallet && <WalletRow wallet={wallet} />}

          <MenuLink href="/account" icon={<UserIcon className="h-3.5 w-3.5" />}>
            حسابي
          </MenuLink>
          <MenuLink href="/pricing" icon={<WalletIcon className="h-3.5 w-3.5" />}>
            الخطط والرصيد
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

/**
 * Balance line inside the dropdown.
 *
 * Repeats the number the pill already shows, because the pill is a glance and this
 * is the place that says what to do about it.
 */
function WalletRow({ wallet }: { wallet: WalletView }) {
  const empty = balanceState(wallet.balanceCents) === "empty";

  return (
    <div className="border-b border-border-subtle px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">الرصيد المتاح</span>
        {empty ? (
          <span className="dir-ltr rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-red-300">
            {SOLD_OUT_LABEL}
          </span>
        ) : (
          <span className="dir-ltr text-xs font-bold text-ink">
            {formatMoney(wallet.balanceCents)}
          </span>
        )}
      </div>
      {empty && (
        <Link
          href="/pricing"
          className="mt-2 block rounded-lg bg-gradient-to-l from-accent to-accent-deep px-2.5 py-1.5 text-center text-[11px] font-bold text-white transition-opacity hover:opacity-90"
        >
          اشترك لمتابعة البناء
        </Link>
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
