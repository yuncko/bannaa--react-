import test from "node:test";
import assert from "node:assert/strict";
import { decodeEvents, encodeEvent, type StreamEvent } from "../lib/stream-protocol.ts";
import { isPreviewMessage } from "../lib/preview-protocol.ts";

test("events round-trip through the NDJSON framing", () => {
  const events: StreamEvent[] = [
    { type: "meta", model: "claude-sonnet-5", isEdit: false },
    { type: "file", path: "src/App.tsx", content: "line1\nline2", done: false },
    { type: "done", project: { title: "T", description: "D", files: { "src/App.tsx": "x" } } },
  ];

  const buffer = events.map(encodeEvent).join("");
  const { events: decoded, rest } = decodeEvents(buffer);
  assert.deepEqual(decoded, events);
  assert.equal(rest, "");
});

test("a newline inside file content does not split an event", () => {
  const event: StreamEvent = {
    type: "file",
    path: "src/App.tsx",
    content: "const a = 1;\nconst b = 2;\n",
    done: true,
  };
  const { events } = decodeEvents(encodeEvent(event));
  assert.equal(events.length, 1, "JSON escaping keeps the payload on one line");
  assert.deepEqual(events[0], event);
});

test("a partial trailing line is held back for the next chunk", () => {
  const whole = encodeEvent({ type: "title", title: "Shop" });
  const cut = Math.floor(whole.length / 2);

  const first = decodeEvents(whole.slice(0, cut));
  assert.equal(first.events.length, 0);
  assert.equal(first.rest, whole.slice(0, cut));

  const second = decodeEvents(first.rest + whole.slice(cut));
  assert.deepEqual(second.events, [{ type: "title", title: "Shop" }]);
  assert.equal(second.rest, "");
});

test("a malformed line is skipped without losing the rest", () => {
  const buffer = '{"type":"title","title":"A"}\nnot json\n{"type":"title","title":"B"}\n';
  const { events } = decodeEvents(buffer);
  assert.equal(events.length, 2);
  assert.equal((events[1] as { title: string }).title, "B");
});

test("blank lines are ignored", () => {
  const { events } = decodeEvents('\n\n{"type":"title","title":"A"}\n\n');
  assert.equal(events.length, 1);
});

test("preview messages are validated on the envelope, not trusted", () => {
  assert.equal(
    isPreviewMessage({ source: "bannaa-preview", version: 1, payload: { kind: "ready", message: "ok" } }),
    true
  );
  assert.equal(isPreviewMessage(null), false);
  assert.equal(isPreviewMessage("string"), false);
  assert.equal(
    isPreviewMessage({ source: "other", version: 1, payload: { kind: "ready", message: "ok" } }),
    false,
    "messages from other frames or extensions must be rejected"
  );
  assert.equal(
    isPreviewMessage({ source: "bannaa-preview", version: 2, payload: { kind: "ready", message: "ok" } }),
    false
  );
  assert.equal(
    isPreviewMessage({ source: "bannaa-preview", version: 1, payload: { kind: "explode", message: "x" } }),
    false,
    "unknown kinds must not reach the handler"
  );
  assert.equal(
    isPreviewMessage({ source: "bannaa-preview", version: 1, payload: { kind: "error" } }),
    false,
    "a missing message would render as undefined"
  );
});
