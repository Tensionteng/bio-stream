import type * as Auth from "./type"
import { request } from "@/http/axios"

/** 登录并返回 Token */
function loginApi(data: Auth.LoginRequestData) {
  return request<Auth.LoginResponseData>({
    url: "auth/login",
    method: "post",
    data
  })
}

/** 令牌续签 API */
function refreshTokenApi(data: Auth.RefreshRequestData) {
  return request<Auth.RefreshResponseData>({
    url: "auth/refresh",
    method: "post",
    data
  })
}

// 在文件末尾一起导出
export {
  loginApi,
  refreshTokenApi
}
