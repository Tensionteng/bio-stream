<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissionStore } from '@/store/modules/permission';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

const router = useRouter();
const permissionStore = usePermissionStore();
const authStore = useAuthStore();

// 检查是否有admin权限
const hasAdminPermission = computed(() => {
  return authStore.userInfo.permissions.includes('admin');
});

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
  return days === 0;
}

async function handlePageChange(page: number) {
  await permissionStore.getUserApplications(page, permissionStore.userApplicationPagination.size);
}

async function handlePageSizeChange(size: number) {
  await permissionStore.getUserApplications(1, size);
}

async function handleWithdraw(requestId: number) {
  try {
    await window.$messageBox?.confirm('确定要撤回该申请吗？', '确认撤回', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    const success = await permissionStore.withdrawApplication(requestId);
    if (success) {
      window.$message?.success('申请撤回成功');
    } else {
      window.$message?.error('申请撤回失败，请稍后重试');
    }
  } catch {
    // 用户取消
  }
}

onMounted(async () => {
  await permissionStore.getUserApplications(1, 10);
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

    <div class="rounded-lg bg-white p-5 shadow-sm">
      <ElTable
        v-loading="permissionStore.permissionLoading"
        :data="permissionStore.userApplications"
        border
        class="w-full"
      >
        <ElTableColumn label="权限类型" prop="type" width="120">
          <template #default="{ row }">
            <ElTag>{{ $t(`page.permission.${row.type}` as any) || row.type }}</ElTag>
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

        <ElTableColumn label="申请时间" prop="created_time" min-width="150">
          <template #default="{ row }">
            {{ formatDate(row.created_time) }}
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

        <ElTableColumn label="审批备注" prop="comment" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.comment || '-' }}
          </template>
        </ElTableColumn>

        <ElTableColumn label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <ElButton v-if="row.status === 'PENDING'" type="primary" link @click="handleWithdraw(row.request_id)">
              撤回
            </ElButton>
            <span v-else>-</span>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="permissionStore.userApplicationPagination.current"
        v-model:page-size="permissionStore.userApplicationPagination.size"
        :total="permissionStore.userApplicationPagination.total"
        class="mt-5 flex justify-end"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
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
