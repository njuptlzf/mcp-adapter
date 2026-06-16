import { describe, expect, it } from "vitest";
import { Text } from "@earendil-works/pi-tui";
import { piRenderWrapper, type RenderOutput } from "../adapters/pi-renderer.ts";

describe("pi renderer adapter", () => {
  it("wraps a string-returning function into a pi-tui Text", () => {
    const render = (name: string): RenderOutput => `Hello, ${name}!`;
    const wrapped = piRenderWrapper(render);
    const text = wrapped("world");

    expect(text).toBeInstanceOf(Text);
    expect(text.render(80).join("\n")).toContain("Hello, world!");
  });
});
