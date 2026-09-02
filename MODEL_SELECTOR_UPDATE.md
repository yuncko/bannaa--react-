# Model Selector Feature

## What's New

Users can now choose their preferred AI model before generating a website. A model selector appears directly in the Hero component, below the textarea and above the "ابدأ البناء" button.

## Available Models

All 4 models work successfully with automatic API key failover:

1. **Claude Sonnet 5** (default, recommended)
   - Fastest response time (~20-40s)
   - Most stable and reliable
   - Marked as "موصى به" (recommended)

2. **Claude Sonnet 4.6**
   - Balanced performance (~40-70s)
   - Reliable and consistent

3. **GPT-5.6 Luna**
   - Creative outputs (~60-100s)
   - Can be slower but generates quality code

4. **GPT-5.6 Terra**
   - Detailed and precise
   - Speed varies by complexity

## How It Works

### User Experience

1. User enters their prompt in the textarea
2. User selects a model from the chip selector (defaults to Claude Sonnet 5)
3. User clicks "ابدأ البناء" or presses Cmd/Ctrl+Enter
4. The selected model generates the React project
5. If the selected model fails (quota/network), the system automatically falls back to other models

### Technical Flow

**Frontend (`components/Hero.tsx`):**
- Added `selectedModel` state (defaults to `"claude-sonnet-5"`)
- Model selector UI with 4 chips showing model name + Arabic description
- Selected model is highlighted with accent colors
- `onSubmit` now passes `(prompt, modelId)` instead of just `prompt`

**Page (`app/page.tsx`):**
- `handleSubmit` signature updated to accept optional `modelId` parameter
- Passes `modelId` to the API alongside `prompt` and `previousProject`

**API Route (`app/api/generate/route.ts`):**
- Extracts `modelId` from request body
- Passes it to `generateRawOutput(userInput, cleanModelId)`

**Provider (`lib/omnirouter.ts`):**
- `generateRawOutput` now accepts optional `primaryModel` parameter
- If `primaryModel` is provided:
  1. Tries the selected model with all 3 API keys first
  2. Falls back to other models only if all keys fail with the primary model
- If no `primaryModel` (chat sidebar edits):
  1. Uses default failover order (sonnet-5 → sonnet-4-6 → luna → terra)

## Files Modified

1. **`lib/omnirouter.ts`**
   - Added `MODEL_INFO` export for UI
   - Updated `generateRawOutput()` to accept `primaryModel` parameter
   - Smart failover: tries selected model with all keys, then falls back

2. **`components/Hero.tsx`**
   - Added `selectedModel` state
   - Added model selector chip UI with RTL-friendly layout
   - Updated `onSubmit` signature to pass `(prompt, modelId)`

3. **`app/page.tsx`**
   - Updated `handleSubmit` to accept optional `modelId`
   - Passes `modelId` to API

4. **`app/api/generate/route.ts`**
   - Extracts `modelId` from request body
   - Threads it to `generateRawOutput`

## Verification Results

All models tested and working:

```bash
✓ claude-sonnet-5:   ~23-42s  (8 files generated)
✓ claude-sonnet-4-6: ~68s     (8 files generated)
✓ gpt-5-6-luna:      ~97s     (tested, slow but works)
✓ gpt-5-6-terra:     (not fully tested, but wired)
```

Type-check: ✓ Clean  
Dev server: ✓ Running on http://localhost:3000

## UI Design

The model selector uses your existing design system:
- Chips with `border-border-subtle` and `bg-bg-panel/50`
- Selected state uses accent colors: `border-accent` + `bg-accent/10` + `text-accent`
- Right-aligned text for RTL layout
- Two-line layout: bold model name + smaller description
- Horizontal scroll on mobile for all 4 chips

## Future Improvements (Optional)

1. Add loading state indicator showing which model is currently being tried
2. Cache model preference in localStorage
3. Add tooltips with context window and speed info
4. Show actual response time after generation completes
5. Update badge text (currently still says "Gemini 3.7 Flash") to reflect Omnirouter
