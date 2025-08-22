import { request } from '../request';

/**
 * - Get visualization task
 *
 * @returns {Promise<Api.Visualization.TaskInfo>} Promise resolving to the task data
 */
export function fetchTaskInfo() {
  return request<Api.Visualization.TaskInfo[]>({
    url: '/visualization/tasks',
    method: 'get'
  });
}

export function fetchTaskResult(taskId: string, fileType: Api.Visualization.FileType) {
  return request<Api.Visualization.Result>({
    url: `/visualization/tasks/${taskId}/`,
    method: 'get',
    params: {
      file_type: fileType
    }
  });
}

/** Get visualization config */
export function fetchVisualizationConfig() {
  return request<Api.Visualization.ConfigInfo>({
    url: '/visualization/config',
    method: 'get'
  });
}
