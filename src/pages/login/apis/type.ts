export interface LoginRequestData {
  /** admin 或 editor */
  username: string
  /** 密码 */
  password: string
}

export type CaptchaResponseData = ApiResponseData<string>
export interface RefreshRequestData {
  refresh: string
}

export interface RefreshResponseData {
  access: string
}
// export type LoginResponseData = ApiResponseData<{ token: string }>
export interface LoginSuccessData {
  userid: number
  username: string
  access: string
  refresh: string
}

// 使用新的接口来定义 LoginResponseData
export type LoginResponseData = ApiResponseData<LoginSuccessData>
