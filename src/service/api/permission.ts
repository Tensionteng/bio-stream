import { request } from '../request';

/**
 * 请求权限
 *
 * @param params 权限申请参数
 */
export function fetchApplyPermission(params: Api.Permission.PermissionApplyParams) {
  return request<boolean>({
    url: '/permission/request',
    method: 'post',
    data: params
  });
}

/** 获取我的权限列表（旧接口，已废弃） */
export function fetchMyPermissions() {
  return request<Api.Permission.UserPermission[]>({
    url: '/permission/my',
    method: 'get'
  });
}

/**
 * 检查是否有指定权限
 *
 * @param permissionType 权限类型
 */
export function fetchCheckPermission(permissionType: Api.Permission.PermissionType) {
  return request<{ hasPermission: boolean; message?: string }>({
    url: '/permission/check',
    method: 'get',
    params: { permissionType }
  });
}

/**
 * 获取权限申请列表（管理员） GET /permission/request/list?page=1&page_size=10&request_type=PENDING&user=xxx
 *
 * @param params 筛选参数
 */
export function fetchPermissionRequestList(params: {
  page: number;
  page_size: number;
  request_type?: string;
  user?: string;
}) {
  return request<{
    result: {
      permission_id: number;
      type: Api.Permission.PermissionType;
      days: number;
      status: string;
      reason?: string;
      comment?: string;
      create_time: string;
      reviewe_time?: string;
      expire_time?: string;
      user_id?: string;
      user_name?: string;
    }[];
    count: number;
    page: number;
    page_size: number;
    total: number;
  }>({
    url: '/permission/request/list',
    method: 'get',
    params
  });
}

/**
 * 审批权限申请（管理员）
 *
 * @param params 审批参数
 */
export function fetchReviewPermissionRequest(params: Api.Permission.PermissionReviewParams) {
  return request<boolean>({
    url: '/permission/review',
    method: 'post',
    data: params
  });
}

/**
 * 撤销权限（管理员）
 *
 * @param permissionId 权限ID
 */
export function fetchRevokePermission(permissionId: number) {
  return request<boolean>({
    url: `/permission/revoke/${permissionId}`,
    method: 'delete'
  });
}

/** 获取用户当前激活的权限 GET /permission/active 返回: 权限详情数组（包含过期时间等信息） */
export function fetchUserActivePermissions() {
  return request<
    Array<{
      permission_id: number;
      type: Api.Permission.PermissionType;
      status: string;
      days: number;
      create_time: string;
      expire_time: string;
    }>
  >({
    url: '/permission/active',
    method: 'get'
  });
}

/** 获取用户权限申请历史（分页） GET /permission/list?page=1&page_size=10 返回分页的申请历史记录 */
export function fetchUserPermissionHistory(params: { page: number; page_size: number }) {
  return request<{
    result: {
      id: string;
      type: Api.Permission.PermissionType;
      status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'ERROR';
      days: number;
      reason?: string;
      comment?: string;
      create_time: string;
      review_time?: string;
      expire_time?: string;
    }[];
    page: number;
    page_size: number;
    total: number;
  }>({
    url: '/permission/list',
    method: 'get',
    params
  });
}

/**
 * 更新权限状态（审批） PATCH /permission/update
 *
 * @param params 更新参数
 */
export function fetchUpdatePermission(params: {
  permission_id: number;
  action: 'APPROVE' | 'REJECT';
  comment?: string;
}) {
  return request<{
    permission_id: number;
    expire_time?: string;
    status: string;
  }>({
    url: '/permission/update',
    method: 'patch',
    data: params
  });
}

/**
 * 添加用户权限（管理员直接添加） POST /permission/add
 *
 * @param params 添加参数
 */
export function fetchAddUserPermission(params: {
  user: string;
  permissions: Array<{
    type: Api.Permission.PermissionType;
    days: number;
  }>;
}) {
  return request<{
    user: string;
    permissions: Array<{
      type: Api.Permission.PermissionType;
      status: string;
      create_time: string;
      review_time?: string;
      expire_time?: string;
    }>;
  }>({
    url: '/permission/add',
    method: 'post',
    data: params
  });
}
