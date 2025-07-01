// 统一处理 Cookie

import { CacheKey } from "@@/constants/cache-key"
import Cookies from "js-cookie"

export function getToken() {
  return Cookies.get(CacheKey.TOKEN)
}

export function setToken(token: string) {
  Cookies.set(CacheKey.TOKEN, token)
}

export function removeToken() {
  Cookies.remove(CacheKey.TOKEN)
}
// --- Refresh Token ---
export function getRefreshToken() {
  return Cookies.get(CacheKey.REFRESH_TOKEN)
}

export function setRefreshToken(token: string) {
  // refresh_token 的有效期为 7 天
  Cookies.set(CacheKey.REFRESH_TOKEN, token, { expires: 7 })
}

export function removeRefreshToken() {
  Cookies.remove(CacheKey.REFRESH_TOKEN)
}
