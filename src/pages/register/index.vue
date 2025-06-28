<script lang="ts" setup>
import type { FormInstance, FormRules } from "element-plus"
import { Lock, User } from "@element-plus/icons-vue"
// import { useSettingsStore } from "@/pinia/stores/settings"
import { RegisterApi } from "./apis"

const router = useRouter()

/** 注册表单元素的引用 */
const registerFormRef = ref<FormInstance | null>(null)

/** 注册按钮 Loading */
const loading = ref(false)

/** 注册表单数据 */
const registerFormData = reactive({
  username: "",
  password: "",
  confirmPassword: "" // 新增确认密码字段
})

// 自定义校验规则：确认密码
function validateConfirmPassword(rule: any, value: any, callback: any) {
  if (value === "") {
    callback(new Error("请再次输入密码"))
  } else if (value !== registerFormData.password) {
    callback(new Error("两次输入的密码不一致!"))
  } else {
    callback()
  }
}

/** 注册表单校验规则 */
const registerFormRules: FormRules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, max: 16, message: "长度在 8 到 16 个字符", trigger: "blur" }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: "blur" }
  ]
}

/** 注册 */
function handleRegister() {
  registerFormRef.value?.validate((valid) => {
    if (!valid) {
      ElMessage.error("请检查输入项是否正确")
      return
    }
    loading.value = true
    // 准备发送到后端的数据
    const apiData = {
      username: registerFormData.username,
      password: registerFormData.password
    }
    RegisterApi(apiData)
      .then(() => {
        ElMessage.success("注册成功！即将跳转到登录页面...")
        // 延迟跳转，给用户看提示的时间
        setTimeout(() => {
          router.push("/auth/login")
        }, 1000)
      })
      .catch(() => {
        console.error("注册失败:用户名已存在")
      })
      .finally(() => {
        loading.value = false
      })
  })
}

/** 返回登录页 */
function goToLogin() {
  router.push("/auth/login")
}
</script>

<template>
  <div class="login-page-wrapper">
    <div class="login-card">
      <div class="title">
        <img src="@@/assets/images/layouts/logo-text-2.png" alt="Logo">
        <h1 class="main-title">
          创建您的账户
        </h1>
      </div>
      <div class="content">
        <el-form ref="registerFormRef" :model="registerFormData" :rules="registerFormRules" @keyup.enter="handleRegister">
          <el-form-item prop="username">
            <el-input
              v-model.trim="registerFormData.username"
              placeholder="设置用户名"
              type="text"
              :prefix-icon="User"
              size="large"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model.trim="registerFormData.password"
              placeholder="设置密码 (8-16位)"
              type="password"
              :prefix-icon="Lock"
              size="large"
              show-password
            />
          </el-form-item>
          <!-- 确认密码输入框 -->
          <el-form-item prop="confirmPassword">
            <el-input
              v-model.trim="registerFormData.confirmPassword"
              placeholder="确认密码"
              type="password"
              :prefix-icon="Lock"
              size="large"
              show-password
            />
          </el-form-item>
          <el-button :loading="loading" type="primary" size="large" @click="handleRegister">
            注 册
          </el-button>
          <el-button link type="primary" @click="goToLogin">
            已有账户？返回登录
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// The entire style section has been revamped for a modern, light, and professional look.
.login-page-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  // A soft, light-blue gradient background creates a calming and professional atmosphere.
  background: linear-gradient(135deg, #e0f2f1, #e3f2fd);
  overflow: hidden;
  position: relative;

  // Abstract shapes are added to the background for a subtle touch of modern design.
  &::before,
  &::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    filter: blur(80px); // Softens the shapes significantly.
    opacity: 0.5;
  }

  // A larger, light cyan shape.
  &::before {
    width: 400px;
    height: 400px;
    background: rgba(64, 224, 208, 0.3); // Light turquoise
    top: -10%;
    left: -15%;
  }

  // A smaller, light purple shape.
  &::after {
    width: 300px;
    height: 300px;
    background: rgba(159, 168, 218, 0.3); // Light indigo
    bottom: -15%;
    right: -10%;
  }
}

// The login card uses "glassmorphism" for a sleek, modern, frosted-glass effect.
.login-card {
  width: 420px;
  max-width: 90%;
  border-radius: 20px;
  z-index: 5; // Ensures the card is above the background shapes.

  // Core glassmorphism styles
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px); // For Safari
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);

  .title {
    text-align: center;
    padding-top: 40px;

    img {
      height: 40px; // A more subtle logo size
      margin-bottom: 20px;
    }

    .main-title {
      font-size: 24px;
      font-weight: 600;
      color: #333; // Darker text for readability
      letter-spacing: 1px;
    }
  }

  .content {
    padding: 30px 40px 40px 40px;

    // Customizing Element Plus input fields to match the glassmorphism theme.
    :deep(.el-input__wrapper) {
      background-color: rgba(255, 255, 255, 0.5);
      box-shadow: none;
      border-radius: 8px;
      &:hover,
      &.is-focus {
        background-color: rgba(255, 255, 255, 0.8);
      }
    }

    // --- 按钮样式 ---

    // [修改点 1]：只针对主按钮应用渐变样式
    // 使用 :not(.is-link) 来排除链接按钮
    .el-button--primary:not(.is-link) {
      width: 100%;
      margin-top: 20px;
      border-radius: 8px;
      font-weight: 600;
      letter-spacing: 2px;
      border: none;
      color: white;
      background: linear-gradient(135deg, #26a69a 0%, #42a5f5 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;

      &:hover:not(.is-disabled) {
        transform: translateY(-3px);
        box-shadow: 0 7px 20px rgba(66, 165, 245, 0.4);
      }

      &:active:not(.is-disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(66, 165, 245, 0.3);
      }

      &.is-loading {
        background: linear-gradient(135deg, #26a69a 0%, #42a5f5 100%);
        opacity: 0.7;
      }
    }

    // [修改点 2]：为链接按钮设置特定样式
    .el-button.is-link {
      width: 100%; // 仍然占满宽度以使其居中
      margin-top: 15px; // 调整与上方按钮的间距
      background: none; // 移除背景
      box-shadow: none; // 移除阴影
      border: none; // 移除边框
      font-weight: 400; // 正常字重

      // 移除浮动效果，添加下划线效果
      &:hover,
      &:active {
        transform: none;
        box-shadow: none;
        text-decoration: underline;
      }
    }
  }
}
</style>
