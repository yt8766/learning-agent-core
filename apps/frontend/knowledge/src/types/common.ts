export type ID = string;
export type ISODateTime = string;

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ApiErrorDetailValue = string | number | boolean | null | string[] | number[];

export interface ForbiddenRawProjectionKeys {
  authorization?: never;
  rawHeaders?: never;
  rawRequest?: never;
  rawResponse?: never;
  request?: never;
  response?: never;
  headers?: never;
  vendorRequest?: never;
  vendorResponse?: never;
  providerStack?: never;
  sdkError?: never;
  secret?: never;
  token?: never;
}

export type ApiErrorDetailData = Record<string, ApiErrorDetailValue> & ForbiddenRawProjectionKeys;

export interface ApiErrorDetails {
  summary?: string;
  fields?: Record<string, string> & ForbiddenRawProjectionKeys;
  data?: ApiErrorDetailData;
  itemIds?: ID[];
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: ApiErrorDetails;
  requestId?: string;
}
