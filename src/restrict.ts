import 'reflect-metadata';
import { InvalidPermissionError } from './errors';

export type Permission = 'r' | 'w' | 'rw' | 'none';

const META_KEY = Symbol('store:permission');

export function Restrict(permission: Permission = 'none'): PropertyDecorator {
  if (!['r', 'w', 'rw', 'none'].includes(permission)) {
    throw new InvalidPermissionError(`Invalid permission: ${permission}`);
  }

  return (target: object, propertyKey: string | symbol): void => {
    Reflect.defineMetadata(META_KEY, permission, target, propertyKey);
  };
}

export function getPermissionMetadata(target: any, key: string): Permission | undefined {
  return Reflect.getMetadata(META_KEY, target, key);
}