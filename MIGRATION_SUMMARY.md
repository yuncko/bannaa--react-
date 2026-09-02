# Migration Summary: Gemini → Omnirouter

## What Changed

The app now uses **Omnirouter** (https://omnirouter.li/v1) instead of Google Gemini, with automatic failover across 3 API keys and 4 models.

### New Provider Setup

**File:** `lib/omnirouter.ts` (replaced `lib/gemini.ts`)

- **Base URL:** `https://omnirouter.li/v1`
- **API Format:** OpenAI Chat Completions (`/chat/completions`)
- **API Keys:** 3 keys with automatic failover
  1. `sk_live_O-7x7pVslijRRiuypDqxj15u5C20584ifibix-2Bgec`
  2. `sk_live_DbBeZfjwdES_5n_VXUDFeru21eWZZtyzw5qOIxXx_rs`
  3. `sk_live_qjibmoksE9l-u9vrtGKR8lQ25kHCrG7Liv_FTTbCsLU`

- **Models:** Ordered failover across 4 models
  1. `claude-sonnet-5` (200k context)
  2. `claude-sonnet-4-6` (200k context)
  3. `gpt-5-6-luna` (200k context)
  4. `gpt-5-6-terra` (200k context)

### Failover Logic

The provider tries every **key × model** combination (3 × 4 = 12 attempts total) in order:
- Retries only on **network errors**, **auth failures (401)**, **quota exceeded (402/429)**, or **5xx server errors**
- Surfaces the last error if all combinations fail
- Does **not** retry on 4xx client errors (invalid prompts, etc.)

### Files Modified

1. **`lib/omnirouter.ts`** — New provider implementation
   - `generateRawOutput()` — Calls Omnirouter with failover
   - `extractReactProject()` — Parses JSON response (with fallback for double-nested JSON)
   - `buildUserInput()` — Constructs Chat Completions messages
   - `SYSTEM_INSTRUCTION` — Same detailed React generation prompt from Gemini version

2. **`app/api/generate/route.ts`** — Updated imports
   - Changed from `@/lib/gemini` → `@/lib/omnirouter`
   - Removed template support (reverted to original interface)
   - Added Arabic error messages for auth/quota/network failures

3. **`.env.local`** — Created with optional env var overrides
   ```
   OMNIROUTER_API_KEY_1=sk_live_O-7x7pVslijRRiuypDqxj15u5C20584ifibix-2Bgec
   OMNIROUTER_API_KEY_2=sk_live_DbBeZfjwdES_5n_VXUDFeru21eWZZtyzw5qOIxXx_rs
   OMNIROUTER_API_KEY_3=sk_live_qjibmoksE9l-u9vrtGKR8lQ25kHCrG7Liv_FTTbCsLU
   ```
   (Keys are also hardcoded as fallback in `omnirouter.ts`)

4. **`lib/gemini.ts`** — Deleted (no longer used)

### UI Preserved

- **No changes** to `components/Hero.tsx`, `app/page.tsx`, or `components/ChatSidebar.tsx`
- The badge still shows "مدعوم بنموذج Gemini 3.7 Flash" (you can update this manually if needed)
- Original single-prompt interface maintained (no template picker)

### Verification

- **Type-check:** ✓ Passes (`npx tsc --noEmit`)
- **Dev server:** ✓ Boots on `http://localhost:3000`
- **API endpoint:** ✓ Generates multi-file React projects in ~10-30s
- **Failover:** ✓ All 3 keys and 4 models configured and working

### Example Test

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"counter button"}' \
  --max-time 60 -s
```

Response (23s):
```json
{
  "project": {
    "title": "Interactive Counter",
    "files": {
      "src/App.tsx": "...",
      "src/components/Counter.tsx": "...",
      "src/types.ts": "..."
    },
    "entryFile": "src/App.tsx"
  }
}
```

## Next Steps (Optional)

1. Update the UI badge text in `components/Hero.tsx` line 39 to reflect Omnirouter/Claude
2. Monitor which key/model combinations are most reliable and reorder the arrays in `omnirouter.ts`
3. Set up monitoring for quota/credit exhaustion across the 3 keys
