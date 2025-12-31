<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchRegister } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { useForm, useFormRules } from '@/hooks/common/form';
import { useBoolean } from '@/hooks/common/boolean';
import { $t } from '@/locales';

defineOptions({ name: 'Register' });

const { toggleLoginModule } = useRouterPush();
const { formRef, validate } = useForm();
// 2. 添加加载状态
const { bool: loading, setTrue: startLoading, setFalse: endLoading } = useBoolean();

interface FormModel {
  username: string;
  password: string;
  confirmPassword: string;
}

const model = ref<FormModel>({
  username: '',
  password: '',
  confirmPassword: ''
});
const rules = computed<Record<keyof FormModel, App.Global.FormRule[]>>(() => {
  const { formRules, createConfirmPwdRule } = useFormRules();

  return {
    username: formRules.userName,
    password: [
      // 1. 必填校验
      { required: true, message: $t('page.login.common.passwordPlaceholder'), trigger: 'blur' },
      // 2. 正则校验：必须包含大小写、数字、下划线
      {
        // 解释：
        // (?=.*[A-Z]) 至少一个大写
        // (?=.*[a-z]) 至少一个小写
        // (?=.*\d)    至少一个数字
        // (?=.*_)     至少一个下划线
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*_)[A-Za-z\d_]{5,20}$/,
        message: '密码需包含大写、小写字母、数字和下划线，长度5-20位',
        trigger: 'change'
      }
    ],
    confirmPassword: createConfirmPwdRule(model.value.password)
  };
});

async function handleSubmit() {
  await validate();
  startLoading();

  try {
    // 调用注册接口。
    const { response } = await fetchRegister(model.value.username, model.value.password);
    if (response.data.code !== '0000') {
      console.log(response.data.message);
      ElMessage.error(response.data.message);
      return;
    }
    window.$message?.success($t('page.login.common.registerSuccess'));
    // 注册成功后，跳转到登录页面
    toggleLoginModule('pwd-login');
  } finally {
    endLoading();
  }
}
</script>

<template>
  <ElForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
    <ElFormItem prop="username">
      <ElInput v-model="model.username" :placeholder="$t('page.login.common.userNamePlaceholder')" />
    </ElFormItem>
    <ElFormItem prop="password">
      <ElInput
        v-model="model.password"
        type="password"
        show-password-on="click"
        :placeholder="$t('page.login.common.passwordPlaceholder')"
      />
    </ElFormItem>
    <ElFormItem prop="confirmPassword">
      <ElInput
        v-model="model.confirmPassword"
        type="password"
        show-password-on="click"
        :placeholder="$t('page.login.common.confirmPasswordPlaceholder')"
      />
    </ElFormItem>
    <ElSpace direction="vertical" :size="18" fill class="w-full">
      <!-- 5. 将加载状态绑定到按钮 -->
      <ElButton type="primary" size="large" round block :loading="loading" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </ElButton>
      <ElButton size="large" round @click="toggleLoginModule('pwd-login')">
        {{ $t('page.login.common.back') }}
      </ElButton>
    </ElSpace>
  </ElForm>
</template>

<style scoped></style>
