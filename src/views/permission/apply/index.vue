<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { $t } from '@/locales';

const router = useRouter();
const route = useRoute();
const permissionStore = usePermissionStore();
const authStore = useAuthStore();

// 检查是否是管理员（如果有admin权限，跳转到我的权限页面）
const hasAdminPermission = computed(() => {
  return authStore.userInfo.permissions.includes('admin');
});

// 申请表单数据
const applyForm = reactive({
  permissionType: null as Api.Permission.PermissionType | null, // 权限类型
  days: 30, // 申请天数
  forever: false, // 是否永久
  reason: '' // 申请理由
});

const formRef = ref();
const loading = ref(false);

// 权限类型选项（用于下拉框）
const permissionTypeOptions: { value: Api.Permission.PermissionType; label: string }[] = [
  { value: 'file', label: $t('page.permission.file') },
  { value: 'scene', label: $t('page.permission.scene') },
  { value: 'task', label: $t('page.permission.task') },
  { value: 'genealogy', label: $t('page.permission.genealogy') },
  { value: 'task_chain', label: $t('page.permission.taskChain') },
  { value: 'task_unit', label: $t('page.permission.taskUnit') },
  { value: 'admin', label: $t('page.permission.admin') }
];

// 表单验证规则
const rules = {
  permissionType: [
    {
      required: true,
      message: $t('page.permission.selectPermissionType'),
      trigger: 'change'
    }
  ],
  days: [
    {
      required: true,
      message: $t('page.permission.enterDuration'),
      trigger: 'blur',
      validator: (_rule: unknown, value: number, callback: (error?: Error) => void) => {
        if (!applyForm.forever && (!value || value < 1 || value > 365)) {
          callback(new Error($t('page.permission.durationRange')));
        } else {
          callback();
        }
      }
    }
  ],
  reason: [
    {
      required: true,
      message: $t('page.permission.enterReason'),
      trigger: 'blur'
    },
    {
      max: 500,
      message: $t('page.permission.reasonLength'),
      trigger: 'blur'
    }
  ]
};

onMounted(() => {
  // 检查是否是管理员，如果是则跳转到我的权限页面
  if (hasAdminPermission.value) {
    window.$message?.warning('您已是管理员，无需申请权限');
    router.push('/permission/my');
    return;
  }

  // 检查路由查询参数，如果有type则自动选中
  const queryType = route.query.type as Api.Permission.PermissionType | undefined;
  if (queryType) {
    applyForm.permissionType = queryType;
  }
});

// 提交申请按钮处理函数
async function handleSubmit() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true;
      try {
        // 构建提交参数
        const submitData = {
          type: applyForm.permissionType!,
          days: applyForm.forever ? 0 : applyForm.days, // 0表示永久
          reason: applyForm.reason
        };

        // applyPermission 现在会抛出错误，API层会自动显示错误消息
        await permissionStore.applyPermission(submitData);
        window.$message?.success($t('page.permission.applySuccess'));
        router.push('/permission/my');
      } catch {
        // 错误已经被API层的onError处理并显示消息框，这里不需要再处理
        // 只需确保loading状态被重置
      } finally {
        loading.value = false;
        console.log('申请权限流程结束');
      }
    }
  });
}

// 取消按钮处理函数
function handleCancel() {
  router.back();
}
</script>

<template>
  <div class="p-5">
    <div class="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-sm">
      <div class="mb-6">
        <h2 class="mb-2 text-xl text-gray-800 font-bold">
          {{ $t('page.permission.applyTitle') }}
        </h2>
        <p class="text-gray-600">{{ $t('page.permission.applyDesc') }}</p>
      </div>

      <ElForm ref="formRef" :model="applyForm" :rules="rules" label-width="120px" class="mt-4">
        <ElFormItem :label="$t('page.permission.permissionType')" prop="permissionType">
          <ElSelect
            v-model="applyForm.permissionType as any"
            :placeholder="$t('page.permission.selectPermissionType')"
            class="w-full"
            clearable
          >
            <ElOption v-for="item in permissionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem :label="$t('page.permission.duration')" prop="days">
          <div class="flex flex-col gap-3">
            <div class="flex items-center">
              <ElInputNumber
                v-model="applyForm.days"
                :min="1"
                :max="365"
                :precision="0"
                :placeholder="$t('page.permission.durationPlaceholder')"
                controls-position="right"
                :disabled="applyForm.forever"
                class="mr-2"
              />
              <span class="text-sm text-gray-700">{{ $t('page.permission.durationUnit') }}</span>
            </div>
            <div class="flex items-center pl-2">
              <ElCheckbox v-model="applyForm.forever" :label="$t('page.permission.forever')" />
            </div>
          </div>
        </ElFormItem>

        <ElFormItem :label="$t('page.permission.reason')" prop="reason">
          <ElInput
            v-model="applyForm.reason"
            type="textarea"
            :rows="5"
            :placeholder="$t('page.permission.reasonPlaceholder')"
            maxlength="500"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem>
          <div class="flex gap-3">
            <ElButton type="primary" :loading="loading" @click="handleSubmit">
              {{ $t('common.submit') }}
            </ElButton>
            <ElButton @click="handleCancel">{{ $t('common.cancel') }}</ElButton>
          </div>
        </ElFormItem>
      </ElForm>
    </div>
  </div>
</template>
