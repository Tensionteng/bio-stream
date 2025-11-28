<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
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

// 如果不是管理员，跳转到我的权限页面
onMounted(() => {
  if (!isAdmin.value) {
    window.$message?.warning('您没有权限访问此页面');
    router.push('/permission/my');
    return;
  }
  // 加载待审批申请（request_type=PENDING）
  permissionStore.getPermissionRequests({ requestType: 'PENDING' });
  // 加载所有权限（不传request_type）
  permissionStore.getAllUserPermissions();
});

const activeTab = ref<'requests' | 'permissions'>('requests');
const reviewDialogVisible = ref(false);
const addPermissionDialogVisible = ref(false);
const currentRequest = ref<Api.Permission.PermissionRequest | null>(null);
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
  userName: '',
  permissions: [
    {
      permissionType: '' as Api.Permission.PermissionType | '',
      duration: 30,
      permanent: false
    }
  ] as PermissionItem[]
});

// 筛选条件
const requestSearchForm = ref<{
  permissionType: Api.Permission.PermissionType | '';
  userName: string;
}>({
  permissionType: '',
  userName: ''
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

const requestColumns = [
  { label: $t('page.permission.applicant'), prop: 'userName' },
  { label: $t('page.permission.permissionType'), prop: 'permissionType' },
  { label: $t('page.permission.requestTime'), prop: 'requestTime' },
  { label: $t('page.permission.duration'), prop: 'duration' },
  { label: $t('page.permission.reason'), prop: 'reason', minWidth: 200 },
  { label: $t('page.permission.reviewComment'), prop: 'reviewComment', minWidth: 200 },
  { label: $t('page.permission.status'), prop: 'status' },
  { label: $t('common.action'), prop: 'action', width: 150 }
];

const permissionColumns = [
  { label: $t('page.permission.userName'), prop: 'userName' },
  { label: $t('page.permission.permissionType'), prop: 'permissionType' },
  { label: $t('page.permission.grantedTime'), prop: 'grantedTime' },
  { label: $t('page.permission.expireTime'), prop: 'expireTime' },
  { label: $t('page.permission.status'), prop: 'status' },
  { label: $t('common.action'), prop: 'action', width: 100 }
];

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
  PENDING: $t('page.permission.statusPending'),
  ACTIVE: $t('page.permission.statusApproved'),
  REJECTED: $t('page.permission.statusRejected'),
  WITHDRAWN: $t('page.permission.statusWithdrawn'),
  EXPIRED: $t('page.permission.statusExpired'),
  ERROR: $t('page.permission.statusError')
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

function handleSearchRequests() {
  permissionStore.updateRequestSearchParams({
    permissionType: requestSearchForm.value.permissionType || null,
    userName: requestSearchForm.value.userName || null,
    current: 1,
    size: permissionStore.requestPagination.size
  });
  // 如果是待审批申请tab，添加request_type=PENDING条件
  if (activeTab.value === 'requests') {
    permissionStore.getPermissionRequests({ requestType: 'PENDING' });
  } else {
    permissionStore.getPermissionRequests();
  }
}

function handleSearchPermissions() {
  permissionStore.updatePermissionSearchParams({
    permissionType: permissionSearchForm.value.permissionType || null,
    userName: permissionSearchForm.value.userName || null,
    current: 1,
    size: permissionStore.permissionPagination.size
  });
  permissionStore.getAllUserPermissions();
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

  const success = await permissionStore.reviewPermission(
    currentRequest.value.id,
    reviewForm.value.approve,
    reviewForm.value.comment
  );

  if (success) {
    reviewDialogVisible.value = false;
    if (activeTab.value === 'requests') {
      permissionStore.getPermissionRequests({ requestType: 'PENDING' });
    } else {
      permissionStore.getPermissionRequests();
    }
  }
}

function openAddPermissionDialog() {
  addPermissionForm.value = {
    userName: '',
    permissions: [
      {
        permissionType: '' as Api.Permission.PermissionType | '',
        duration: 30,
        permanent: false
      }
    ]
  };
  addPermissionDialogVisible.value = true;
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
    days: item.permanent ? -1 : item.duration
  }));

  const success = await permissionStore.addUserPermission(addPermissionForm.value.userName, permissions);

  if (success) {
    addPermissionDialogVisible.value = false;
    permissionStore.getAllUserPermissions();
  }
}

async function handleRevoke(row: Api.Permission.UserPermission) {
  try {
    await window.$messageBox?.confirm($t('page.permission.confirmRevoke'), $t('common.warning'), {
      confirmButtonText: $t('common.confirm'),
      cancelButtonText: $t('common.cancel'),
      type: 'warning'
    });

    const success = await permissionStore.revokePermission(row.id);
    if (success) {
      permissionStore.getAllUserPermissions();
    }
  } catch {
    // 取消操作
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
        <ElButton type="success" @click="openAddPermissionDialog">
          {{ $t('page.permission.addPermission') }}
        </ElButton>
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
            <ElFormItem>
              <ElButton type="primary" @click="handleSearchRequests">
                {{ $t('common.search') }}
              </ElButton>
            </ElFormItem>
          </ElForm>

          <ElTable v-loading="permissionStore.permissionLoading" :data="permissionStore.permissionRequests" border>
            <ElTableColumn
              v-for="col in requestColumns"
              :key="col.prop"
              :label="col.label"
              :prop="col.prop"
              :width="col.width"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <template v-if="col.prop === 'permissionType'">
                  <ElTag>{{ permissionTypeMap[row.permissionType as Api.Permission.PermissionType] }}</ElTag>
                </template>
                <template v-else-if="col.prop === 'duration'">
                  {{ row.duration }} {{ $t('page.permission.days') }}
                </template>
                <template v-else-if="col.prop === 'status'">
                  <ElTag :type="statusTypeMap[row.status as Api.Permission.PermissionStatus]">
                    {{ statusMap[row.status as Api.Permission.PermissionStatus] }}
                  </ElTag>
                </template>
                <template v-else-if="col.prop === 'action'">
                  <ElButton v-if="row.status === 'PENDING'" type="primary" link @click="openReviewDialog(row)">
                    {{ $t('page.permission.review') }}
                  </ElButton>
                  <span v-else>-</span>
                </template>
                <template v-else>
                  {{ row[col.prop] }}
                </template>
              </template>
            </ElTableColumn>
          </ElTable>

          <ElPagination
            v-model:current-page="permissionStore.requestPagination.current"
            v-model:page-size="permissionStore.requestPagination.size"
            :total="permissionStore.requestPagination.total"
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
            <ElTableColumn
              v-for="col in permissionColumns"
              :key="col.prop"
              :label="col.label"
              :prop="col.prop"
              :width="col.width"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <template v-if="col.prop === 'permissionType'">
                  <ElTag>{{ permissionTypeMap[row.permissionType as Api.Permission.PermissionType] }}</ElTag>
                </template>
                <template v-else-if="col.prop === 'status'">
                  <ElTag :type="statusTypeMap[row.status as Api.Permission.PermissionStatus]">
                    {{ statusMap[row.status as Api.Permission.PermissionStatus] }}
                  </ElTag>
                </template>
                <template v-else-if="col.prop === 'action'">
                  <ElButton v-if="row.status !== 'EXPIRED'" type="danger" link @click="handleRevoke(row)">
                    {{ $t('page.permission.revoke') }}
                  </ElButton>
                  <span v-else>-</span>
                </template>
                <template v-else>
                  {{ row[col.prop] }}
                </template>
              </template>
            </ElTableColumn>
          </ElTable>

          <ElPagination
            v-model:current-page="permissionStore.permissionPagination.current"
            v-model:page-size="permissionStore.permissionPagination.size"
            :total="permissionStore.permissionPagination.total"
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

    <!-- 添加权限对话框 -->
    <ElDialog v-model="addPermissionDialogVisible" :title="$t('page.permission.addPermission')" width="700px">
      <ElForm :model="addPermissionForm" label-width="120px">
        <ElFormItem :label="$t('page.permission.userName')" required>
          <ElInput v-model="addPermissionForm.userName" :placeholder="$t('page.permission.searchUserName')" />
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
          {{ $t('common.confirm') }}
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>
