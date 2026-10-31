/**
 * Pagination & Query Parameter Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 16.3
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

