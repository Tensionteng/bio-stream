import { reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import {
  fetchAddUserPermission,
  fetchApplyPermission,
  fetchPermissionRequestList,
  fetchReviewPermissionRequest,
  fetchRevokePermission,
  fetchUpdatePermission,
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

  /** 判断用户是否有指定权限 - 直接从 auth store 读取权限数据 */
  function hasPermission(permissionType: Api.Permission.PermissionType): boolean {
    const authStore = useAuthStore();
    const permissions = authStore.userInfo.permissions;

    // admin 拥有所有权限
    if (permissions.includes('admin')) {
      return true;
    }

    return permissions.includes(permissionType);
  }

  /** 在权限被管理员更新后，刷新用户权限信息 - 调用 auth store 的 initUserInfo */
  async function refreshUserPermissions() {
    const authModule = await import('@/store/modules/auth');
    const authStore = authModule.useAuthStore();
    await authStore.initUserInfo(); // 刷新用户信息，包含最新权限
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

  /** 申请权限 */
  async function applyPermission(params: Api.Permission.PermissionApplyParams) {
    startApplyLoading();
    try {
      const { error } = await fetchApplyPermission(params);
      return !error;
    } finally {
      endApplyLoading();
    }
  }

  /** 审批权限申请 */
  async function reviewPermissionRequest(params: Api.Permission.PermissionReviewParams) {
    startReviewLoading();
    try {
      const { error } = await fetchReviewPermissionRequest(params);
      if (!error) {
        window.$message?.success(
          params.approve ? $t('page.permission.approveSuccess') : $t('page.permission.rejectSuccess')
        );
        // 权限审批后刷新用户信息
        await refreshUserPermissions();
      }
      return !error;
    } finally {
      endReviewLoading();
    }
  }

  /** 撤销权限 */
  async function revokePermission(permissionId: number) {
    const { error } = await fetchRevokePermission(permissionId);
    if (!error) {
      window.$message?.success($t('page.permission.revokeSuccess'));
      // 撤销权限后刷新用户信息
      await refreshUserPermissions();
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

  /** 获取用户权限申请历史 */
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

  /** 审批权限申请（使用新的update API） */
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

  /** 添加用户权限（管理员直接添加） */
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
        // 如果添加的是当前用户的权限，刷新用户信息和权限列表
        const authStore = useAuthStore();
        if (user === authStore.userInfo.userName) {
          await refreshUserPermissions();
        }
        // 刷新权限列表视图
        await getAllUserPermissions();
      }
      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  return {
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
    hasPermission,
    getPermissionRequests,
    getAllUserPermissions,
    applyPermission,
    reviewPermissionRequest,
    revokePermission,
    exportPermissions,
    updateRequestSearchParams,
    updatePermissionSearchParams,
    getUserPermissionHistory,
    reviewPermission,
    addUserPermission
  };
});
