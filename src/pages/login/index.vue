<script lang="ts" setup>
import type { FormInstance, FormRules } from "element-plus"
import { Lock, User } from "@element-plus/icons-vue"
// import { useSettingsStore } from "@/pinia/stores/settings"
import { useUserStore } from "@/pinia/stores/user"
import { loginApi } from "./apis"

// --- Code Simplification ---
// The Owl component and its related focus logic have been removed
// to create a more professional and streamlined appearance suitable for a bioinformatics platform.

const router = useRouter()
const userStore = useUserStore()
// const settingsStore = useSettingsStore()

/** 登录表单元素的引用 */
const loginFormRef = ref<FormInstance | null>(null)

/** 登录按钮 Loading */
const loading = ref(false)
/** 登录表单数据  */
const loginFormData = reactive({
  username: "admin",
  password: "12345678"
})
if (userStore.username) {
  loginFormData.username = userStore.username
}
/** 登录表单校验规则 */
const loginFormRules: FormRules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }, { min: 8, max: 16, message: "长度在 8 到 16 个字符", trigger: "blur" }]
}

/** 登录 */
function handleLogin() {
  loginFormRef.value?.validate((valid) => {
    if (!valid) {
      return
    }
    loading.value = true
    loginApi(loginFormData)
      .then(({ data }) => {
        // 登录成功
        userStore.setLoginInfo(data)
        router.push("/")
      })
      .catch((error) => {
        ElMessage({
          type: "error",
          message: "用户名或密码错误"
        })
        console.error("用户名或密码错误", error)
        loginFormData.password = ""
      })
      .finally(() => {
        // 无论成功或失败，最后都将 loading 状态置为 false
        loading.value = false
      })
  })
}
// 注册
function goToRegister() {
  router.push("/auth/register") // 跳转到路径为 /register 的页面
}
</script>

<template>
  <!-- The main container is redesigned for a modern, clean aesthetic. -->
  <div class="login-page-wrapper">
    <div class="login-card">
      <div class="title">
        <!-- The logo is kept for branding. -->
        <img src="@@/assets/images/layouts/logo-text-2.png" alt="Logo">
        <!-- A clear header and sub-header are added for better context. -->
        <h1 class="main-title">
          生物数据分析平台
        </h1>
      </div>
      <div class="content">
        <el-form ref="loginFormRef" :model="loginFormData" :rules="loginFormRules" @keyup.enter="handleLogin">
          <el-form-item prop="username">
            <el-input
              v-model.trim="loginFormData.username"
              placeholder="用户名"
              type="text"
              tabindex="1"
              :prefix-icon="User"
              size="large"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model.trim="loginFormData.password"
              placeholder="密码"
              type="password"
              tabindex="2"
              :prefix-icon="Lock"
              size="large"
              show-password
            />
          </el-form-item>
          <el-button :loading="loading" type="primary" size="large" @click="handleLogin">
            登 录
          </el-button>
        </el-form>
        <el-form>
          <el-button type="primary" size="large" @click="goToRegister">
            注册
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

.theme-switch {
  position: fixed;
  top: 20px;
  right: 20px;
  cursor: pointer;
  z-index: 10;
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

    .subtitle {
      font-size: 14px;
      color: #757575;
      margin-top: 8px;
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
    .el-button {
      width: 100%;
      margin-top: 20px;
      border-radius: 8px;
      font-weight: 600;
      letter-spacing: 2px;

      //设置文字颜色为白色
      border: none;
      color: white;

      // 创建一个渐变背景
      background: linear-gradient(135deg, #26a69a 0%, #42a5f5 100%); // Teal to Blue gradient

      // 添加初始阴影，使其具有立体感
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);

      // 添加平滑的过渡动画，应用于所有变化的属性
      transition: all 0.3s ease;

      // 定义悬停（Hover）状态下的样式
      &:hover:not(.is-disabled) {
        //向上移动，创建“浮起”效果
        transform: translateY(-3px);
        // 增强阴影，使浮起效果更明显
        box-shadow: 0 7px 20px rgba(66, 165, 245, 0.4);
      }

      // 定义激活（Active/Click）状态下的样式
      &:active:not(.is-disabled) {
        // 轻微下沉，模拟“按下”效果
        transform: translateY(-1px);
        // 减弱阴影
        box-shadow: 0 4px 10px rgba(66, 165, 245, 0.3);
      }

      // 当按钮处于加载状态时，利用它
      &.is-loading {
        // 在加载时，使用原始的渐变色，但不应用任何交互效果
        background: linear-gradient(135deg, #26a69a 0%, #42a5f5 100%);
        // 降低透明度以示禁用
        opacity: 0.7;
      }
    }
  }
}
</style>
