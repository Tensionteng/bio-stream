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

/**
 * Download task result file
 *
 * @param taskId - Task ID
 * @param type - File type (txt, pdfpdf, vcf, csv, image)
 * @returns Promise resolving to axios response
 */
export function downloadTaskResult(taskId: number | string, type: Api.Visualization.FileType) {
  return request({
    url: `/visualization/tasks/download/${taskId}`,
    method: 'get',
    params: { type }
  });
}
