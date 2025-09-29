import { request } from '../request';

/** 任务状态类型 */
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/** 单个任务单元详情 */
export interface ExecutionUnit {
  /** 单元名称 */
  name: string;

  /** 详细描述 */
  description: string;

  /** 单元类型, 例如 'python' */
  type: string;

  /** 开始时间 (ISO 格式字符串)，可能为 null */
  start_time: string | null;

  /** 结束时间 (ISO 格式字符串)，任务运行时为 null */
  end_time: string | null;

  /** 运行状态 (例如: "success", "running", "failed") */
  status: 'success' | 'running' | 'failed' | string; // 使用联合类型来增强类型安全

  upload_status: 'Success' | 'Running' | 'Failed' | 'Pending';

  /** 附带信息，成功或失败都可能有内容 */
  message: string;

  /** 结果代码，例如 "0000" 代表成功 */
  result: string | null;
}

// 任务详情的完整类型
export interface TaskDetail {
  id: number;
  process_name: string;
  file_ids: number[];
  start_time: string;
  end_time: string | null;
  status: string; // "running", "success", "failed"
  upload_status: 'Success' | 'Running' | 'Failed' | 'Pending';
  total_units?: number;
  success_units?: number;
  error_summary: string | null;
  execution_flow: ExecutionFlowStep[];
  result_json: {
    process_name: string;
    total_units: number;
    success_units: number;
    execution_units: Record<string, ExecutionUnit>; // 使用 Record<string, T> 表示一个对象/字典
  };
}
// 流程图节点
export interface ExecutionFlowStep {
  name: string;
  status: string;
  message: string | null;
}
export interface PaginatingQueryRecord<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}
/** 任务列表项 */
export interface TaskListItem {
  id: number;
  process_name: string;
  file_ids: number[];
  file_name: string;
  start_time: string;
  end_time: string | null;
  status: TaskStatus;
  error_summary: string | null;
}
/** 中断任务API的响应数据类型 */
interface StopTaskResponse {
  /** 任务被中断后的新状态，例如 'CANCELLED' */
  status: string;

  /** 操作结果的提示信息，例如 '任务已成功中断' */
  message: string;
}
/** 重启任务API的响应数据类型 */
interface RestartTaskResponse {
  /** 新创建的任务的ID */
  new_task_id: number;

  /** 新任务的初始状态，例如 'PENDING' */
  status: string;

  /** 操作结果的提示信息，例如 '任务已成功重新提交' */
  message: string;
}

/** 自定义任务列表查询参数 */
export interface TaskListParams {
  page?: number;
  page_size?: number;
  status?: TaskStatus;
}

/**
 * 获取任务列表
 *
 * @param params - 查询参数
 */
export function fetchTaskList(params?: TaskListParams) {
  return request<PaginatingQueryRecord<TaskListItem>>({
    url: '/analysis/processes/tasks',
    method: 'get',
    params
  });
}

/**
 * 获取单个任务的详细信息
 *
 * @param taskId - 任务ID
 */
export function fetchTaskDetail(taskId: number) {
  return request<TaskDetail>({
    url: `/analysis/processes/tasks/${taskId}/`,
    method: 'get'
  });
}

/**
 * 中断一个正在运行的任务
 *
 * @param taskId - 任务ID
 */
export function stopTask(taskId: number) {
  return request<StopTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/stop/`,
    method: 'post'
  });
}

/**
 * 重启一个任务
 *
 * @param taskId - 任务ID
 */
export function restartTask(taskId: number) {
  return request<RestartTaskResponse>({
    url: `/analysis/processes/tasks/${taskId}/restart/`,
    method: 'post'
  });
}
export interface ProcessDescription {
  process_name: string;
  total_units: number;
  execution_units: ExecutionUnit[];
  // execution_strategy 可以根据需要添加更详细的类型
  execution_strategy: Record<string, any>;
}

// 修改：更新 ProcessListItem 类型
export interface ProcessListItem {
  process_id: number;
  name: string; // 这是外层的流程名
  description: ProcessDescription; // description 现在是一个复杂的对象
}

/** 流程的参数结构（Schema） */
export interface ProcessSchema {
  /** 流程的唯一ID */
  process_id: number;

  /** - 参数的JSON Schema定义。 这是一个动态对象，键是参数名，值可以是其默认值或更复杂的结构。 例如：{ "star_threads": 10, "referenceFiles": [{ "file_id": 0 }] } */
  parameter_schema: Record<string, any>;

  /** 输入文件类型 */
  input_file_type: number;
}

/** 创建新任务时需要提交的数据负载 */
export interface NewTaskPayload {
  /** 要执行的流程ID */
  process_id: number;

  /** 根据 parameter_schema 填充的参数JSON对象 */
  parameter_json: Record<string, any>;
}

/** 创建新任务API的响应数据类型 */
export interface NewTaskResponse {
  /** 新创建的任务的ID */
  new_task_id: number;

  /** 新任务的初始状态，例如 'PENDING' */
  status: string;

  /** 操作结果的提示信息，例如 '任务已成功提交' */
  message: string;
}
/**
 * 获取所有可用的分析流程列表
 *
 * 用于填充“新建任务”页面的流程选择下拉框。
 */
export function fetchProcessList() {
  return request<ProcessListItem[]>({
    url: '/analysis/processes',
    method: 'get'
  });
}

/**
 * 根据流程ID获取其参数的动态表单Schema
 *
 * @param processId - 流程的ID
 */
export function fetchProcessSchema(processId: number) {
  return request<ProcessSchema>({
    url: `/analysis/processes/${processId}`,
    method: 'get'
  });
}

/**
 * 提交并创建一个新的分析任务
 *
 * @param payload - 创建新任务所需的数据
 */
export function createNewTask(payload: NewTaskPayload) {
  return request<NewTaskResponse>({
    url: '/analysis/processes/start',
    method: 'post',
    data: payload
  });
}
/** 定义文件上传状态的数据格式 'upload_status' 使用联合类型来约束可能的取值 */
export interface UploadStatusPayload {
  task_id: number;
  upload_status: 'Success' | 'Failed' | 'Running' | 'Pending'; // 定义所有可能的状态
}
export function reuploadTaskFiles(taskId: number) {
  return request<UploadStatusPayload>({
    url: `/analysis/processes/tasks/${taskId}/upload/`,
    method: 'post'
  });
}
