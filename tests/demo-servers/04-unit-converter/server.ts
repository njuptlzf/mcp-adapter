import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "unit-converter", version: "1.0.0" });

server.tool("length", "Convert length units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]).describe("Source unit"),
  to: z.enum(["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toMeter: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 };
  const meters = value * toMeter[from];
  const result = meters / toMeter[to];
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("weight", "Convert weight units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["mg", "g", "kg", "lb", "oz", "ton"]).describe("Source unit"),
  to: z.enum(["mg", "g", "kg", "lb", "oz", "ton"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toKg: Record<string, number> = { mg: 0.000001, g: 0.001, kg: 1, lb: 0.453592, oz: 0.0283495, ton: 1000 };
  const kg = value * toKg[from];
  const result = kg / toKg[to];
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("temperature", "Convert temperature units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["c", "f", "k"]).describe("Source unit (c/f/k)"),
  to: z.enum(["c", "f", "k"]).describe("Target unit (c/f/k)"),
}, async ({ value, from, to }) => {
  let celsius: number;
  switch (from) { case "c": celsius = value; break; case "f": celsius = (value - 32) * 5/9; break; case "k": celsius = value - 273.15; break; }
  let result: number;
  switch (to) { case "c": result = celsius; break; case "f": result = celsius * 9/5 + 32; break; case "k": result = celsius + 273.15; break; }
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("speed", "Convert speed units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["mps", "kmh", "mph", "knot"]).describe("Source unit"),
  to: z.enum(["mps", "kmh", "mph", "knot"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toMps: Record<string, number> = { mps: 1, kmh: 1/3.6, mph: 0.44704, knot: 0.514444 };
  const mps = value * toMps[from];
  const result = mps / toMps[to];
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("area", "Convert area units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["mm2", "cm2", "m2", "km2", "in2", "ft2", "yd2", "acre", "hectare"]).describe("Source unit"),
  to: z.enum(["mm2", "cm2", "m2", "km2", "in2", "ft2", "yd2", "acre", "hectare"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toM2: Record<string, number> = { mm2: 0.000001, cm2: 0.0001, m2: 1, km2: 1000000, in2: 0.00064516, ft2: 0.092903, yd2: 0.836127, acre: 4046.86, hectare: 10000 };
  const m2 = value * toM2[from];
  const result = m2 / toM2[to];
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("volume", "Convert volume units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["ml", "l", "m3", "in3", "ft3", "gal", "qt", "pt", "cup"]).describe("Source unit"),
  to: z.enum(["ml", "l", "m3", "in3", "ft3", "gal", "qt", "pt", "cup"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toL: Record<string, number> = { ml: 0.001, l: 1, m3: 1000, in3: 0.0163871, ft3: 28.3168, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588 };
  const l = value * toL[from];
  const result = l / toL[to];
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("pressure", "Convert pressure units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["pa", "kpa", "mpa", "bar", "atm", "psi", "mmhg"]).describe("Source unit"),
  to: z.enum(["pa", "kpa", "mpa", "bar", "atm", "psi", "mmhg"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toPa: Record<string, number> = { pa: 1, kpa: 1000, mpa: 1000000, bar: 100000, atm: 101325, psi: 6894.76, mmhg: 133.322 };
  const pa = value * toPa[from];
  const result = pa / toPa[to];
  return { content: [{ type: "text", text: String(result) }] };
});

server.tool("energy", "Convert energy units", {
  value: z.number().describe("Value to convert"),
  from: z.enum(["j", "kj", "cal", "kcal", "wh", "kwh", "btu", "ev"]).describe("Source unit"),
  to: z.enum(["j", "kj", "cal", "kcal", "wh", "kwh", "btu", "ev"]).describe("Target unit"),
}, async ({ value, from, to }) => {
  const toJ: Record<string, number> = { j: 1, kj: 1000, cal: 4.184, kcal: 4184, wh: 3600, kwh: 3600000, btu: 1055.06, ev: 1.60218e-19 };
  const j = value * toJ[from];
  const result = j / toJ[to];
  return { content: [{ type: "text", text: String(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);