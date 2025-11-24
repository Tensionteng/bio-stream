import { request } from '../request';

// ==========================================
//      第一部分：基础与元数据 (Meta Data)
// ==========================================

/** 文件元数据 (用于创建/更新时的下拉选择) */
export interface FileSchemaItem {
  id: number;
  name: string;
  schema_json: Record<string, any>;
}

export interface FileSchemaListResponse {
  schemas: FileSchemaItem[];
}

// ==========================================
//      第二部分：读取相关类型 (Read: List & Detail)
// ==========================================

// --- 列表 (List) ---

export interface TaskChainListParams {
  page?: number;
  page_size?: number;
  task_type?: string;
  task_id?: string;
  task_name?: string;
}

export interface TaskChainListItem {
  id: number;
  name: string;
  created_time: string;
  updated_time: string;
  nums: string; // 对应 JSON 中的 "nums" (原 unit_nums)
  type: string; // 对应 JSON 中的 "type"
}

export interface TaskChainListResponse {
  count: number;
  page: number;
  page_size: number;
  task_chains: TaskChainListItem[];
}

// --- 详情 (Detail) ---

/** 详情 - 输入文件展示 */
export interface TaskChainDetailInput {
  file_name: string | null;
  meta_id: number; // 展示时用 meta_id
  multiple: boolean;
}

/** 详情 - 输出文件展示 */
export interface TaskChainDetailOutput {
  file_name: string | null;
  meta_id: number;
  per_sample: boolean;
}

/** 详情 - 参数展示 */
export interface TaskChainDetailParameter {
  name: string;
  type: string;
  limit: string | null;
  min: number | null;
  max: number | null;
  enum: string[] | null;
  default?: any;
}

/** 详情 - 单元步骤展示 */
export interface TaskChainDetailUnit {
  id: number; // 步骤顺序
  unit_id: number; // 单元ID
  name: string;
}

/** 详情 - 完整响应结构 */
export interface TaskChainDetail {
  id: number;
  name: string;
  description?: string; // 详情可能包含描述
  type?: string;
  created_time: string;
  updated_time: string;
  unit_nums: number | string;
  units: TaskChainDetailUnit[];
  input: TaskChainDetailInput[];
  output: TaskChainDetailOutput[];
  parameters: TaskChainDetailParameter[];
}

// ==========================================
//      第三部分：写入相关类型 (Write: Create & Update)
// ==========================================

// --- 提交通用结构 (Create/Update 共用) ---

export interface TaskChainSubmitStep {
  unit_id: number; // 任务单元ID
  id: number; // 步骤顺序ID
}

export interface TaskChainSubmitInput {
  id: number; // 对应 FileSchema 的 id
  multiple: boolean;
}

export interface TaskChainSubmitOutput {
  id: number; // 对应 FileSchema 的 id
  per_sample: boolean;
}

/** 创建或更新时的 Body 参数 */
export interface TaskChainSubmitParams {
  name: string;
  description: string;
  type: string;
  task_units: TaskChainSubmitStep[];
  inputs: TaskChainSubmitInput[];
  outputs: TaskChainSubmitOutput[];
}

// --- 响应结构 ---

export interface TaskChainSubmitUnitStatus {
  unit_id: number | string;
  id: number | string;
  status: string;
  message: string;
}

/** 创建/更新 接口的响应 Data */
export interface TaskChainSubmitResponse {
  status: string; // e.g., "VALID"
  unit_status: TaskChainSubmitUnitStatus[];
}

// --- 删除 ---

export interface TaskChainDeleteResponse {
  task_chain: string;
}
/** 删除检测接口响应结构 */
export interface TaskChainDeleteCheckResponse {
  analysis: {
    id: string;
    status: string;
  }[];
  delete_flg: boolean; // true: 可删除, false: 不可删除
}
/** 检查接口的响应结构 */
export interface TaskChainCheckResponse {
  status: string; // "READY" | "WARNING" | "ERROR"
  unit_status: {
    unit_id: string;
    id: string;
    status: string;
    message: string;
  }[];
}
// ==========================================
//      第四部分：API 请求函数 (Functions)
// ==========================================

/** 1. 获取文件元类型列表 (Schema) 用于创建/更新页面的 Input/Output 下拉选项 Method: GET /files/schema */
export function fetchFileSchemaList() {
  return request<FileSchemaListResponse>({
    url: '/files/schema',
    method: 'get'
  });
}

/** 2. 获取任务链列表 Method: GET /task-chains/list/ */
export function fetchTaskChainList(params: TaskChainListParams) {
  return request<TaskChainListResponse>({
    url: '/task-chains/list',
    method: 'get',
    params
  });
}

/** 3. 获取任务链详情 Method: GET /task-chains/detail/{chain_id}/ */
export function fetchTaskChainDetail(chain_id: string | number) {
  return request<TaskChainDetail>({
    url: `/task-chains/detail/${chain_id}`,
    method: 'get'
  });
}

/** 4. 创建任务链 Method: POST /task-chains/create/ */
export function createTaskChain(payload: TaskChainSubmitParams) {
  return request<TaskChainSubmitResponse>({
    url: '/task-chains/create',
    method: 'post',
    data: payload
  });
}

/** 5. 更新任务链 Method: PATCH /task-chains/update/{chain_id}/ Note: 接收完整的配置信息 */
export function updateTaskChain(chain_id: string | number, params: TaskChainSubmitParams) {
  return request<TaskChainSubmitResponse>({
    url: `/task-chains/update/${chain_id}`,
    method: 'patch',
    data: params
  });
}

/** 6. 删除任务链 Method: DELETE /task-chains/delete/{chain_id}/ */
export function deleteTaskChain(chain_id: string | number) {
  return request<TaskChainDeleteResponse>({
    url: `/task-chains/delete/${chain_id}`,
    method: 'delete'
  });
}
/** 6. 检查任务链合法性 Method: POST /task-chains/check/ Note: 标准做法，通过 Body 传递检测参数 */
export function checkTaskChain(params: TaskChainSubmitParams) {
  return request<TaskChainCheckResponse>({
    url: '/task-chains/check',
    method: 'post',
    data: params
  });
}
/** 7. 删除前的冲突检测 Method: GET /task-chians/delete/check/{chain_id} Note: 注意文档截图 URL 中 task-chains 拼写为 task-chians，请根据实际后端情况确认 */
export function checkDeleteTaskChain(chain_id: string | number) {
  return request<TaskChainDeleteCheckResponse>({
    // 如果后端确实拼错了，这里就用错的；如果是文档笔误，建议改为 task-chains
    // 这里暂时按截图写 task-chians
    url: `/task-chains/delete/check/${chain_id}`,
    method: 'get'
  });
}
