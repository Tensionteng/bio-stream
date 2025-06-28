import type * as Auth from "./type"
import { request } from "@/http/axios"

/** 登录并返回 Token */
export function RegisterApi(data: Auth.RegisterRequestData) {
  return request<Auth.RegisterRequestData>({
    url: "auth/register/",
    method: "post",
    data
  })
}
