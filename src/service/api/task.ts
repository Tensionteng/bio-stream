import { request } from '@/service/request';

// ==========================================
// 1. 任务列表相关
// ==========================================

/** 获取任务列表 */
export function fetchTaskList(params?: Api.Task.TaskListParams) {
  return request<Api.Task.TaskListResponse>({
    url: '/analysis/processes/tasks',
    method: 'get',
    params
  });
}

// ==========================================
// 2. 任务操作相关 (详情、中断、重启、上传)
// ==========================================

/** 获取单个任务的详细信息 */
export function fetchTaskDetail(taskId: number) {
  return request<Api.Task.TaskDetail>({
    url: `/analysis/processes/tasks/${taskId}`,
    method: 'get'
  });
}

/** 中断一个正在运行的任务 */
export function stopTask(taskId: number) {
  return request<Api.Task.StopTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/stop/`,
    method: 'post'
  });
}

/** 重启一个任务 */
export function restartTask(taskId: number) {
  return request<Api.Task.RestartTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/restart/`,
    method: 'post'
  });
}

/** 触发任务文件重新上传 */
export function reuploadTaskFiles(taskId: number) {
  return request<Api.Task.UploadStatusPayload>({
    url: `/analysis/processes/tasks/${taskId}/upload/`,
    method: 'post'
  });
}

// ==========================================
// 3. 流程定义与创建相关
// ==========================================

/** 获取所有可用的分析流程列表 */
export function fetchProcessList() {
  return request<Api.Task.ProcessListItem[]>({
    url: '/analysis/processes',
    method: 'get'
  });
}

/** 根据流程ID获取其参数的动态表单Schema */
export function fetchProcessSchema(processId: number) {
  return request<Api.Task.ProcessSchema>({
    url: `/analysis/processes/${processId}`,
    method: 'get'
  });
}

/** 提交并创建一个新的分析任务 */
export function createNewTask(payload: Api.Task.NewTaskPayload) {
  return request<Api.Task.NewTaskResponse>({
    url: '/analysis/processes/start',
    method: 'post',
    data: payload
  });
}

// ==========================================
// 4. 手动选择文件上传相关
// ==========================================

/** 选择任务文件上传接口 */
export function uploadTaskGeneratedFiles(taskId: number, payload: Api.Task.SelectFileUploadPayload) {
  return request<Api.Task.UploadTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/file/upload`,
    method: 'post',
    data: payload
  });
}

// ==========================================
// 5. 文件 Schema 相关
// ==========================================

/** 获取文件 Schema 列表 (用于 Meta File 选择) */
export function fetchFileSchemaList() {
  return request<Api.Task.FileSchemaListResponse>({
    url: '/files/schema',
    method: 'get'
  });
}

// ==========================================
// 6. 任务文件清理与空间统计
// ==========================================

/** 清理任务文件 */
export function cleanTaskFiles(taskId: number, level: number) {
  return request<Api.Task.TaskCleanupResponse>({
    url: `/analysis/processes/tasks/${taskId}/file/delete`,
    method: 'delete',
    data: { level }
  });
}

/** 获取所有任务流所占用空间大小 */
export function fetchTotalFileSize() {
  return request<Api.Task.TaskTotalSizeResponse>({
    url: '/analysis/processes/tasks/file_size',
    method: 'get'
  });
}

/** 获取指定任务各清理级别所占用的空间大小 */
export function fetchTaskFileSize(taskId: number) {
  return request<Api.Task.TaskFileSizeResponse>({
    url: `/analysis/processes/tasks/${taskId}/file_size`,
    method: 'get'
  });
}
