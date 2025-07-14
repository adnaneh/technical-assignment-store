export type JSONPrimitive = string | number | boolean | null;

export type JSONValue = JSONPrimitive | JSONArray | JSONObject;

export interface JSONObject {
  [key: string]: JSONValue;
}

export type JSONArray = JSONValue[];

export function isJSONPrimitive(v: unknown): v is JSONPrimitive {
  return (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

export function isJSONValue(v: unknown): v is JSONValue {
  if (isJSONPrimitive(v)) return true;
  if (Array.isArray(v)) return v.every(isJSONValue);
  if (typeof v === 'object' && v !== null) {
    return Object.values(v).every(isJSONValue);
  }
  return false;
}
