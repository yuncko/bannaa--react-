/**
 * The packages a generated project may import.
 *
 * This list is shared by the two sides that must agree on it: the resolver in
 * `lib/bundler.ts`, which actually satisfies the imports at runtime, and the
 * prompts in `lib/omnirouter.ts`, which tell the model what it may reach for.
 * When the two drifted apart the failure was quiet — the prompt advertised
 * recharts, date-fns, and react-router-dom, the registry had never provided
 * them, and any generated file importing one resolved to a no-op stub that
 * rendered nothing. `tests/sandbox-modules.test.ts` fails if they diverge again.
 *
 * Deliberately free of imports so both a server-only module and a test can use it.
 */
export const SANDBOX_MODULES = [
  "react",
  "react-dom",
  "lucide-react",
  "clsx",
  "class-variance-authority",
  "tailwind-merge",
  "framer-motion",
  "zustand",
] as const;

/**
 * Registry keys that exist for resolution but are not worth naming in the
 * prompt: subpath and alias spellings of an entry already listed above.
 */
export const SANDBOX_MODULE_ALIASES = ["react-dom/client", "motion"] as const;

/** Comma-separated form used inside the prompts. */
export const SANDBOX_MODULE_LIST = SANDBOX_MODULES.join(", ");
