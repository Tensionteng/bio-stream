import type { RouteRecordRaw } from "vue-router"
import { defineStore } from "pinia"
import { ref } from "vue"
import { pinia } from "@/pinia"
// 我们只需要从 router 导入完整的路由列表
import { constantRoutes } from "@/router"

export const usePermissionStore = defineStore("permission", () => {
  // 唯一需要管理的状态：用于生成侧边栏菜单的路由列表
  const routes = ref<RouteRecordRaw[]>([])

  /**
   * action: 设置路由列表
   * 它的作用仅仅是把完整的路由列表赋值给 state，供菜单组件使用。
   */
  const setRoutes = () => {
    routes.value = constantRoutes
  }

  // 返回 state 和 action
  return {
    routes,
    setRoutes
  }
})

/**
 * 在 setup 外使用 store
 */
export function usePermissionStoreOutside() {
  return usePermissionStore(pinia)
}
