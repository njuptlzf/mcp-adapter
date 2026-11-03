import { describe, expect, it } from "vitest";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import { terminalHyperlink } from "../utils.ts";

describe("terminalHyperlink", () => {
  it("preserves the visible URL and its encoded query parameters", () => {
    const url = "https://auth.example.com/authorize?state=a%2Fb&scope=read%20write";
    const link = terminalHyperlink(url, url);

    expect(stripTerminalSequences(link)).toBe(url);
    expect(link).toBe(`\u001B]8;;${url}\u001B\\${url}\u001B]8;;\u001B\\`);
  });

  it("removes injected terminal controls from the label and destination", () => {
    const url = "https://auth.example.com/authorize";
    const link = terminalHyperlink(
      "\u001B]8;;https://other.example.com\u001B\\Sign in\u001B]8;;\u001B\\\n\u001B[31mnow",
      `${url}\u0007\u001B]52;c;payload\u0007`,
    );

    expect(link).toBe(`\u001B]8;;${url}\u001B\\Sign in now\u001B]8;;\u001B\\`);
  });
});
