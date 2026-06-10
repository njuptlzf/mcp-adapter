import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function getAgentDir(): string {
  const configured = process.env.PI_CODING_AGENT_DIR?.trim();
  if (!configured) {
    return join(homedir(), ".pi", "agent");
  }
  if (configured === "~") {
    return homedir();
  }
  if (configured.startsWith("~/")) {
    return resolve(homedir(), configured.slice(2));
  }
  return resolve(configured);
}

export function getAgentPath(...segments: string[]): string {
  // Source of truth for the default Pi resolver (see interfaces/agent-paths.ts).
  return join(getAgentDir(), ...segments);
}
