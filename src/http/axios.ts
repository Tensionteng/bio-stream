import type { AxiosInstance, AxiosRequestConfig } from "axios"
import { getToken } from "@@/utils/cache/cookies"
import axios from "axios"
import { get, merge } from "lodash-es"
import { refreshTokenApi } from "@/pages/login/apis/index"
import { useUserStore } from "@/pinia/stores/user"
/** 退出登录并强制刷新页面（会重定向到登录页） */
function logout() {
  useUserStore().logout()
  location.reload()
}
// 标记是否正在刷新 token
let isRefreshing = false
// 存储因 token 过期而挂起的请求
let requestsToRetry: any[] = []
/** 创建请求实例 */
function createInstance() {
  // 创建一个 axios 实例命名为 instance
  const instance = axios.create()
  // 请求拦截器
  instance.interceptors.request.use(
    // 发送之前
    config => config,
    // 发送失败
    error => Promise.reject(error)
  )
  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      // 成功响应的逻辑保持不变
      const apiData = response.data
      const responseType = response.request?.responseType
      if (responseType === "blob" || responseType === "arraybuffer") return apiData
      const status = response.status
      if (status === 200) return apiData
    },
    async (error) => {
      const userStore = useUserStore()
      // 如果没有 error.response，说明是网络错误等，直接抛出
      if (!error.response) {
        ElMessage.error("网络连接异常，请检查您的网络设置")
        return Promise.reject(error)
      }

      const { config } = error
      const status = error.response.status

      // 如果不是 401 错误，则按原来的逻辑处理其他HTTP错误
      if (status !== 401) {
        const message = get(error, "response.data.message")
        switch (status) {
          case 400: error.message = "请求错误"
            break
          case 403: error.message = message || "拒绝访问"
            break
          case 404: error.message = "请求地址出错"
            break
          default: error.message = message || "请求失败"
            break
        }
        ElMessage.error(error.message)
        return Promise.reject(error)
      }

      // --- 以下是 401 错误（Token过期）的处理逻辑 ---

      // 如果正在刷新 token，将当前失败的请求放入队列等待
      if (isRefreshing) {
        return new Promise((resolve) => {
          requestsToRetry.push((token: string) => {
            // 当刷新成功后，会用新的 token 更新此请求的请求头
            config.headers.Authorization = `Bearer ${token}`
            // 然后重新发起请求
            resolve(instance(config))
          })
        })
      }

      // 这是第一个遇到 401 的请求，开始执行 token 刷新流程
      isRefreshing = true

      try {
        // 调用续签 API
        const responseData = await refreshTokenApi({ refresh: userStore.refreshToken })
        // 直接从 responseData 中获取 newAccessToken
        const newAccessToken = responseData.access

        //  更新 Pinia store 中的 access_token
        userStore.setToken(newAccessToken)

        // 重试原始失败的请求（config 是原始请求的配置）
        config.headers.Authorization = `Bearer ${newAccessToken}`

        // 重新执行所有在队列中等待的请求
        requestsToRetry.forEach(callback => callback(newAccessToken))
        requestsToRetry = [] // 清空队列

        // 返回重试成功的原始请求的 Promise
        return instance(config)
      } catch (refreshError) {
        // 如果 refresh_token 也过期了，或续签接口本身失败
        console.error("无法刷新令牌:", refreshError)
        logout() // 调用登出函数，清空所有信息并刷新页面
        ElMessage.error("您的会话已过期，请重新登录。")
        return Promise.reject(refreshError)
      } finally {
        // 无论成功与否，都要重置刷新状态
        isRefreshing = false
      }
    }
  )
  return instance
}

/** 创建请求方法 */
function createRequest(instance: AxiosInstance) {
  return <T>(config: AxiosRequestConfig): Promise<T> => {
    const token = getToken()
    // 默认配置
    const defaultConfig: AxiosRequestConfig = {
      // 接口地址
      baseURL: import.meta.env.VITE_BASE_URL,
      // 请求头
      headers: {
        // 携带 Token
        "Authorization": token ? `Bearer ${token}` : undefined,
        "Content-Type": "application/json"
      },
      // 请求体
      data: {},
      // 请求超时
      timeout: 5000,
      // 跨域请求时是否携带 Cookies
      withCredentials: false
    }
    // 将默认配置 defaultConfig 和传入的自定义配置 config 进行合并成为 mergeConfig
    const mergeConfig = merge(defaultConfig, config)
    return instance(mergeConfig)
  }
}

/** 用于请求的实例 */
const instance = createInstance()

/** 用于请求的方法 */
export const request = createRequest(instance)
