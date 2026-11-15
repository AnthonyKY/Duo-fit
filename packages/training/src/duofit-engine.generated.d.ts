// Types for the generated copy of DUOFIT's engine (plain JavaScript). The typed API is in index.ts.
export declare const DUOFIT_VERSION: string;
export interface EngineHost { S: unknown; U: Record<string, unknown>; save: () => boolean; setTimeout: (fn: () => void, ms?: number) => unknown }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare function createEngine(host: EngineHost): Record<string, any>;
