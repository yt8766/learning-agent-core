import { __CAMEL_NAME__Schema, type __PASCAL_NAME__Record } from './schemas/__NAME__.schema.ts';

export interface Create__PASCAL_NAME__Input {
  id: string;
  label: string;
}

export function create__PASCAL_NAME__(input: Create__PASCAL_NAME__Input): __PASCAL_NAME__Record {
  return __CAMEL_NAME__Schema.parse(input);
}

export { __CAMEL_NAME__Schema };
export type { __PASCAL_NAME__Record };
