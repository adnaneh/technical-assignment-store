import 'reflect-metadata';
import { InvalidPermissionError } from './errors';
import { Store, StoreValue } from './store';

export type Permission = 'r' | 'w' | 'rw' | 'none';

const META_KEY = Symbol('store:permission');

export function Restrict<
  K extends string,
  V extends StoreValue
>(permission: Permission = 'none') {
  return function <
    T extends Store & Record<K, V>
  >(target: T, propertyKey: K): void {

    if (!['r', 'w', 'rw', 'none'].includes(permission)) {
      throw new InvalidPermissionError(`Invalid permission: ${permission}`);
    }

    Reflect.defineMetadata(META_KEY, permission, target, propertyKey);

    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: true,
      get(this: Store) {
        return this.getField(propertyKey);
      },
      set(this: Store, value: V) {
        this.setField(propertyKey, value);
      }
    });
  };
}

export function getPermissionMetadata(target: any, key: string): Permission | undefined {
  return Reflect.getMetadata(META_KEY, target, key);
}