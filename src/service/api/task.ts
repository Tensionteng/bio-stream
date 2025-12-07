import { request } from '../request';

// ==========================================
// 1. 基础类型定义
// ==========================================

/** 任务状态类型 */
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/** 通用分页响应结构 */
export interface PaginatingQueryRecord<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

// ==========================================
// 2. 任务执行单元与详情相关
// ==========================================

/** 单个任务单元详情 */
export interface ExecutionUnit {
  name: string;
  description: string;
  type: string;
  start_time: string | null;
  end_time: string | null;
  status: 'success' | 'running' | 'failed' | string;
  upload_status: 'Success' | 'Running' | 'Failed' | 'Pending';
  message: string;
  result: string | null;
}

/** 流程图节点 */
export interface ExecutionFlowStep {
  name: string;
  status: string;
  message: string | null;
  /** 该步骤涉及的文件列表 */
  files: string[];
}

/** 任务详情的完整类型 */
export interface TaskDetail {
  id: number;
  /** 任务/流程名称 */
  name: string;
  /** 任务来源类型 */
  task_source_type: string;
  file_ids: number[];
  start_time: string;
  end_time: string | null;
  status: string;
  upload_status: 'Success' | 'Running' | 'Failed' | 'Pending' | string;
  total_units?: number;
  success_units?: number;
  error_summary: string | null;
  execution_flow: ExecutionFlowStep[];
  result_json: {
    process_name: string;
    total_units: number;
    success_units: number;
    execution_units: Record<string, ExecutionUnit>;
  };
}

// ==========================================
// 3. 任务列表相关 (核心修改部分)
// ==========================================

/** 任务列表项 */
export interface TaskListItem {
  id: number;
  name: string;
  task_source_type: string;
  file_ids: number[];
  file_name: string; // 注意：如果后端不再返回此字段，可移除
  start_time: string;
  end_time: string | null;
  status: TaskStatus;
  error_summary: string | null;
}

/** - 任务列表查询参数 (根据截图更新) */
export interface TaskListParams {
  page?: number;
  page_size?: number;
  /** 运行状态 */
  status?: TaskStatus;
  /** task_chain或者process名字 */
  name?: string;
  /** 任务ID */
  task_id?: number;
  /** 任务来源：只支持 process 和 task_chain */
  task_source_type?: string;
}

/** 获取任务列表 */
export function fetchTaskList(params?: TaskListParams) {
  return request<PaginatingQueryRecord<TaskListItem>>({
    url: '/analysis/processes/tasks',
    method: 'get',
    params
  });
}

// ==========================================
// 4. 任务操作相关 (中断、重启、上传)
// ==========================================

interface StopTaskResponse {
  status: string;
  message: string;
}

interface RestartTaskResponse {
  new_task_id: number;
  status: string;
  message: string;
}

export interface UploadStatusPayload {
  task_id: number;
  upload_status: 'Success' | 'Failed' | 'Running' | 'Pending';
}

/** 获取单个任务的详细信息 */
export function fetchTaskDetail(taskId: number) {
  return request<TaskDetail>({
    url: `/analysis/processes/tasks/${taskId}`,
    method: 'get'
  });
}

/** 中断一个正在运行的任务 */
export function stopTask(taskId: number) {
  return request<StopTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/stop/`,
    method: 'post'
  });
}

/** 重启一个任务 */
export function restartTask(taskId: number) {
  return request<RestartTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/restart/`,
    method: 'post'
  });
}

/** 触发任务文件重新上传 */
export function reuploadTaskFiles(taskId: number) {
  return request<UploadStatusPayload>({
    url: `/analysis/processes/tasks/${taskId}/upload/`,
    method: 'post'
  });
}

// ==========================================
// 5. 流程定义与创建相关
// ==========================================

export interface ProcessDescription {
  process_name: string;
  total_units: number;
  execution_units: ExecutionUnit[];
  execution_strategy: Record<string, any>;
}

export interface ProcessListItem {
  process_id: number;
  name: string;
  description: ProcessDescription;
}

export interface ProcessSchema {
  process_id: number;
  parameter_schema: Record<string, any>;
  input_file_type: number;
}

export interface NewTaskPayload {
  process_id: number;
  parameter_json: Record<string, any>;
}

export interface NewTaskResponse {
  task_id: number;
  status: string;
  message: string;
}

/** 获取所有可用的分析流程列表 */
export function fetchProcessList() {
  return request<ProcessListItem[]>({
    url: '/analysis/processes',
    method: 'get'
  });
}

/** 根据流程ID获取其参数的动态表单Schema */
export function fetchProcessSchema(processId: number) {
  return request<ProcessSchema>({
    url: `/analysis/processes/${processId}`,
    method: 'get'
  });
}

/** 提交并创建一个新的分析任务 */
export function createNewTask(payload: NewTaskPayload) {
  return request<NewTaskResponse>({
    url: '/analysis/processes/start',
    method: 'post',
    data: payload
  });
}

// ==========================================
// 6. 手动选择文件上传相关
// ==========================================
/** 单个文件上传项结构 */
export interface UploadMapItem {
  filed_name: string;
  file_dir: string;
}

/** 选择文件上传的 Payload (更新版) */
export interface SelectFileUploadPayload {
  /** 元文件ID */
  meta_file_id: number;
  /** 文件映射列表 */
  uploads: UploadMapItem[];
  /** 除了文件之外的其他参数 */
  content_json: Record<string, any>;
}
// 定义 API 返回的数据结构
export interface UploadTaskResponse {
  message: string;
  code: string;
}
/** 选择任务文件上传接口 */
export function uploadTaskGeneratedFiles(taskId: number, payload: SelectFileUploadPayload) {
  return request<UploadTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/file/upload`,
    method: 'post',
    data: payload
  });
}

// ==========================================
// 7. 文件 Schema 相关
// ==========================================

export interface FileSchemaItem {
  id: number;
  name: string;
  schema_json: Record<string, any>;
}

export interface FileSchemaListResponse {
  schemas: FileSchemaItem[];
}

/** 获取文件 Schema 列表 (用于 Meta File 选择) GET /files/schema */
export function fetchFileSchemaList() {
  return request<FileSchemaListResponse>({
    url: '/files/schema',
    method: 'get'
  });
} // ... (保留原有 import 和类型)

/** 任务文件清理响应 */
export interface TaskCleanupResponse {
  free_size_size: number; // 清理出的空间大小 (字节)
}

/** - 清理任务文件 DELETE /analysis/processes/tasks/{task_id}/file/delete */
export function cleanTaskFiles(taskId: number, level: number) {
  return request<TaskCleanupResponse>({
    url: `/analysis/processes/tasks/${taskId}/file/delete`,
    method: 'delete',
    data: { level } // DELETE 请求携带 Body
  });
}
/** 获取任务总占用空间响应接口 */
export interface TaskTotalSizeResponse {
  total_size: number; // 总大小，字节单位
}

/** - 获取所有任务流所占用空间大小 GET /analysis/processes/tasks/file_size */
export function fetchTotalFileSize() {
  return request<TaskTotalSizeResponse>({
    url: '/analysis/processes/tasks/file_size',
    method: 'get'
  });
}

/** 任务各级别文件占用大小响应接口 */
export interface TaskFileSizeResponse {
  size_0: number; // 对应级别 0 (彻底清理)
  size_1: number; // 对应级别 1
  size_2: number; // 对应级别 2
  size_3: number; // 对应级别 3 (清理中间文件)
  [key: string]: number; // 未来扩展
}

/** 获取指定任务各清理级别所占用的空间大小 (用于预览) GET /analysis/processes/tasks/{task_id}/file_size */
export function fetchTaskFileSize(taskId: number) {
  return request<TaskFileSizeResponse>({
    url: `/analysis/processes/tasks/${taskId}/file_size`,
    method: 'get'
  });
}
