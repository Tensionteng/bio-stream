import { request } from '../request';

/**
 * - Get file types statistics
 *
 * @returns {Promise<Api.Home.FileTypesResponse>} Promise resolving to the file types data
 */
export function fetchFileTypes() {
  return request<Api.Home.FileTypesResponse>({
    url: '/files/count',
    method: 'get'
  });
}

export function fetchTaskStatus() {
  return request<Api.Home.TaskStatusResponse>({
    url: '/analysis/count',
    method: 'get'
  });
}

export function fetchEvents() {
  return request<Api.Home.EventsResponse>({
    url: `/events`,
    method: 'get'
  });
}
