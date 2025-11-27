<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { $t } from '@/locales';

const router = useRouter();
const permissionStore = usePermissionStore();
const authStore = useAuthStore();

const activeTab = ref<'current' | 'history'>('current');

// 检查是否有admin权限
const hasAdminPermission = computed(() => {
  return authStore.userInfo.permissions.includes('admin');
});

const permissionTypeMap = computed(() => ({
  file: $t('page.permission.file'),
  scene: $t('page.permission.scene'),
  task: $t('page.permission.task'),
  genealogy: $t('page.permission.genealogy'),
  task_chain: $t('page.permission.taskChain'),
  task_unit: $t('page.permission.taskUnit'),
  admin: $t('page.permission.admin')
}));

const statusMap = {
  PENDING: '待审批',
  ACTIVE: '已通过',
  REJECTED: '已拒绝',
  WITHDRAWN: '已撤回',
  ERROR: '错误',
  EXPIRED: '已过期'
};

const statusTypeMap = {
  PENDING: 'info',
  ACTIVE: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'warning',
  ERROR: 'danger',
  EXPIRED: 'info'
} as const;

function handleApply() {
  router.push('/permission/apply');
}

function formatDate(dateString: string | undefined) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    });
  } catch {
    return dateString;
  }
}

function isPermanent(days: number) {
  return days === -1;
}

function handlePageChange(page: number) {
  permissionStore.getUserPermissionHistory(page, permissionStore.historyPagination.size);
}

function handlePageSizeChange(size: number) {
  permissionStore.getUserPermissionHistory(1, size);
}

onMounted(() => {
  permissionStore.getUserPermissionHistory(1, 10);
});
</script>

<template>
  <div class="p-5">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-xl font-bold">{{ $t('page.permission.myPermissions') }}</h2>
      <ElButton v-if="!hasAdminPermission" type="primary" @click="handleApply">
        {{ $t('page.permission.applyPermission') }}
      </ElButton>
    </div>

    <div class="rounded-lg bg-white shadow-sm">
      <ElTabs v-model="activeTab" class="p-5">
        <!-- 当前激活的权限 -->
        <ElTabPane label="当前权限" name="current">
          <div v-if="!authStore.userInfo.permissions.length" class="py-10">
            <ElEmpty :description="$t('page.permission.noPermissions')">
              <ElButton v-if="!hasAdminPermission" type="primary" @click="handleApply">
                {{ $t('page.permission.applyNow') }}
              </ElButton>
            </ElEmpty>
          </div>

          <div v-else class="grid grid-cols-1 mt-4 gap-4 lg:grid-cols-3 md:grid-cols-2">
            <ElCard v-for="perm in authStore.userInfo.permissions" :key="perm" class="permission-card" shadow="hover">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg text-gray-800 font-semibold">
                    {{ permissionTypeMap[perm as Api.Permission.PermissionType] || perm }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">已激活</p>
                </div>
                <div class="text-2xl">
                  <div class="i-carbon:checkmark-filled text-green-500"></div>
                </div>
              </div>
            </ElCard>
          </div>
        </ElTabPane>

        <!-- 申请历史记录 -->
        <ElTabPane label="申请记录" name="history">
          <ElTable
            v-loading="permissionStore.permissionLoading"
            :data="permissionStore.userPermissionHistory"
            border
            class="mt-4"
          >
            <ElTableColumn label="权限类型" prop="type" width="120">
              <template #default="{ row }">
                <ElTag>{{ permissionTypeMap[row.type as Api.Permission.PermissionType] || row.type }}</ElTag>
              </template>
            </ElTableColumn>

            <ElTableColumn label="申请时长" prop="days" width="100">
              <template #default="{ row }">
                {{ isPermanent(row.days) ? '永久' : `${row.days}天` }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="状态" prop="status" width="100">
              <template #default="{ row }">
                <ElTag :type="statusTypeMap[row.status as keyof typeof statusTypeMap]">
                  {{ statusMap[row.status as keyof typeof statusMap] }}
                </ElTag>
              </template>
            </ElTableColumn>

            <ElTableColumn label="申请时间" prop="create_time" min-width="150">
              <template #default="{ row }">
                {{ formatDate(row.create_time) }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="审批时间" prop="review_time" min-width="150">
              <template #default="{ row }">
                {{ formatDate(row.review_time) }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="过期时间" prop="expire_time" min-width="150">
              <template #default="{ row }">
                {{ formatDate(row.expire_time) || '-' }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="申请理由" prop="reason" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.reason || '-' }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="管理员留言" prop="comment" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.comment || '-' }}
              </template>
            </ElTableColumn>

            <ElTableColumn label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'PENDING'"
                  type="primary"
                  link
                  @click="() => console.log('Withdraw not implemented yet')"
                >
                  撤回
                </ElButton>
                <span v-else>-</span>
              </template>
            </ElTableColumn>
          </ElTable>

          <ElPagination
            v-model:current-page="permissionStore.historyPagination.current"
            v-model:page-size="permissionStore.historyPagination.size"
            :total="permissionStore.historyPagination.total"
            class="mt-5 flex justify-end"
            layout="total, sizes, prev, pager, next, jumper"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </ElTabPane>
      </ElTabs>
    </div>
  </div>
</template>

<style scoped>
.permission-card {
  transition: all 0.3s;
}
.permission-card:hover {
  transform: translateY(-2px);
}
</style>
