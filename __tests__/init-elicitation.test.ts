import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadMcpConfig: vi.fn(),
  managers: [] as any[],
}));

vi.mock("../config.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config.ts")>()),
  loadMcpConfig: mocks.loadMcpConfig,
}));

vi.mock("../server-manager.ts", () => ({
  McpServerManager: vi.fn().mockImplementation(function (this: any) {
    this.setSamplingConfig = vi.fn();
    this.setElicitationConfig = vi.fn();
    this.getConnection = vi.fn();
    this.connect = vi.fn();
    mocks.managers.push(this);
  }),
}));

vi.mock("../adapters/pi-adapter.ts", () => ({
  PiAdapter: vi.fn().mockImplementation((pi: unknown) => ({
    getFlag: pi?.getFlag?.bind(pi),
    sendMessage: pi?.sendMessage?.bind(pi),
    exec: pi?.exec?.bind(pi),
    registerTool: pi?.registerTool?.bind(pi),
    registerCommand: pi?.registerCommand?.bind(pi),
    registerFlag: pi?.registerFlag?.bind(pi),
    on: pi?.on?.bind(pi),
    getAllTools: pi?.getAllTools?.bind(pi),
  })),
}));

describe("initializeMcp elicitation config", () => {
  beforeEach(() => {
    mocks.managers.length = 0;
    mocks.loadMcpConfig.mockReturnValue({ mcpServers: {}, settings: {} });
  });

  it("enables elicitation when UI is available", async () => {
    const { initializeMcp } = await import("../init.ts");
    const ui = { form: vi.fn(), confirm: vi.fn(), notify: vi.fn() };
    const agentapi = {
      getFlag: vi.fn(),
      sendMessage: vi.fn(),
      exec: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      registerFlag: vi.fn(),
      on: vi.fn(),
      getAllTools: vi.fn(() => []),
    };

    await initializeMcp(agentapi as any, {
      cwd: "/tmp/project",
      hasUI: true,
      ui,
      modelRegistry: {},
    } as any);

    expect(mocks.managers[0].setElicitationConfig).toHaveBeenCalledWith({
      ui,
      autoOpenUrls: false,
    });
  });

  it("does not enable elicitation without UI or when disabled in settings", async () => {
    const { initializeMcp } = await import("../init.ts");
    const agentapi = {
      getFlag: vi.fn(),
      sendMessage: vi.fn(),
      exec: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      registerFlag: vi.fn(),
      on: vi.fn(),
      getAllTools: vi.fn(() => []),
    };

    await initializeMcp(agentapi as any, {
      cwd: "/tmp/project",
      hasUI: false,
      modelRegistry: {},
    } as any);
    expect(mocks.managers[0].setElicitationConfig).not.toHaveBeenCalled();

    mocks.loadMcpConfig.mockReturnValue({ mcpServers: {}, settings: { elicitation: false } });
    await initializeMcp(agentapi as any, {
      cwd: "/tmp/project",
      hasUI: true,
      ui: { form: vi.fn() },
      modelRegistry: {},
    } as any);
    expect(mocks.managers[1].setElicitationConfig).not.toHaveBeenCalled();
  });
});
