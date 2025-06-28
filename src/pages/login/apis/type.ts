export interface LoginRequestData {
  /** admin 或 editor */
  username: string
  /** 密码 */
  password: string
}

export type CaptchaResponseData = ApiResponseData<string>

// export type LoginResponseData = ApiResponseData<{ token: string }>
export interface LoginSuccessData {
  access: boolean
  userid: number
  username: string
  token: string
}

// 使用新的接口来定义 LoginResponseData
export type LoginResponseData = ApiResponseData<LoginSuccessData>
