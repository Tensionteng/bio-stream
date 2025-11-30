import { request } from '../request';

/**
 * 1. 提交权限申请 POST /permission/request
 *
 * @param params 权限申请参数 (type, days, reason)
 */
export function fetchApplyPermission(params: { type: Api.Permission.PermissionType; days: number; reason: string }) {
  return request<{
    create_time: string;
    status: Api.Permission.PermissionStatus;
    request_id: number;
  }>({
    url: '/permission/request',
    method: 'post',
    data: params
  });
}

/**
 * 2. 获取权限申请列表 GET /permission/request/list
 *
 * @param params 筛选参数 (page, page_size, request_type, user, status)
 */
export function fetchPermissionRequestList(params: {
  page: number;
  page_size: number;
  request_type?: Api.Permission.PermissionType;
  user?: string;
  status?: Api.Permission.PermissionStatus;
}) {
  return request<{
    page: number;
    page_size: number;
    total: number;
    result: {
      request_id: number;
      user_name: string;
      type: Api.Permission.PermissionType;
      status: Api.Permission.PermissionStatus;
      days: number;
      reason?: string;
      comment?: string;
      created_time: string;
      review_time?: string;
      expire_time?: string;
    }[];
  }>({
    url: '/permission/request/list',
    method: 'get',
    params
  });
}

/**
 * 3. 审批权限申请 PATCH /permission/request/{request_id}/review
 *
 * @param request_id 申请ID (path parameter)
 * @param params 审批参数 (action, comment)
 */
export function fetchReviewPermissionRequest(
  request_id: number,
  params: {
    action: 'APPROVE' | 'REJECT';
    comment?: string;
  }
) {
  return request<{
    request_id: number;
    user: string;
    type: Api.Permission.PermissionType;
    status: Api.Permission.PermissionStatus;
    created_time: string;
    review_time: string;
    expire_time: string;
  }>({
    url: `/permission/request/${request_id}/review`,
    method: 'patch',
    data: params
  });
}

/**
 * 4. 获取所有用户的权限列表（管理员） GET /permission/list
 *
 * @param params 筛选参数 (page, page_size, user)
 */
export function fetchUserPermissionList(params: { page: number; page_size: number; user?: string }) {
  return request<{
    page: number;
    page_size: number;
    total: number;
    results: {
      user_id: number;
      user_name: string;
      permissions: {
        expire_time: string | null;
        type: Api.Permission.PermissionType;
      }[];
    }[];
  }>({
    url: '/permission/list',
    method: 'get',
    params
  });
}

/**
 * 5. 管理员更新用户权限 PATCH /permission/update
 *
 * @param params 更新参数 (user_id, permissions)
 */
export function fetchUpdateUserPermissions(params: {
  user_id: number;
  permissions: Array<{
    type: Api.Permission.PermissionType;
    action: 'APPROVE' | 'REJECT';
    days: number;
  }>;
}) {
  return request<{
    user_id: number;
    permissions: Array<{
      type: Api.Permission.PermissionType;
      ori_status: 'none' | 'permanent' | 'temporary';
      new_status: 'none' | 'permanent' | 'temporary';
      message: string;
    }>;
  }>({
    url: '/permission/update',
    method: 'patch',
    data: params
  });
}

/**
 * 6. 用户撤回申请 POST /permission/request/{request_id}/withdrawn
 *
 * @param request_id 申请ID (path parameter)
 */
export function fetchWithdrawPermissionRequest(request_id: number) {
  return request<{
    request_id: number;
    status: Api.Permission.PermissionStatus;
    withdrawn_time: string;
  }>({
    url: `/permission/request/${request_id}/withdrawn`,
    method: 'post'
  });
}

/** 获取用户当前激活的权限 (保留，可能用于其他用途) GET /permission/active */
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

/** 添加用户权限（管理员直接添加） - 旧接口，保留兼容 */
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

/** 撤销权限（管理员） - 旧接口，保留兼容 */
export function fetchRevokePermission(permissionId: number) {
  return request<boolean>({
    url: `/permission/revoke/${permissionId}`,
    method: 'delete'
  });
}
