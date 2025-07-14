export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidPermissionError extends StoreError {}

export class PermissionDeniedError extends StoreError {
  constructor(kind: 'read' | 'write', key: string) {
    super(`${kind} access denied for "${key}"`);
    this.kind = kind;
    this.key = key;
  }
  readonly kind: 'read' | 'write';
  readonly key: string;
}

export class PathTraversalError extends StoreError {
  constructor(msg: string, readonly path: string) {
    super(`Path error (${path}): ${msg}`);
  }
}

export class InvalidValueError extends StoreError {}

export class InvalidPathError extends StoreError {}

export function isStoreError(e: unknown): e is StoreError {
  return e instanceof StoreError;
}