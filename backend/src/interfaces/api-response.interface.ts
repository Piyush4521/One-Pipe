/**
 * Uniform API Response Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3
 */

export interface ApiResponseMeta {
  timestamp: string;
  requestId: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: ApiResponseMeta;
}

