export class AdapterError extends Error {
  readonly adapterName: string;
  readonly cause?: unknown;

  constructor(adapterName: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'AdapterError';
    this.adapterName = adapterName;
    this.cause = cause;
  }
}
