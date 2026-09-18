import type { EngineAnswer, EngineId } from "@proofseen/core";
import type { Sleep, Transport } from "./http";

export interface AdapterConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly transport: Transport;
  readonly sleep?: Sleep;
}

/** One draw = one recruiter-style prompt sent once. The prompt never contains the client's identity. */
export interface EngineAdapter {
  readonly id: EngineId;
  runDraw(prompt: string): Promise<EngineAnswer>;
}

export class EngineResponseError extends Error {
  constructor(engine: EngineId, reason: string) {
    super(`${engine}: ${reason}`);
    this.name = "EngineResponseError";
  }
}
