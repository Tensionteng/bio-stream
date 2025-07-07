export interface RegisterRequestData {
  /** admin 或 editor */
  username: string
  /** 密码 */
  password: string
}
/**
 * 注册成功时的响应数据结构
 */
export interface RegisterSuccessResponseData {
  /** 成功提示信息 */
  message: string
  /** 新用户的 ID */
  user_id: number
}

/**
 * 注册失败（如数据验证错误）时的响应数据结构
 */
export interface RegisterErrorResponseData {
  /** 用户名相关的错误信息数组 */
  username?: string[]
  /** 密码相关的错误信息数组 */
  password?: string[]
}
