import { setRefreshToken as _setRefreshToken, setToken as _setToken, getRefreshToken, getToken, removeRefreshToken, removeToken } from "@@/utils/cache/cookies"
import { pinia } from "@/pinia"
import { resetRouter } from "@/router"
import { useSettingsStore } from "./settings"
import { useTagsViewStore } from "./tags-view"

export const useUserStore = defineStore("user", () => {
  const token = ref<string>(getToken() || "")
  const refreshToken = ref<string>(getRefreshToken() || "")
  const username = ref<string>("")

  const tagsViewStore = useTagsViewStore()
  const settingsStore = useSettingsStore()

  // 这个 Action 现在用于登录成功后，一次性设置所有信息
  const setLoginInfo = (data: { access: string, refresh: string, username: string }) => {
    // 保存 access_token
    _setToken(data.access)
    token.value = data.access

    // 保存 refresh_token
    _setRefreshToken(data.refresh)
    refreshToken.value = data.refresh

    // 保存 username
    username.value = data.username
  }

  // 单独设置 access_token (续签成功后调用)
  const setToken = (newToken: string) => {
    _setToken(newToken)
    token.value = newToken
  }
  const setUsername = (value: string) => {
    username.value = value
  }

  // 需要清空两个 token
  const logout = () => {
    removeToken()
    removeRefreshToken()
    token.value = ""
    refreshToken.value = ""
    username.value = "" // 清空用户名
    resetRouter()
    resetTagsView()
  }

  const resetToken = () => {
    removeToken()
    removeRefreshToken()
    token.value = ""
    refreshToken.value = ""
  }

  const resetTagsView = () => {
    if (!settingsStore.cacheTagsView) {
      tagsViewStore.delAllVisitedViews()
      tagsViewStore.delAllCachedViews()
    }
  }

  // 5. 导出新的 state 和 actions
  return {
    token,
    refreshToken,
    username,
    setLoginInfo,
    setToken,
    setUsername,
    logout,
    resetToken
  }
})

/** 在 setup 外使用 store */
export function useUserStoreOutside() {
  return useUserStore(pinia)
}
