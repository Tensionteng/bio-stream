<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { $t } from '@/locales';

const authStore = useAuthStore();

const permissionTypeMap = computed(() => ({
  file: $t('page.permission.file'),
  scene: $t('page.permission.scene'),
  task: $t('page.permission.task'),
  genealogy: $t('page.permission.genealogy'),
  task_chain: $t('page.permission.taskChain'),
  task_unit: $t('page.permission.taskUnit'),
  admin: $t('page.permission.admin')
}));

const permissionIcons = computed(() => ({
  file: 'i-carbon:document',
  scene: 'i-carbon:informatics',
  task: 'i-carbon:task',
  genealogy: 'i-carbon:tree-view',
  task_chain: 'i-carbon:flow',
  task_unit: 'i-carbon:asset',
  admin: 'i-carbon:user-admin'
}));

const permissionGradientClasses = computed(() => ({
  file: 'from-blue-50 to-blue-100',
  scene: 'from-purple-50 to-purple-100',
  task: 'from-green-50 to-green-100',
  genealogy: 'from-orange-50 to-orange-100',
  task_chain: 'from-pink-50 to-pink-100',
  task_unit: 'from-yellow-50 to-yellow-100',
  admin: 'from-red-50 to-red-100'
}));

const permissionTextColors = computed(() => ({
  file: 'text-blue-600',
  scene: 'text-purple-600',
  task: 'text-green-600',
  genealogy: 'text-orange-600',
  task_chain: 'text-pink-600',
  task_unit: 'text-yellow-700',
  admin: 'text-red-600'
}));

const totalPermissions = computed(() => authStore.userInfo.permissions.length);
</script>

<template>
  <ElCard class="h-auto w-full" shadow="hover" :header-style="{ borderBottom: '2px solid #f0f2f5' }">
    <template #header>
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-3">
          <div class="text-2xl">
            <div class="i-carbon:license text-blue-600"></div>
          </div>
          <div>
            <h3 class="text-lg text-gray-800 font-bold">我的权限</h3>
            <div class="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <div class="i-carbon:checkmark"></div>
              <span>共 {{ totalPermissions }} 项权限</span>
            </div>
          </div>
        </div>
        <ElTag
          v-if="authStore.userInfo.permissions.includes('admin')"
          type="danger"
          size="small"
          effect="dark"
          class="tracking-wide uppercase"
        >
          <div class="flex items-center gap-1">
            <div class="i-carbon:user-admin text-xs"></div>
            管理员
          </div>
        </ElTag>
      </div>
    </template>

    <div v-if="!authStore.userInfo.permissions.length" class="py-8">
      <ElEmpty description="暂无权限" :image-size="80" />
      <div class="mt-4 flex justify-center">
        <ElButton type="primary" @click="$router.push('/permission/apply')">
          <div class="i-carbon:add mr-2"></div>
          申请权限
        </ElButton>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-3">
      <ElCard
        v-for="perm in authStore.userInfo.permissions"
        :key="perm"
        class="permission-card shadow-sm transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-1"
        :class="[
          'bg-gradient-to-r rounded-lg ' + permissionGradientClasses[perm as keyof typeof permissionGradientClasses]
        ]"
        :body-style="{ padding: '16px' }"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="flex-shrink-0 text-2xl">
              <div
                :class="
                  permissionIcons[perm as keyof typeof permissionIcons] +
                  ' ' +
                  permissionTextColors[perm as keyof typeof permissionTextColors]
                "
              ></div>
            </div>
            <div>
              <div class="text-sm text-gray-800 font-semibold">
                {{ permissionTypeMap[perm as Api.Permission.PermissionType] || perm }}
              </div>
              <div class="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <div class="i-carbon:checkmark"></div>
                已激活
              </div>
            </div>
          </div>
          <ElTag v-if="perm === 'admin'" type="danger" size="small" effect="dark" class="ml-2">
            <div class="flex items-center gap-1">
              <div class="i-carbon:star text-xs"></div>
              全部权限
            </div>
          </ElTag>
        </div>
      </ElCard>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <ElButton type="primary" link class="font-medium" @click="$router.push('/permission/my')">
          <div class="i-carbon:link mr-1"></div>
          查看申请记录
        </ElButton>
      </div>
    </template>
  </ElCard>
</template>

<style scoped>
/* Only keep the deep selectors that can't be replaced with Tailwind */
.permission-card :deep(.el-card__body) {
  padding: 16px;
}

:deep(.el-tag--dark) {
  border-radius: 4px;
}
</style>
