import type { Router } from "vue-router"
import { setRouteChange } from "@@/composables/useRouteListener"
import { useTitle } from "@@/composables/useTitle"
import { getToken } from "@@/utils/cache/cookies"
import NProgress from "nprogress"
import { usePermissionStore } from "@/pinia/stores/permission"
import { useUserStore } from "@/pinia/stores/user"
import { isWhiteList } from "@/router/whitelist"

NProgress.configure({ showSpinner: false })

const { setTitle } = useTitle()

const LOGIN_PATH = "/auth/login"

export function registerNavigationGuard(router: Router) {
  // 全局前置守卫
  router.beforeEach(async (to, _from) => {
    NProgress.start()
    const permissionStore = usePermissionStore()
    // 如果没有登录
    if (!getToken()) {
      // 如果在免登录的白名单中，则直接进入
      if (isWhiteList(to)) return true
      // 其他没有访问权限的页面将被重定向到登录页面
      return LOGIN_PATH
    }
    // 如果已经登录，并准备进入 Login 页面，则重定向到主页
    if (to.path === LOGIN_PATH) return "/"
    // 如果 permissionStore.routes.length 不为 0，说明路由已经生成，直接放行
    // 这是比检查 userStore.roles 更可靠的方式，因为它直接反映了路由是否已添加
    if (permissionStore.routes.length !== 0) return true
    // 否则，生成路由
    try {
      // 直接让 permissionStore 生成所有路由。
      permissionStore.setAllRoutes()

      // 动态添加路由。
      permissionStore.addRoutes.forEach(route => router.addRoute(route))

      // 确保动态路由添加完毕后，再重新导航
      return { ...to, replace: true }
    } catch (error) {
      // 1. 重置用户的 Token 和状态
      //    这会清空 Pinia Store 和 Cookies 中的 token，
      //    防止陷入无限循环的错误重试。
      const userstore = useUserStore()
      userstore.token = ""
      // 2. 使用 ElMessage 弹出错误提示
      ElMessage.error((error as Error).message || "路由守卫在生成路由时发生错误，请重试")

      // 3. 重定向到登录页面
      //    同时在 URL query 中附带上原始要访问的路径，
      //    以便登录后可以跳回原页面（这是一个常见的优化）。
      return `${LOGIN_PATH}?redirect=${to.path}`
    }
  })

  // 全局后置钩子
  router.afterEach((to) => {
    setRouteChange(to)
    setTitle(to.meta.title)
    NProgress.done()
  })
}
