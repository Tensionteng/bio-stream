import { request } from '../request';

// --- 1. 类型定义 (Type Definitions) ---

// 列表查询参数
export interface TaskUnitListParams {
  page?: number;
  page_size?: number;
  name?: string;
}

/** 任务单元列表中的单个条目 */
export interface TaskUnitListItem {
  id: string | number;
  name: string;
  created_time: string;
  link_file: string;
  code?: string; // 列表可能有也可能没有 code，视后端优化而定
}

/** 任务单元列表API的 data 字段 */
export interface TaskUnitListResponse {
  count: number; // 总条目数，用于分页
  task_units: TaskUnitListItem[];
}

// --- 新版详情相关的接口定义 ---

/** 输入定义中的正则匹配组 */
export interface TaskUnitInputPattern {
  name: string;
  pattern: string;
}

/** 任务单元详情 - 输入 (Updated) */
export interface TaskUnitInput {
  name: string; // 原 file_name
  description: string | null;
  multiple: boolean; // 新增：是否支持多文件
  pattern_group: TaskUnitInputPattern[]; // 新增：嵌套的正则组
}

/** 任务单元详情 - 参数 (Updated) */
export interface TaskUnitParameter {
  name: string; // 原 parameter_name
  type: string; // 原 parameter_type
  description: string | null;

  // 限制类型: "minmax" | "enum" | null
  limit: 'minmax' | 'enum' | string | null;

  min: number | null; // 原 parameter_min
  max: number | null; // 原 parameter_max
  enum: string[] | null; // 原 parameter_enum

  default: any; // 新增：默认值
}

/** 任务单元详情 - 输出 (Updated) */
export interface TaskUnitOutput {
  name: string; // 原 file_name
  description: string | null;
  template: string; // 新增：文件名模板
  per_sample: boolean; // 新增：是否逐样本生成
}

/** 任务单元详情 (完整的 data 字段) */
export interface TaskUnitDetail {
  id: number;
  name: string;
  created_time: string;
  link_file: string;
  code: string;
  input: TaskUnitInput[];
  output: TaskUnitOutput[];
  parameters: TaskUnitParameter[];
}

/** 单个文件上传后的结果项 */
export interface TaskUnitFileResult {
  file_name: string;
  status: string; // 例如 "success", "failed"
  task_unit_id: number;
  message: string;
}

/** 创建任务单元API的 data 响应类型 (修改后) */
export interface TaskUnitCreateData {
  task_unit_files: TaskUnitFileResult[];
}

// 关联检查响应
export interface RelatedTaskChainsResponse {
  task_chain: string[]; // 关联的任务链名称列表
}

// --- 2. API 请求函数 ---

/**
 * 获取任务单元列表 (支持分页和筛选) 对应: /api/task-units/list
 *
 * @param params - 查询参数 (分页, 名称)
 */
export function fetchTaskUnitList(params: TaskUnitListParams) {
  return request<TaskUnitListResponse>({
    url: '/task-units/list',
    method: 'get',
    params
  });
}

/**
 * 获取单个任务单元的详细信息 对应: /task-units/detail/{id}/
 *
 * @param id - 任务单元的ID
 */
export function fetchTaskUnitDetail(unit_id: string) {
  return request<TaskUnitDetail>({
    url: `/task-units/detail/${unit_id}`,
    method: 'get'
  });
}

/**
 * 创建一个新的任务单元 (通过上传一个或多个文件) 对应: POST /task-units/create
 *
 * @param files - 用户上传的文件数组
 */
export function createTaskUnit(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  return request<TaskUnitCreateData>({
    url: '/task-units/create',
    method: 'post',
    data: formData
  });
}

/**
 * 查询任务单元相关的任务链 对应: GET /task-units/related
 *
 * @param id - 任务单元ID
 */
export function checkRelatedTaskChains(unit_id: string | number) {
  return request<RelatedTaskChainsResponse>({
    url: `/task-units/related/${unit_id}`,
    method: 'get'
  });
}

/**
 * 删除任务单元 对应: DELETE /task-units/delete/{id}/
 *
 * @param id - 任务单元ID
 */
export function deleteTaskUnit(unit_id: string | number) {
  return request<any>({
    url: `/task-units/delete/${unit_id}`,
    method: 'delete'
  });
}
