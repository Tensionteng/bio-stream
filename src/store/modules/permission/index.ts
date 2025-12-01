import { reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import {
  fetchApplyPermission,
  fetchPermissionRequestList,
  fetchReviewPermissionRequest,
  fetchUpdateUserPermissions,
  fetchUserPermissionList,
  fetchWithdrawPermissionRequest
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

  /** 用户当前的权限列表 */
  const currentPermissions = ref<string[]>([]);

  /** 用户的申请列表 */
  const userApplications = ref<
    {
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
    }[]
  >([]);

  /** 用户申请列表分页 */
  const userApplicationPagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  /** 所有权限申请列表（管理员） */
  const allPermissionRequests = ref<
    {
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
    }[]
  >([]);

  /** 所有权限申请分页（管理员） */
  const allRequestPagination = reactive({
    current: 1,
    size: 10,
    total: 0
  });

  /** 所有用户权限列表（管理员） */
  const allUserPermissions = ref<
    {
      user_id: number;
      user_name: string;
      permissions: {
        expire_time: string | null;
        type: Api.Permission.PermissionType;
      }[];
    }[]
  >([]);

  /** 所有用户权限分页（管理员） */
  const allUserPermissionPagination = reactive({
    current: 1,
    size: 10,
    total: 0
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

  /** 刷新用户权限信息 - 调用 auth store 的 initUserInfo */
  async function refreshUserPermissions() {
    const authModule = await import('@/store/modules/auth');
    const authStore = authModule.useAuthStore();
    await authStore.initUserInfo();
  }

  /** 1. 获取用户的申请列表 */
  async function getUserApplications(page = 1, pageSize = 10) {
    startPermissionLoading();
    try {
      const authStore = useAuthStore();
      const { data, error } = await fetchPermissionRequestList({
        page,
        page_size: pageSize,
        user: authStore.userInfo.userName
      });

      if (!error && data) {
        userApplications.value = data.result;
        userApplicationPagination.current = data.page;
        userApplicationPagination.size = data.page_size;
        userApplicationPagination.total = data.total;
      }
      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  /** 2. 获取所有权限申请列表（管理员） */
  async function getAllPermissionRequests(params?: {
    page?: number;
    pageSize?: number;
    requestType?: Api.Permission.PermissionType;
    user?: string;
    status?: Api.Permission.PermissionStatus;
  }) {
    startPermissionLoading();
    try {
      const { data, error } = await fetchPermissionRequestList({
        page: params?.page || allRequestPagination.current,
        page_size: params?.pageSize || allRequestPagination.size,
        request_type: params?.requestType,
        user: params?.user,
        status: params?.status
      });

      if (!error && data) {
        allPermissionRequests.value = data.result;
        allRequestPagination.current = data.page;
        allRequestPagination.size = data.page_size;
        allRequestPagination.total = data.total;
      }
      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  /** 3. 提交权限申请 */
  async function applyPermission(params: { type: Api.Permission.PermissionType; days: number; reason: string }) {
    startApplyLoading();
    try {
      // 检查是否已经有该权限
      if (hasPermission(params.type)) {
        window.$message?.warning('您已拥有该权限，无需重复申请');
        return false;
      }

      const { data, error } = await fetchApplyPermission(params);
      if (!error && data) {
        window.$message?.success('权限申请提交成功');
        // 刷新申请列表
        await getUserApplications();
      }
      return !error;
    } catch {
      return false;
    } finally {
      endApplyLoading();
    }
  }

  /** 4. 审批权限申请 */
  async function reviewPermissionRequest(request_id: number, action: 'APPROVE' | 'REJECT', comment?: string) {
    startReviewLoading();
    try {
      const { data, error } = await fetchReviewPermissionRequest(request_id, {
        action,
        comment
      });

      if (!error && data) {
        window.$message?.success(
          action === 'APPROVE' ? $t('page.permission.approveSuccess') : $t('page.permission.rejectSuccess')
        );
        // 刷新列表
        await getAllPermissionRequests();
        // 如果是自己的权限，刷新用户信息
        if (data.user === useAuthStore().userInfo.userName) {
          await refreshUserPermissions();
        }
      }
      return !error;
    } catch {
      return false;
    } finally {
      endReviewLoading();
    }
  }

  /** 5. 撤回申请 */
  async function withdrawApplication(request_id: number) {
    const { data, error } = await fetchWithdrawPermissionRequest(request_id);
    if (!error && data) {
      window.$message?.success('申请已撤回');
      // 刷新申请列表
      await getUserApplications();
    }
    return !error;
  }

  /** 6. 获取所有用户权限列表（管理员） */
  async function getAllUserPermissions(params?: { page?: number; pageSize?: number; user?: string }) {
    startPermissionLoading();
    try {
      const { data, error } = await fetchUserPermissionList({
        page: params?.page || allUserPermissionPagination.current,
        page_size: params?.pageSize || allUserPermissionPagination.size,
        user: params?.user
      });

      if (!error && data) {
        allUserPermissions.value = data.results;
        allUserPermissionPagination.current = data.page;
        allUserPermissionPagination.size = data.page_size;
        allUserPermissionPagination.total = data.total;
      }
      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  /** 7. 管理员更新用户权限 */
  async function updateUserPermissions(
    user_id: number,
    permissions: Array<{
      type: Api.Permission.PermissionType;
      action: 'APPROVE' | 'REJECT';
      days: number;
    }>
  ) {
    startPermissionLoading();
    try {
      const { data, error } = await fetchUpdateUserPermissions({
        user_id,
        permissions
      });

      if (!error && data) {
        // 显示详细的权限变更信息
        const successChanges = data.permissions.filter(p => p.new_status !== p.ori_status);
        if (successChanges.length > 0) {
          let htmlContent =
            '<div style="margin-bottom: 15px; font-size: 16px; font-weight: bold; color: #67C23A; text-align: center;">✅ 权限更新成功</div>';
          htmlContent +=
            '<div style="margin-bottom: 15px; font-size: 14px; color: #606266;">以下权限已成功更新：</div>';

          successChanges.forEach(change => {
            let changeType = '';
            let changeColor = '';
            let changeIcon = '';
            let changeText = '';

            if (change.ori_status === 'none' && change.new_status !== 'none') {
              changeType = '新增';
              changeColor = '#67C23A';
              changeIcon = '📌';
              changeText = `从未授权 → ${change.new_status === 'permanent' ? '永久授权' : '临时授权'}`;
            } else if (change.ori_status !== 'none' && change.new_status === 'none') {
              changeType = '删除';
              changeColor = '#F56C6C';
              changeIcon = '🗑️';
              changeText = `从${change.ori_status === 'permanent' ? '永久授权' : '临时授权'} → 撤销授权`;
            } else {
              changeType = '变更';
              changeColor = '#E6A23C';
              changeIcon = '✏️';
              changeText = `从${change.ori_status === 'permanent' ? '永久授权' : '临时授权'} → ${change.new_status === 'permanent' ? '永久授权' : '临时授权'}`;
            }

            htmlContent += `<div style="margin: 8px 0; padding: 10px 12px; background-color: ${changeColor}10; border-left: 4px solid ${changeColor}; border-radius: 4px;">`;
            htmlContent += `<div style="display: flex; align-items: center; gap: 8px;">`;
            htmlContent += `<span style="font-size: 16px;">${changeIcon}</span>`;
            htmlContent += `<div style="flex: 1;">`;
            htmlContent += `<strong style="color: ${changeColor};">${changeType}: ${change.type}</strong>`;
            htmlContent += `<div style="font-size: 13px; color: #606266; margin-top: 4px;">${changeText}</div>`;
            htmlContent += `</div></div></div>`;
          });

          await window.$messageBox?.alert('', '操作成功', {
            confirmButtonText: '确定',
            type: 'success',
            dangerouslyUseHTMLString: true,
            message: htmlContent,
            customClass: 'permission-success-dialog',
            showClose: false
          });
        } else {
          window.$message?.success('权限更新成功，但没有检测到状态变化');
        }

        // 如果修改的是当前用户，刷新权限
        if (data.user_id === Number(useAuthStore().userInfo.userId)) {
          await refreshUserPermissions();
        }

        // 刷新用户列表
        await getAllUserPermissions();
      }
      return !error;
    } catch {
      return false;
    } finally {
      endPermissionLoading();
    }
  }

  /** 导出权限数据（Excel） */
  async function exportPermissions() {
    try {
      const XLSX = await import('xlsx');

      // 准备数据
      const permissions = allUserPermissions.value;
      const requests = allPermissionRequests.value;

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 导出所有用户权限
      if (permissions.length > 0) {
        const permissionData = permissions.flatMap(user =>
          user.permissions.map(perm => ({
            用户名: user.user_name,
            用户ID: user.user_id,
            权限类型: perm.type,
            过期时间: perm.expire_time || '永久'
          }))
        );

        const permissionSheet = XLSX.utils.json_to_sheet(permissionData);
        XLSX.utils.book_append_sheet(workbook, permissionSheet, '用户权限列表');
      }

      // 导出申请记录
      if (requests.length > 0) {
        const requestData = requests.map(req => ({
          申请ID: req.request_id,
          用户名: req.user_name,
          权限类型: req.type,
          状态: req.status,
          申请时长: req.days === 0 ? '永久' : `${req.days}天`,
          申请理由: req.reason || '-',
          审批备注: req.comment || '-',
          申请时间: req.created_time,
          审批时间: req.review_time || '-',
          过期时间: req.expire_time || '-'
        }));

        const requestSheet = XLSX.utils.json_to_sheet(requestData);
        XLSX.utils.book_append_sheet(workbook, requestSheet, '申请记录');
      }

      // 如果没有数据，创建一个空sheet提示
      if (permissions.length === 0 && requests.length === 0) {
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

  return {
    // State
    currentPermissions,
    userApplications,
    userApplicationPagination,
    allPermissionRequests,
    allRequestPagination,
    allUserPermissions,
    allUserPermissionPagination,
    // Loading states
    applyLoading,
    reviewLoading,
    permissionLoading,
    // Functions
    hasPermission,
    getUserApplications,
    getAllPermissionRequests,
    applyPermission,
    reviewPermissionRequest,
    withdrawApplication,
    getAllUserPermissions,
    updateUserPermissions,
    exportPermissions,
    refreshUserPermissions
  };
});
