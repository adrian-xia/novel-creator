export class HumanGateRequestedError<TContext = unknown> extends Error {
  readonly sessionId: string;
  readonly context: TContext | undefined;

  constructor(sessionId: string, context?: TContext) {
    super(`Human gate requested: ${sessionId}`);
    this.name = 'HumanGateRequestedError';
    this.sessionId = sessionId;
    this.context = context;
  }
}

export function isHumanGateRequestedError(error: unknown): error is HumanGateRequestedError<unknown> {
  return error instanceof HumanGateRequestedError;
}

export function requestHumanGate<TContext>(sessionId: string, context?: TContext): never {
  throw new HumanGateRequestedError(sessionId, context);
}
