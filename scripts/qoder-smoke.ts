/**
 * Smoke test for `@qoder-ai/qoder-agent-sdk` runtime surface.
 *
 * Purpose (06-RESEARCH.md Open Question #1):
 *   Verify the SDK actually exposes `Query.setModel(model)` and a model-listing
 *   method at runtime on this machine. The SDK's `.d.ts` declares
 *   `getAvailableModels()` (not `getModels()` as informally referenced in
 *   RESEARCH.md / PLAN.md) — both names are tried below so the smoke check is
 *   resilient to either API shape.
 *
 * Behavior:
 *   - Exit 0 if a non-empty model list is returned.
 *   - Exit 1 if qodercli is unreachable OR the SDK throws.
 *
 * This script does NOT register an MCP server. It only spawns a qodercli
 * subprocess (if available) and exercises the control protocol surface.
 */

import { query } from "@qoder-ai/qoder-agent-sdk";

const LOG_PREFIX = "[qoder-smoke]";

async function main(): Promise<void> {
  process.stdout.write(`${LOG_PREFIX} starting smoke check\n`);
  process.stdout.write(`${LOG_PREFIX} SDK version: 1.0.3\n`);

  // Use the smallest possible auth path: local `qodercli login` state.
  // If qodercli is not on PATH or has no logged-in account, the SDK will
  // surface an `auth_not_configured` error — we still want the smoke check
  // to report the SDK surface, just exit 1.
  const auth = { type: "qodercli" as const };

  let q: ReturnType<typeof query> | undefined;
  try {
    q = query({
      prompt: "smoke",
      options: {
        auth,
        cwd: process.cwd(),
        tools: [],
      },
    });
  } catch (err) {
    process.stdout.write(
      `${LOG_PREFIX} FAILED to instantiate Query: ${(err as Error).message}\n`,
    );
    process.stdout.write(`${LOG_PREFIX} qodercli is likely unreachable\n`);
    process.exit(1);
  }

  if (!q) {
    process.stdout.write(`${LOG_PREFIX} Query returned undefined\n`);
    process.exit(1);
  }

  try {
    process.stdout.write(`${LOG_PREFIX} calling Query.setModel("default")...\n`);
    await q.setModel("default");
    process.stdout.write(`${LOG_PREFIX} setModel("default") OK\n`);

    // The SDK declares `getAvailableModels()`. RESEARCH.md / PLAN.md
    // informally references `getModels()` — try both for forward/backward
    // compatibility.
    const qAny = q as unknown as Record<string, unknown>;
    const fn =
      typeof qAny.getAvailableModels === "function"
        ? (qAny.getAvailableModels as () => Promise<unknown>)
        : typeof qAny.getModels === "function"
          ? (qAny.getModels as () => Promise<unknown>)
          : undefined;

    if (!fn) {
      process.stdout.write(
        `${LOG_PREFIX} FAILED: neither getAvailableModels nor getModels found on Query\n`,
      );
      await q.close();
      process.exit(1);
    }

    process.stdout.write(`${LOG_PREFIX} calling model listing function...\n`);
    const models = await fn();
    const count = Array.isArray(models) ? models.length : 0;
    process.stdout.write(`${LOG_PREFIX} models returned: ${count}\n`);
    if (count > 0) {
      const sample = (models as Array<Record<string, unknown>>).slice(0, 3);
      for (const m of sample) {
        process.stdout.write(
          `${LOG_PREFIX} - ${String(m.id ?? m.name ?? JSON.stringify(m))}\n`,
        );
      }
      await q.close();
      process.stdout.write(`${LOG_PREFIX} SUCCESS — exit 0\n`);
      process.exit(0);
    }

    await q.close();
    process.stdout.write(`${LOG_PREFIX} FAILED — empty model list — exit 1\n`);
    process.exit(1);
  } catch (err) {
    const msg = (err as Error).message;
    process.stdout.write(
      `${LOG_PREFIX} FAILED during runtime call: ${msg}\n`,
    );
    if (/auth_not_configured|qodercli|EACCES|ENOENT/.test(msg)) {
      process.stdout.write(
        `${LOG_PREFIX} qodercli unreachable / not authenticated — exit 1\n`,
      );
    } else {
      process.stdout.write(`${LOG_PREFIX} unexpected error — exit 1\n`);
    }
    try {
      await q.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

void main();