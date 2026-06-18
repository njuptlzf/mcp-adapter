import { Text } from "@earendil-works/pi-tui";

export type RenderOutput = string;

export function piRenderWrapper<T extends (...args: unknown[]) => RenderOutput>(fn: T) {
  return (...args: Parameters<T>) => new Text(fn(...args), 0, 0);
}
