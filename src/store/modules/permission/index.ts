import { reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import {
  fetchAddUserPermission,
  fetchApplyPermission,
  fetchCheckPermission,
  fetchPermissionRequestList,
  fetchReviewPermissionRequest,
  fetchRevokePermission,
  fetchUpdatePermission,
  fetchUserActivePermissions,
  fetchUserPermissionHistory
} from '@/service/api';
import { SetupStoreId } from '@/enum';
import { $t } from '@/locales';
import { useAuthStore } from '../auth';

export const usePermissionStore = defineStore(SetupStoreId.Permission, () => {
  const { loading: applyLoading, startLoading: startApplyLoading, endLoading: endApplyLoading } = useLoading();
  const { loading: reviewLoading, startLoading: startReviewLoading, endLoading: endReviewLoading } = useLoading();
  const {
    loading: permissionLoading,
    startLoading: startPermissionLoading,
    endLoading: endPermissionLoading
  } = useLoading();

  /** 我的权限列表（旧） */
  const myPermissions = ref<Api.Permission.UserPermission[]>([]);

  /** 用户当前激活的权限 */
  const userActivePermissions = ref<Api.Permission.UserPermission[]>([]);

  /** 用户权限申请历史 */
  const userPermissionHistory = ref<
    {
      id: string;
      type: Api.Permission.PermissionType;
      status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'ERROR' | 'EXPIRED';
      days: number;
      reason?: string;
      comment?: string;
      create_time: string;
      review_time?: string;
      expire_time?: string;
    }[]
  >([]);

  /** 申请历史分页信息 */
  const historyPagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  /** 权限申请列表（管理员） */
  const permissionRequests = ref<Api.Permission.PermissionRequest[]>([]);

  /** 所有用户权限（管理员） */
  const allUserPermissions = ref<Api.Permission.UserPermission[]>([]);

  /** 权限申请分页信息 */
  const requestPagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  /** 用户权限分页信息 */
  const permissionPagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  /** 权限筛选条件 */
  const requestSearchParams = ref<Api.Permission.PermissionSearchParams>({
    permissionType: null,
    userName: null,
    current: 1,
    size: 10
  });

  const permissionSearchParams = ref<Api.Permission.PermissionSearchParams>({
    permissionType: null,
    userName: null,
    current: 1,
    size: 10
  });

  /** 获取我的权限 */
  async function getMyPermissions() {
    startPermissionLoading();
    try {
      // 检查是否已经有权限数据（从登录接口获取的）
      if (myPermissions.value.length > 0) {
        return true;
      }

      // 实际API调用（暂时注释掉）
      // const { data, error } = await fetchMyPermissions();
      // if (!error) {
      //   myPermissions.value = data || [];
      // }
      // return !error;

      // 如果没有数据，暂时返回 true（避免阻塞）
      return true;
    } finally {
      endPermissionLoading();
    }
  }

  /**
   * 检查权限
   *
   * @param permissionType 权限类型
   */
  async function checkPermission(permissionType: Api.Permission.PermissionType) {
    try {
      const { data, error } = await fetchCheckPermission(permissionType);
      if (!error && data) {
        return data.hasPermission;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 判断是否有指定权限
   *
   * @param permissionType 权限类型
   */
  function hasPermission(permissionType: Api.Permission.PermissionType) {
    // 先检查是否有admin权限，admin拥有所有权限
    const hasAdminPermission = myPermissions.value.some(
      perm => perm.permissionType === 'admin' && perm.status !== 'EXPIRED'
    );

    if (hasAdminPermission) {
      return true;
    }

    // 检查是否有指定权限
    return myPermissions.value.some(perm => perm.permissionType === permissionType && perm.status !== 'EXPIRED');
  }

  /** 获取权限申请列表（管理员） */
  async function getPermissionRequests(params?: {
    page?: number;
    pageSize?: number;
    requestType?: string;
    user?: string;
  }) {
    startPermissionLoading();
    try {
      const query = {
        page: params?.page || requestPagination.current,
        page_size: params?.pageSize || requestPagination.size,
        request_type: params?.requestType,
        user: params?.user
      };

      const { data, error } = await fetchPermissionRequestList(query);

      if (!error && data) {
        // 转换API响应格式为内部使用的格式
        permissionRequests.value = data.result.map(
          (item: {
            permission_id: number;
            user_id?: string;
            user_name?: string;
            type: Api.Permission.PermissionType;
            create_time: string;
            days: number;
            reason?: string;
            status: string;
            expire_time?: string;
            reviewe_time?: string;
            comment?: string;
          }) => ({
            id: item.permission_id,
            userId: item.user_id || '',
            userName: item.user_name || 'Unknown',
            permissionType: item.type,
            requestTime: item.create_time,
            days: item.days,
            reason: item.reason || '',
            status: item.status as Api.Permission.PermissionStatus,
            createBy: '',
            createTime: item.create_time,
            updateBy: '',
            updateTime: item.create_time,
            expireTime: item.expire_time,
            reviewerId: '',
            reviewerName: '',
            reviewTime: item.reviewe_time || '',
            reviewComment: item.comment || ''
          })
        );

        requestPagination.current = data.page;
        requestPagination.size = data.page_size;
        requestPagination.total = data.total;
      }

      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  /** 获取所有用户权限（管理员） */
  async function getAllUserPermissions() {
    startPermissionLoading();
    try {
      const query = {
        page: permissionPagination.current,
        page_size: permissionPagination.size,
        request_type: undefined,
        user: undefined
      };

      const { data, error } = await fetchPermissionRequestList(query);

      if (!error && data) {
        // 转换API响应格式为内部使用的格式
        allUserPermissions.value = data.result.map(
          (item: {
            permission_id: number;
            user_id?: string;
            user_name?: string;
            type: Api.Permission.PermissionType;
            create_time: string;
            days: number;
            status: string;
            expire_time?: string;
          }) => ({
            id: item.permission_id,
            userId: item.user_id || '',
            userName: item.user_name || 'Unknown',
            permissionType: item.type,
            days: item.days,
            grantedTime: item.create_time,
            expireTime: item.expire_time,
            status: item.status as Api.Permission.PermissionStatus,
            createBy: '',
            createTime: item.create_time,
            updateBy: '',
            updateTime: item.create_time
          })
        );

        permissionPagination.current = data.page;
        permissionPagination.size = data.page_size;
        permissionPagination.total = data.total;
      }

      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  /**
   * 申请权限
   *
   * @param params 权限申请参数
   */
  async function applyPermission(params: Api.Permission.PermissionApplyParams) {
    startApplyLoading();
    try {
      const { error } = await fetchApplyPermission(params);
      return !error;
    } finally {
      endApplyLoading();
    }
  }

  /**
   * 审批权限申请
   *
   * @param params 审批参数
   */
  async function reviewPermissionRequest(params: Api.Permission.PermissionReviewParams) {
    startReviewLoading();
    try {
      const { error } = await fetchReviewPermissionRequest(params);
      if (!error) {
        window.$message?.success(
          params.approve ? $t('page.permission.approveSuccess') : $t('page.permission.rejectSuccess')
        );
      }
      return !error;
    } finally {
      endReviewLoading();
    }
  }

  /**
   * 撤销权限
   *
   * @param permissionId 权限ID
   */
  async function revokePermission(permissionId: number) {
    const { error } = await fetchRevokePermission(permissionId);
    if (!error) {
      window.$message?.success($t('page.permission.revokeSuccess'));
    }
    return !error;
  }

  /** 导出权限数据（Excel） */
  async function exportPermissions() {
    try {
      const XLSX = await import('xlsx');

      // 准备所有权限数据
      const permissions = allUserPermissions.value;
      const pendingRequests = permissionRequests.value;

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 导出所有权限
      if (permissions.length > 0) {
        const permissionData = permissions.map(item => ({
          用户名: item.userName,
          权限类型: item.permissionType,
          状态: item.status,
          天数: item.days === 0 ? '永久' : item.days,
          授权时间: item.grantedTime || '-',
          过期时间: item.expireTime || '-'
        }));

        const permissionSheet = XLSX.utils.json_to_sheet(permissionData);
        XLSX.utils.book_append_sheet(workbook, permissionSheet, '所有权限');
      }

      // 导出借审批申请
      if (pendingRequests.length > 0) {
        const requestData = pendingRequests.map(item => ({
          申请人: item.userName,
          权限类型: item.permissionType,
          申请时长: item.days === 0 ? '永久' : `${item.days}天`,
          申请理由: item.reason || '-',
          申请时间: item.requestTime || item.createTime,
          状态: item.status
        }));

        const requestSheet = XLSX.utils.json_to_sheet(requestData);
        XLSX.utils.book_append_sheet(workbook, requestSheet, '待审批申请');
      }

      // 如果没有数据，创建一个空sheet提示
      if (permissions.length === 0 && pendingRequests.length === 0) {
        const emptySheet = XLSX.utils.aoa_to_sheet([['暂无数据']]);
        XLSX.utils.book_append_sheet(workbook, emptySheet, '空');
      }

      // 导出文件
      const fileName = `权限管理_${new Date().toLocaleDateString()}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      window.$message?.success('导出成功');
      return true;
    } catch {
      window.$message?.error('导出失败');
      return false;
    }
  }

  /** 更新申请筛选参数 */
  function updateRequestSearchParams(params: Api.Permission.PermissionSearchParams) {
    Object.assign(requestSearchParams.value, params);
  }

  /** 更新权限筛选参数 */
  function updatePermissionSearchParams(params: Api.Permission.PermissionSearchParams) {
    Object.assign(permissionSearchParams.value, params);
  }

  /**
   * 从登录返回的权限数据设置我的权限
   *
   * @param permissions 权限列表（字符串数组）
   */
  function setPermissionsFromLogin(permissions: string[]) {
    // 如果为 null 或 undefined 直接返回
    if (!permissions) {
      return;
    }

    // 获取当前用户信息
    const authStore = useAuthStore();
    const currentUserId = authStore.userInfo.userId;
    const currentUserName = authStore.userInfo.userName;

    // 将字符串数组转换为UserPermission数组（空数组时直接设置为空）
    const currentTime = new Date().toISOString();
    const permissionData: Api.Permission.UserPermission[] = permissions.map((perm, index) => ({
      id: index + 1,
      userId: currentUserId,
      userName: currentUserName,
      permissionType: perm as Api.Permission.PermissionType,
      days: 99999, // 永久权限
      grantedTime: currentTime,
      expireTime: '9999-12-31 23:59:59',
      status: 'ACTIVE',
      createBy: 'system',
      createTime: currentTime,
      updateBy: 'system',
      updateTime: currentTime
    }));

    myPermissions.value = permissionData;
  }

  /** 获取用户当前激活的权限 */
  async function getUserActivePermissions() {
    startPermissionLoading();
    try {
      const { data, error } = await fetchUserActivePermissions();
      if (!error && data) {
        // 转换API响应格式
        userActivePermissions.value = data.map(
          (item: {
            permission_id: number;
            type: Api.Permission.PermissionType;
            status: string;
            days: number;
            create_time: string;
            expire_time: string;
          }) => ({
            id: item.permission_id,
            userId: '',
            userName: '',
            permissionType: item.type,
            days: item.days,
            createTime: item.create_time,
            expireTime: item.expire_time,
            grantedTime: item.create_time,
            status: item.status as Api.Permission.PermissionStatus,
            createBy: '',
            updateBy: '',
            updateTime: item.create_time
          })
        );
      }
      return !error;
    } finally {
      endPermissionLoading();
    }
  }

  /**
   * 获取用户权限申请历史
   *
   * @param page 页码
   * @param pageSize 每页大小
   */
  async function getUserPermissionHistory(page = 1, pageSize = 10) {
    startPermissionLoading();
    try {
      const { data, error } = await fetchUserPermissionHistory({
        page,
        page_size: pageSize
      });

      if (!error && data) {
        userPermissionHistory.value = data.result;
        historyPagination.current = data.page;
        historyPagination.size = data.page_size;
        historyPagination.total = data.total;
      }
      return !error;
    } finally {
      endPermissionLoading();
    }
  }

  /**
   * 审批权限申请（使用新的update API）
   *
   * @param requestId 申请ID
   * @param approve 是否通过
   * @param comment 审批意见
   */
  async function reviewPermission(requestId: number, approve: boolean, comment?: string) {
    startReviewLoading();
    try {
      const { error } = await fetchUpdatePermission({
        permission_id: requestId,
        action: approve ? 'APPROVE' : 'REJECT',
        comment
      });

      if (!error) {
        window.$message?.success(approve ? $t('page.permission.approveSuccess') : $t('page.permission.rejectSuccess'));
      }
      return !error;
    } finally {
      endReviewLoading();
    }
  }

  /**
   * 添加用户权限（管理员直接添加）
   *
   * @param user 用户名
   * @param permissions 权限列表
   */
  async function addUserPermission(
    user: string,
    permissions: Array<{ type: Api.Permission.PermissionType; days: number }>
  ) {
    startPermissionLoading();
    try {
      const { data, error } = await fetchAddUserPermission({
        user,
        permissions
      });

      if (!error && data) {
        window.$message?.success($t('page.permission.addSuccess'));
      }
      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  return {
    myPermissions,
    userActivePermissions,
    userPermissionHistory,
    historyPagination,
    permissionRequests,
    allUserPermissions,
    requestPagination,
    permissionPagination,
    requestSearchParams,
    permissionSearchParams,
    applyLoading,
    reviewLoading,
    permissionLoading,
    getMyPermissions,
    checkPermission,
    hasPermission,
    getPermissionRequests,
    getAllUserPermissions,
    applyPermission,
    reviewPermissionRequest,
    revokePermission,
    exportPermissions,
    updateRequestSearchParams,
    updatePermissionSearchParams,
    setPermissionsFromLogin,
    getUserActivePermissions,
    getUserPermissionHistory,
    reviewPermission,
    addUserPermission
  };
});
