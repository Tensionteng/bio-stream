import type * as Auth from "./type"
import type { RegisterSuccessResponseData } from "@/pages/register/apis/type"
import { request } from "@/http/axios"
/** 登录并返回 Token */
export function RegisterApi(data: Auth.RegisterRequestData) {
  return request<RegisterSuccessResponseData>({
    url: "auth/register",
    method: "post",
    data
  })
}
