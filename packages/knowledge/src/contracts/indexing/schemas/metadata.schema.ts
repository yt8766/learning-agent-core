import { z } from 'zod';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export const JsonObjectSchema = z.record(z.string(), z.unknown()) as z.ZodType<JsonObject>;
