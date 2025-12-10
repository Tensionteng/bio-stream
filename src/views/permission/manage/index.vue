<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { CheckboxValueType } from 'element-plus';
import { usePermissionStore } from '@/store/modules/permission';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

const router = useRouter();
const permissionStore = usePermissionStore();
const authStore = useAuthStore();

// 检查是否是管理员（只有拥有admin权限才能访问）
const isAdmin = computed(() => {
  return authStore.userInfo.permissions.includes('admin');
});

// 筛选条件
const requestSearchForm = ref<{
  permissionType: Api.Permission.PermissionType | '';
  userName: string;
  status: Api.Permission.PermissionStatus | '';
}>({
  permissionType: '',
  userName: '',
  status: ''
});

// 如果不是管理员，跳转到我的权限页面
onMounted(() => {
  if (!isAdmin.value) {
    window.$message?.warning('您没有权限访问此页面');
    router.push('/permission/my');
    return;
  }
  // 默认加载待审批申请
  requestSearchForm.value.status = 'PENDING';
  handleSearchRequests();
  // 加载所有用户权限
  handleSearchPermissions();
});

const activeTab = ref<'requests' | 'permissions'>('requests');
const reviewDialogVisible = ref(false);
const addPermissionDialogVisible = ref(false);
const isEditMode = ref(false);
const currentRequest = ref<Api.Permission.PermissionRequest | null>(null);
const userDetailDialogVisible = ref(false);
const currentUser = ref<{
  user_id: number;
  user_name: string;
  permissions: Array<{
    type: Api.Permission.PermissionType;
    expire_time: string | null;
  }>;
} | null>(null);
const originalUserPermissions = ref<
  Array<{
    type: Api.Permission.PermissionType;
    expire_time: string | null;
  }>
>([]);
const userPermissionsToUpdate = ref<
  Array<{
    type: Api.Permission.PermissionType;
    action: 'APPROVE' | 'REJECT';
    days: number;
    currentExpireTime: string | null;
    isNew?: boolean;
  }>
>([]);

const reviewForm = ref({
  approve: true,
  comment: ''
});

interface PermissionItem {
  permissionType: Api.Permission.PermissionType | '';
  duration: number;
  permanent: boolean;
}

const addPermissionForm = ref({
  userId: 0,
  userName: '',
  permissions: [
    {
      permissionType: '' as Api.Permission.PermissionType | '',
      duration: 30,
      permanent: false
    }
  ] as PermissionItem[]
});

const permissionSearchForm = ref<{
  permissionType: Api.Permission.PermissionType | '';
  userName: string;
}>({
  permissionType: '',
  userName: ''
});

const permissionTypeOptions = computed(() => [
  { value: '', label: $t('common.all') },
  { value: 'file', label: $t('page.permission.file') },
  { value: 'scene', label: $t('page.permission.scene') },
  { value: 'task', label: $t('page.permission.task') },
  { value: 'genealogy', label: $t('page.permission.genealogy') },
  { value: 'task_chain', label: $t('page.permission.taskChain') },
  { value: 'task_unit', label: $t('page.permission.taskUnit') },
  { value: 'admin', label: $t('page.permission.admin') }
]);

const statusOptions = computed(() => [
  { value: '', label: $t('common.all') },
  { value: 'PENDING', label: '待审批' },
  { value: 'ACTIVE', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'WITHDRAWN', label: '已撤回' },
  { value: 'EXPIRED', label: '已过期' }
]);

const permissionTypeMap = computed(() => ({
  file: $t('page.permission.file'),
  scene: $t('page.permission.scene'),
  task: $t('page.permission.task'),
  genealogy: $t('page.permission.genealogy'),
  task_chain: $t('page.permission.taskChain'),
  task_unit: $t('page.permission.taskUnit'),
  admin: $t('page.permission.admin')
}));

const statusMap = computed(() => ({
  PENDING: '待审批',
  ACTIVE: '已通过',
  REJECTED: '已拒绝',
  WITHDRAWN: '已撤回',
  EXPIRED: '已过期',
  ERROR: '错误'
}));

const statusTypeMap = computed(
  () =>
    ({
      PENDING: 'info',
      ACTIVE: 'success',
      REJECTED: 'danger',
      WITHDRAWN: 'warning',
      EXPIRED: 'info',
      ERROR: 'danger'
    }) as Record<Api.Permission.PermissionStatus, 'success' | 'danger' | 'warning' | 'info'>
);

function formatDate(dateString: string | undefined | null) {
  if (!dateString) return '永久';
  try {
    return new Date(dateString).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    });
  } catch {
    return dateString;
  }
}

// 计算剩余天数
function calculateRemainingDays(expireTime: string | null): number {
  if (!expireTime) return 0;
  try {
    const expireDate = new Date(expireTime);
    const now = new Date();
    const diffTime = expireDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function handleSearchRequests() {
  permissionStore.getAllPermissionRequests({
    page: permissionStore.allRequestPagination.current,
    pageSize: permissionStore.allRequestPagination.size,
    requestType: requestSearchForm.value.permissionType || undefined,
    user: requestSearchForm.value.userName || undefined,
    status: requestSearchForm.value.status || undefined
  });
}

function handleSearchPermissions() {
  permissionStore.getAllUserPermissions({
    page: permissionStore.allUserPermissionPagination.current,
    pageSize: permissionStore.allUserPermissionPagination.size,
    user: permissionSearchForm.value.userName || undefined
  });
}

function openReviewDialog(row: Api.Permission.PermissionRequest) {
  currentRequest.value = row;
  reviewForm.value = {
    approve: true,
    comment: ''
  };
  reviewDialogVisible.value = true;
}

async function handleReview() {
  if (!currentRequest.value) return;

  const success = await permissionStore.reviewPermissionRequest(
    currentRequest.value.request_id,
    reviewForm.value.approve ? 'APPROVE' : 'REJECT',
    reviewForm.value.comment
  );

  if (success) {
    reviewDialogVisible.value = false;
    // 刷新列表
    handleSearchRequests();
  }
}

function openUserDetailDialog(row: {
  user_id: number;
  user_name: string;
  permissions: Array<{
    type: Api.Permission.PermissionType;
    expire_time: string | null;
  }>;
}) {
  currentUser.value = row;
  // 保存原始权限数据
  originalUserPermissions.value = JSON.parse(JSON.stringify(row.permissions));
  // 初始化权限更新列表
  userPermissionsToUpdate.value = row.permissions.map(perm => {
    // 计算剩余天数（如果有过期时间）
    const remainingDays = calculateRemainingDays(perm.expire_time);

    return {
      type: perm.type,
      action: 'APPROVE' as const,
      days: perm.expire_time ? remainingDays : 0,
      currentExpireTime: perm.expire_time,
      isNew: false
    };
  });
  userDetailDialogVisible.value = true;
}

function addUserPermissionItem() {
  // 找出用户还没有的权限类型
  const availableTypes = permissionTypeOptions.value
    .filter(opt => opt.value !== '')
    .filter(opt => !userPermissionsToUpdate.value.some(p => p.type === opt.value));

  // 默认选择第一个可用的权限类型，如果没有可用的则选择第一个
  const defaultType = (
    availableTypes.length > 0 ? availableTypes[0].value : permissionTypeOptions.value[1].value
  ) as Api.Permission.PermissionType;

  userPermissionsToUpdate.value.push({
    type: defaultType,
    action: 'APPROVE' as const,
    days: 30,
    currentExpireTime: null,
    isNew: true
  });
}

function addPermissionItem() {
  addPermissionForm.value.permissions.push({
    permissionType: '',
    duration: 30,
    permanent: false
  });
}

function removePermissionItem(index: number) {
  if (addPermissionForm.value.permissions.length > 1) {
    addPermissionForm.value.permissions.splice(index, 1);
  }
}

async function handleAddPermission() {
  // 验证表单
  if (!addPermissionForm.value.userName) {
    window.$message?.error('请输入用户名');
    return;
  }

  // 验证权限列表
  const validPermissions = addPermissionForm.value.permissions.filter(item => item.permissionType);

  if (validPermissions.length === 0) {
    window.$message?.error('请至少选择一个权限类型');
    return;
  }

  // 转换数据格式
  const permissions = validPermissions.map(item => ({
    type: item.permissionType as Api.Permission.PermissionType,
    action: 'APPROVE' as const,
    days: item.permanent ? 0 : item.duration
  }));

  // 从用户列表中找到用户ID
  const user = permissionStore.allUserPermissions.find(
    (u: { user_name: string }) => u.user_name === addPermissionForm.value.userName
  );

  if (!user) {
    // 如果用户不存在，使用特殊接口添加（需要后端支持）
    // 这里简化处理，假设用户一定存在
    window.$message?.error('用户不存在，请先确保用户已注册');
    return;
  }

  const success = await permissionStore.updateUserPermissions(user.user_id, permissions);

  if (success) {
    addPermissionDialogVisible.value = false;
    handleSearchPermissions();
  }
}

interface PermissionChangeSummary {
  added: Array<{ type: Api.Permission.PermissionType; days: number; name: string }>;
  deleted: Array<{ type: Api.Permission.PermissionType; name: string }>;
  modified: Array<{
    type: Api.Permission.PermissionType;
    name: string;
    wasPermanent: boolean;
    willBePermanent: boolean;
    oldDays: number;
    newDays: number;
  }>;
  changes: Array<{ type: Api.Permission.PermissionType; action: 'APPROVE' | 'REJECT'; days: number }>;
}

function calculatePermissionChanges(): PermissionChangeSummary | null {
  const addedPermissions: PermissionChangeSummary['added'] = [];
  const deletedPermissions: PermissionChangeSummary['deleted'] = [];
  const modifiedPermissions: PermissionChangeSummary['modified'] = [];
  const permissionChanges: PermissionChangeSummary['changes'] = [];

  // 使用 Set 优化查找性能
  const currentTypes = new Set(userPermissionsToUpdate.value.map(p => p.type));
  const originalTypes = new Set(originalUserPermissions.value.map(p => p.type));

  // 1. 检查新增的权限（在original中不存在）
  userPermissionsToUpdate.value.forEach(perm => {
    if (!originalTypes.has(perm.type) && perm.isNew) {
      const permissionName = permissionTypeMap.value[perm.type as Api.Permission.PermissionType] || perm.type;
      addedPermissions.push({
        type: perm.type,
        days: perm.days,
        name: permissionName
      });
      permissionChanges.push({
        type: perm.type,
        action: 'APPROVE',
        days: perm.days
      });
    }
  });

  // 2. 检查删除的权限（在userPermissionsToUpdate中不存在，但original中存在）
  originalUserPermissions.value.forEach(original => {
    if (!currentTypes.has(original.type)) {
      const permissionName = permissionTypeMap.value[original.type as Api.Permission.PermissionType] || original.type;
      deletedPermissions.push({
        type: original.type,
        name: permissionName
      });
      permissionChanges.push({
        type: original.type,
        action: 'REJECT',
        days: 0
      });
    }
  });

  // 3. 检查修改的权限（都存在，但状态发生变化）
  userPermissionsToUpdate.value.forEach(perm => {
    if (perm.isNew) return;

    const original = originalUserPermissions.value.find(p => p.type === perm.type);
    if (!original) return;

    const wasPermanent = !original.expire_time;
    const willBePermanent = perm.days === 0;
    const permissionName = permissionTypeMap.value[perm.type as Api.Permission.PermissionType] || perm.type;
    const oldDays = original.expire_time ? calculateRemainingDays(original.expire_time) : 0;

    if (wasPermanent && !willBePermanent) {
      modifiedPermissions.push({
        type: perm.type,
        name: permissionName,
        wasPermanent,
        willBePermanent,
        oldDays,
        newDays: perm.days
      });
      permissionChanges.push({
        type: perm.type,
        action: 'APPROVE',
        days: perm.days
      });
    } else if (!wasPermanent && willBePermanent) {
      modifiedPermissions.push({
        type: perm.type,
        name: permissionName,
        wasPermanent,
        willBePermanent,
        oldDays,
        newDays: perm.days
      });
      permissionChanges.push({
        type: perm.type,
        action: 'APPROVE',
        days: 0
      });
    } else if (!wasPermanent && !willBePermanent && perm.days !== oldDays) {
      modifiedPermissions.push({
        type: perm.type,
        name: permissionName,
        wasPermanent,
        willBePermanent,
        oldDays,
        newDays: perm.days
      });
      permissionChanges.push({
        type: perm.type,
        action: 'APPROVE',
        days: perm.days
      });
    }
  });

  if (permissionChanges.length === 0) {
    return null;
  }

  return {
    added: addedPermissions,
    deleted: deletedPermissions,
    modified: modifiedPermissions,
    changes: permissionChanges
  };
}

async function generateConfirmHTML(summary: PermissionChangeSummary): Promise<boolean> {
  let confirmHTML = '<div style="margin-bottom: 15px; font-size: 14px; color: #606266;">即将更新以下权限：</div>';

  // 新增权限
  if (summary.added.length > 0) {
    confirmHTML += '<div style="margin-bottom: 15px;">';
    confirmHTML += '<div style="font-weight: bold; color: #67C23A; margin-bottom: 8px;">📌 新增权限</div>';
    summary.added.forEach(perm => {
      confirmHTML += `<div style="margin: 5px 0; padding: 8px 12px; background-color: #F0F9EB; border-left: 4px solid #67C23A; border-radius: 4px;">`;
      confirmHTML += `<strong>${perm.name}</strong>: <span style="color: #67C23A; font-weight: bold;">授予 ${perm.days === 0 ? '永久权限' : `${perm.days}天权限`}</span>`;
      confirmHTML += `</div>`;
    });
    confirmHTML += '</div>';
  }

  // 删除权限
  if (summary.deleted.length > 0) {
    confirmHTML += '<div style="margin-bottom: 15px;">';
    confirmHTML += '<div style="font-weight: bold; color: #F56C6C; margin-bottom: 8px;">🗑️ 删除权限</div>';
    summary.deleted.forEach(perm => {
      confirmHTML += `<div style="margin: 5px 0; padding: 8px 12px; background-color: #FEF0F0; border-left: 4px solid #F56C6C; border-radius: 4px;">`;
      confirmHTML += `<strong>${perm.name}</strong>: <span style="color: #F56C6C; font-weight: bold;">撤销</span>`;
      confirmHTML += `</div>`;
    });
    confirmHTML += '</div>';
  }

  // 修改权限
  if (summary.modified.length > 0) {
    confirmHTML += '<div style="margin-bottom: 15px;">';
    confirmHTML += '<div style="font-weight: bold; color: #E6A23C; margin-bottom: 8px;">✏️ 修改权限</div>';
    summary.modified.forEach(perm => {
      let oldState = '';
      let newState = '';

      if (perm.wasPermanent && !perm.willBePermanent) {
        oldState = '永久权限';
        newState = `${perm.newDays}天权限`;
      } else if (!perm.wasPermanent && perm.willBePermanent) {
        oldState = perm.oldDays > 0 ? `${perm.oldDays}天权限` : '临时权限';
        newState = '永久权限';
      } else {
        oldState = `${perm.oldDays}天权限`;
        newState = `${perm.newDays}天权限`;
      }

      confirmHTML += `<div style="margin: 5px 0; padding: 8px 12px; background-color: #FDF6EC; border-left: 4px solid #E6A23C; border-radius: 4px;">`;
      confirmHTML += `<strong>${perm.name}</strong>: <span style="text-decoration: line-through; color: #909399;">${oldState}</span> → <span style="color: #E6A23C; font-weight: bold;">${newState}</span>`;
      confirmHTML += `</div>`;
    });
    confirmHTML += '</div>';
  }

  confirmHTML +=
    '<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #EBEEF5; font-size: 14px; color: #909399; text-align: center;">是否确认执行此操作？</div>';

  try {
    await window.$messageBox?.confirm('', '权限变更确认', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
      dangerouslyUseHTMLString: true,
      message: confirmHTML,
      customClass: 'permission-confirm-dialog',
      showClose: false
    });
    return true;
  } catch {
    return false;
  }
}

async function handleUpdateUserPermissions() {
  if (!currentUser.value) return;

  // 计算权限变更
  const summary = calculatePermissionChanges();
  if (!summary) {
    window.$message?.info('权限没有变化');
    userDetailDialogVisible.value = false;
    return;
  }

  // 生成确认对话框
  const confirmed = await generateConfirmHTML(summary);
  if (!confirmed) return;

  // 应用权限变更
  const success = await permissionStore.updateUserPermissions(currentUser.value.user_id, summary.changes);

  if (success) {
    userDetailDialogVisible.value = false;
    handleSearchPermissions();
  }
}

function handleExport() {
  permissionStore.exportPermissions();
}
</script>

<template>
  <div class="p-5">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-xl font-bold">{{ $t('page.permission.manage') }}</h2>
      <div class="flex gap-2">
        <ElButton type="primary" @click="handleExport">
          {{ $t('common.export') }}
        </ElButton>
      </div>
    </div>

    <div class="rounded-lg bg-white p-5 shadow-sm">
      <ElTabs v-model="activeTab">
        <ElTabPane :label="$t('page.permission.pendingRequests')" name="requests">
          <ElForm :inline="true" :model="requestSearchForm" class="mb-4">
            <ElFormItem :label="$t('page.permission.permissionType')">
              <ElSelect v-model="requestSearchForm.permissionType" clearable class="w-48">
                <ElOption
                  v-for="item in permissionTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem :label="$t('page.permission.userName')">
              <ElInput
                v-model="requestSearchForm.userName"
                :placeholder="$t('page.permission.searchUserName')"
                class="w-48"
              />
            </ElFormItem>
            <ElFormItem label="状态">
              <ElSelect v-model="requestSearchForm.status" clearable class="w-48">
                <ElOption v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" @click="handleSearchRequests">
                {{ $t('common.search') }}
              </ElButton>
            </ElFormItem>
          </ElForm>

          <ElTable v-loading="permissionStore.permissionLoading" :data="permissionStore.allPermissionRequests" border>
            <ElTableColumn label="申请ID" prop="request_id" width="100" />
            <ElTableColumn label="用户名" prop="user_name" width="150" />
            <ElTableColumn label="权限类型" prop="type" width="150">
              <template #default="{ row }">
                <ElTag>{{ permissionTypeMap[row.type as Api.Permission.PermissionType] || row.type }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="申请时长" width="120">
              <template #default="{ row }">
                {{ row.days === 0 ? '永久' : `${row.days}天` }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" prop="status" width="120">
              <template #default="{ row }">
                <ElTag :type="statusTypeMap[row.status as keyof typeof statusTypeMap]">
                  {{ statusMap[row.status as keyof typeof statusMap] }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="申请理由" prop="reason" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.reason || '-' }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="申请时间" prop="create_time" min-width="180" />
            <ElTableColumn label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <ElButton v-if="row.status === 'PENDING'" type="primary" link @click="openReviewDialog(row)">
                  审批
                </ElButton>
                <span v-else>-</span>
              </template>
            </ElTableColumn>
          </ElTable>

          <ElPagination
            v-model:current-page="permissionStore.allRequestPagination.current"
            v-model:page-size="permissionStore.allRequestPagination.size"
            :total="permissionStore.allRequestPagination.total"
            class="mt-5 flex justify-end"
            layout="total, sizes, prev, pager, next, jumper"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="handleSearchRequests"
            @size-change="handleSearchRequests"
          />
        </ElTabPane>

        <ElTabPane :label="$t('page.permission.allPermissions')" name="permissions">
          <ElForm :inline="true" :model="permissionSearchForm" class="mb-4">
            <ElFormItem :label="$t('page.permission.permissionType')">
              <ElSelect v-model="permissionSearchForm.permissionType" clearable class="w-48">
                <ElOption
                  v-for="item in permissionTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem :label="$t('page.permission.userName')">
              <ElInput
                v-model="permissionSearchForm.userName"
                :placeholder="$t('page.permission.searchUserName')"
                class="w-48"
              />
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" @click="handleSearchPermissions">
                {{ $t('common.search') }}
              </ElButton>
            </ElFormItem>
          </ElForm>

          <ElTable v-loading="permissionStore.permissionLoading" :data="permissionStore.allUserPermissions" border>
            <ElTableColumn label="用户ID" prop="user_id" width="100" />
            <ElTableColumn label="用户名" prop="user_name" width="150" />
            <ElTableColumn label="权限详情" min-width="300">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-2">
                  <ElTag v-for="perm in row.permissions" :key="perm.type" type="success">
                    {{ permissionTypeMap[perm.type as Api.Permission.PermissionType] || perm.type }}
                    <span v-if="perm.expire_time" class="ml-1 text-xs">(至 {{ formatDate(perm.expire_time) }})</span>
                    <span v-else class="ml-1 text-xs">(永久)</span>
                  </ElTag>
                  <ElTag v-if="row.permissions.length === 0" type="info">无权限</ElTag>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <ElButton type="primary" link @click="openUserDetailDialog(row)">查看详情</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>

          <ElPagination
            v-model:current-page="permissionStore.allUserPermissionPagination.current"
            v-model:page-size="permissionStore.allUserPermissionPagination.size"
            :total="permissionStore.allUserPermissionPagination.total"
            class="mt-5 flex justify-end"
            layout="total, sizes, prev, pager, next, jumper"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="handleSearchPermissions"
            @size-change="handleSearchPermissions"
          />
        </ElTabPane>
      </ElTabs>
    </div>

    <!-- 审批对话框 -->
    <ElDialog v-model="reviewDialogVisible" :title="$t('page.permission.reviewTitle')" width="500px">
      <ElForm :model="reviewForm" label-width="100px">
        <ElFormItem :label="$t('page.permission.reviewResult')">
          <ElRadioGroup v-model="reviewForm.approve">
            <ElRadio :label="true">{{ $t('page.permission.approve') }}</ElRadio>
            <ElRadio :label="false">{{ $t('page.permission.reject') }}</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem :label="$t('page.permission.reviewComment')">
          <ElInput v-model="reviewForm.comment" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="reviewDialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="permissionStore.reviewLoading" @click="handleReview">
          {{ $t('common.confirm') }}
        </ElButton>
      </template>
    </ElDialog>

    <!-- 添加/编辑权限对话框 -->
    <ElDialog
      v-model="addPermissionDialogVisible"
      :title="isEditMode ? '编辑权限' : $t('page.permission.addPermission')"
      width="700px"
    >
      <ElForm :model="addPermissionForm" label-width="120px">
        <ElFormItem :label="$t('page.permission.userName')" required>
          <ElInput
            v-model="addPermissionForm.userName"
            :placeholder="$t('page.permission.searchUserName')"
            :disabled="isEditMode"
          />
        </ElFormItem>

        <div class="mb-4 border rounded-lg p-4">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="font-medium">{{ $t('page.permission.permissionType') }}</h4>
            <ElButton
              type="primary"
              size="small"
              :disabled="addPermissionForm.permissions.length >= 7"
              @click="addPermissionItem"
            >
              <icon-ic-round-add class="mr-1" />
              {{ $t('common.add') }}
            </ElButton>
          </div>

          <div
            v-for="(item, index) in addPermissionForm.permissions"
            :key="index"
            class="mb-3 border rounded p-3 last:mb-0"
          >
            <div class="flex items-start gap-3">
              <ElSelect
                v-model="item.permissionType"
                class="flex-1"
                :placeholder="$t('page.permission.selectPermissionType')"
              >
                <ElOption
                  v-for="opt in permissionTypeOptions.filter(opt => opt.value !== '')"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                  :disabled="
                    addPermissionForm.permissions.some(p => p.permissionType === opt.value && p.permissionType !== '')
                  "
                />
              </ElSelect>

              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <ElInputNumber v-model="item.duration" :min="1" :max="365" :disabled="item.permanent" class="w-32" />
                  <span class="whitespace-nowrap text-gray-500">{{ $t('page.permission.days') }}</span>
                  <ElCheckbox v-model="item.permanent">
                    {{ $t('page.permission.forever') }}
                  </ElCheckbox>
                </div>
              </div>

              <ElButton
                v-if="addPermissionForm.permissions.length > 1"
                type="danger"
                size="small"
                link
                @click="removePermissionItem(index)"
              >
                <icon-ic-round-delete />
              </ElButton>
            </div>
          </div>

          <ElText v-if="addPermissionForm.permissions.length === 0" type="info" size="small">
            {{ $t('page.permission.addPermission') }}
          </ElText>
        </div>
      </ElForm>
      <template #footer>
        <ElButton @click="addPermissionDialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="permissionStore.permissionLoading" @click="handleAddPermission">
          {{ isEditMode ? '保存修改' : $t('common.confirm') }}
        </ElButton>
      </template>
    </ElDialog>

    <!-- 用户权限详情对话框 -->
    <ElDialog v-model="userDetailDialogVisible" title="用户权限详情" width="700px">
      <div v-if="currentUser" class="space-y-4">
        <ElCard shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">用户信息</span>
              <ElTag type="info">ID: {{ currentUser.user_id }}</ElTag>
            </div>
          </template>
          <div class="py-2">
            <div class="text-lg font-semibold">{{ currentUser.user_name }}</div>
          </div>
        </ElCard>

        <ElCard shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">权限列表</span>
              <div class="flex items-center gap-3">
                <ElText v-if="userPermissionsToUpdate.length >= 7" type="warning" size="small">
                  已达最大权限数 (7/7)
                </ElText>
                <ElText v-else type="info" size="small">{{ userPermissionsToUpdate.length }}/7 项权限</ElText>
                <ElButton
                  type="primary"
                  size="small"
                  :disabled="userPermissionsToUpdate.length >= 7"
                  @click="addUserPermissionItem"
                >
                  <icon-ic-round-add class="mr-1" />
                  添加权限
                </ElButton>
              </div>
            </div>
          </template>

          <ElTable v-if="userPermissionsToUpdate.length > 0" :data="userPermissionsToUpdate" border class="mt-2">
            <ElTableColumn label="权限类型" width="150">
              <template #default="{ row, $index }">
                <ElSelect v-model="row.type" class="w-full">
                  <ElOption
                    v-for="opt in permissionTypeOptions.filter(o => o.value !== '')"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                    :disabled="userPermissionsToUpdate.some((p, idx) => p.type === opt.value && idx !== $index)"
                  />
                </ElSelect>
              </template>
            </ElTableColumn>

            <ElTableColumn label="当前状态" width="150">
              <template #default="{ row }">
                <ElTag v-if="row.isNew" type="info" size="small" effect="plain">尚未拥有</ElTag>
                <ElTag v-else-if="row.currentExpireTime === null" type="success" size="small">永久权限</ElTag>
                <div v-else class="text-xs text-gray-500">至 {{ formatDate(row.currentExpireTime) }}</div>
              </template>
            </ElTableColumn>

            <ElTableColumn label="新状态" width="220">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <ElInputNumber
                    v-model="row.days"
                    :min="0"
                    :max="365"
                    size="small"
                    class="w-24"
                    :controls="true"
                    :step="1"
                    :disabled="row.days === 0"
                  />
                  <span class="text-sm text-gray-600">天</span>
                  <ElCheckbox
                    :model-value="row.days === 0"
                    size="small"
                    @change="
                      (val: CheckboxValueType) => {
                        if (val) {
                          row.days = 0;
                        } else if (row.days === 0) {
                          row.days = 30;
                        }
                      }
                    "
                  >
                    永久
                  </ElCheckbox>
                </div>
              </template>
            </ElTableColumn>

            <ElTableColumn label="操作" width="80" fixed="right">
              <template #default="{ $index }">
                <ElButton type="danger" link @click="userPermissionsToUpdate.splice($index, 1)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>

          <ElEmpty v-else description="暂无权限" :image-size="60" />
        </ElCard>
      </div>

      <template #footer>
        <ElButton @click="userDetailDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="permissionStore.permissionLoading" @click="handleUpdateUserPermissions">
          保存修改
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
:deep(.permission-edit-table) {
  .el-table__cell {
    padding: 8px 0;
  }
}

:deep(.el-input-number--small) {
  .el-input__wrapper {
    padding: 1px 8px;
  }
}

:deep(.el-checkbox) {
  margin-right: 0;
}

:deep(.permission-confirm-dialog) {
  .el-message-box__content {
    pre {
      background-color: #f8f9fa;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #e9ecef;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
  }
}
</style>
