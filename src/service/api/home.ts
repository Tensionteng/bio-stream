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
/* 添加新的 API 请求 */
export function fetchSampleSource() {
  return request<Api.Home.SampleStatResponse>({
    url: '/sample/source',
    method: 'get'
  });
}
export function fetchSampleTissue() {
  return request<Api.Home.SampleStatResponse>({
    url: '/sample/tissue',
    method: 'get'
  });
}
export function fetchSampleSex() {
  return request<Api.Home.SampleStatResponse>({
    url: '/sample/sex',
    method: 'get'
  });
}
export function fetchSampleDisease() {
  return request<Api.Home.SampleStatResponse>({
    url: '/sample/disease',
    method: 'get'
  });
}
export function fetchSampleGenomics() {
  return request<Api.Home.SampleStatResponse>({
    url: '/sample/genomics',
    method: 'get'
  });
}
export function fetchSampleAge() {
  return request<Api.Home.AgeStatResponse>({
    url: '/sample/age',
    method: 'get'
  });
}
