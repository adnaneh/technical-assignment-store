import { JSONArray, JSONObject, JSONPrimitive, JSONValue, isJSONPrimitive, isJSONValue } from './json-types';
import { Permission, getPermissionMetadata } from './restrict';
import { InvalidPermissionError, PermissionDeniedError, PathTraversalError, InvalidValueError, InvalidPathError } from './errors';

export { Permission, Restrict } from './restrict';
export { StoreError, InvalidPermissionError, PermissionDeniedError, PathTraversalError, InvalidValueError, InvalidPathError, isStoreError } from './errors';

export type StoreResult = Store | JSONPrimitive | JSONArray | undefined;
export type StoreValue =
  | JSONObject
  | StoreResult
  | (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export class Store implements IStore {
  private data: Record<string, StoreValue> = Object.create(null);
  constructor(public defaultPolicy: Permission = 'rw') {
    if (!['r', 'w', 'rw', 'none'].includes(defaultPolicy)) {
      throw new InvalidPermissionError(`Invalid defaultPolicy: ${defaultPolicy}`);
    }
  }

  public allowedToRead(key: string): boolean {
    const p = this.getPermissionForKey(key);
    return p === 'r' || p === 'rw';
  }

  public allowedToWrite(key: string): boolean {
    const p = this.getPermissionForKey(key);
    return p === 'w' || p === 'rw';
  }

  public read(path: string): StoreResult {
    return this.readSegments(path.split(':'), 0, this);
  }

  public write(path: string, value: StoreValue): StoreValue {
    const segments = path.split(':');
    const lastKey = segments.pop();
    const parent = this.ensurePath(segments);

    if (!(parent instanceof Store)) {
      throw new PathTraversalError('Cannot write through non‑Store path', segments.join(':'));
    }

    if (lastKey === undefined) {
      throw new InvalidPathError('Cannot write to an empty path');
    }

    if (!parent.allowedToWrite(lastKey)) {
      throw new PermissionDeniedError('write', lastKey);
    }

    parent.setField(lastKey, value);
    return value;
  }

  public readField(key: string): StoreValue {
    if (!this.allowedToRead(key)) {
      throw new PermissionDeniedError('read', key);
    }
    return this.getField(key);
  }

  public writeField(key: string, value: StoreValue): void {
    if (!this.allowedToWrite(key)) {
      throw new PermissionDeniedError('write', key);
    }
    this.setField(key, value);
  }

  public writeEntries(entries: JSONObject): void {
    for (const [k, v] of Object.entries(entries)) {
      this.write(k, v);
    }
  }

  public entries(): JSONObject {
    const out: JSONObject = {};
    
    for (const key of Object.keys(this.data)) {
      if (!this.allowedToRead(key)) continue;

      const val: StoreValue = this.getField(key);
      if (val instanceof Store) {
        out[key] = val.entries();
      } else if (typeof val !== 'function') {
        out[key] = val !== undefined ? val : null;
      }
    }
    return out;
  }

  private getPermissionForKey(key: string): Permission {
    const perm: Permission | undefined = getPermissionMetadata(this, key);
    return perm ?? this.defaultPolicy;
  }

  private ensurePath(segments: string[]): Store {
    let current: Store = this;

    for (const key of segments) {
        if (!current.allowedToRead(key)) {
          throw new PermissionDeniedError('read', key);
        }

        let nextVal: StoreValue = current.getField(key);

        if (typeof nextVal === 'function') {
          nextVal = nextVal.call(current);
          current.setField(key, nextVal);
        }

        if (nextVal === undefined) {
          if (!current.allowedToWrite(key)) {
            throw new PermissionDeniedError('write', key);
          }
          nextVal = new Store();
          current.setField(key, nextVal);
        }

        if (!(nextVal instanceof Store)) {
          if (this.isPlainJSONObject(nextVal)) {
            nextVal = this.convertPlainObjectToStore(nextVal);
            current.setField(key, nextVal);
          } else {
            throw new PathTraversalError('not a Store/object', key);
          }
        }
        current = nextVal;
    }
    return current;
  }

  private readSegments(
    segments: string[],
    index: number,
    ctx: Store
  ): StoreResult {
    if (index >= segments.length) return ctx;

    const key = segments[index];
    const next = index + 1;

    if (!ctx.allowedToRead(key)) {
      throw new PermissionDeniedError('read', key);
    }

    let value: StoreValue = ctx.getField(key);

    if (typeof value === 'function') {
      value = value.call(ctx);
      ctx.setField(key, value);
    }

    if (next === segments.length) {
      if (this.isPlainJSONObject(value)) {
        const s = this.convertPlainObjectToStore(value);
        ctx.setField(key, s);
        return s;
      }
      return value;
    }

    if (value == null) return undefined;

    if (value instanceof Store) {
      return value.readSegments(segments, next, value);
    }

    if (this.isPlainJSONObject(value)) {
      const s = this.convertPlainObjectToStore(value);
      ctx.setField(key, s);
      return s.readSegments(segments, next, s);
    }

    throw new PathTraversalError('Cannot traverse into non‑object value', key);
  }

  private convertPlainObjectToStore(obj: JSONObject): Store {
    const s = new Store();
    s.writeEntries(obj);
    return s;
  }

  private isPlainJSONObject(value: any): value is JSONObject {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Store)
    );
  }

  private static isStoreValue(x: unknown): x is StoreValue {
    if (x === undefined) return true;
    if (x instanceof Store) return true;
    if (typeof x === 'function') return true;
    if (Array.isArray(x)) return x.every(isJSONValue);
    if (typeof x === 'object' && x !== null) return isJSONValue(x);
    return isJSONPrimitive(x);
  }

  public getField(key: string): StoreValue {
    return this.data[key];
  }

  public setField(key: string, value: StoreValue): void {
    if (!Store.isStoreValue(value)) {
      throw new InvalidValueError(`Invalid value for key "${key}" - must be StoreValue`);
    }
    this.data[key] = value;
  }
}
