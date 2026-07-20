import type { Env as WorkerEnv } from "../src";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}

    interface GlobalProps {
      mainModule: typeof import("../src");
      durableNamespaces: "GameRoom";
    }
  }
}

export {};
