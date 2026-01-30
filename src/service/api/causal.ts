import { request } from '../request'; // 假设你的 request 工具路径
/** 变量映射接口 (用于因果效应) */
export interface DivMap {
  X: string[]; // 协变量
  Y: string[]; // 结果变量
  T: string[]; // 干预变量
  W: string[]; // 混杂因子
}
/** 因果发现运行参数 */
export interface RunDiscoveryParams {
  alg_name: string;
  alg_config: Record<string, any>;
  doid: string;
}

/** 因果效应运行参数 */
export interface RunEffectParams {
  alg_name: string;
  alg_config: Record<string, any>;
  doid: string;
  divmap: DivMap;
}
/**
 * 获取数字对象列表
 *
 * @param params 查询参数，例如 { object_name: '搜索关键词' }
 * @param moduleName 模块名称，默认为 'effect' (用于拼接 URL 路径)
 */
export function getCausalObjects(params?: { object_name?: string }, moduleName: string = 'effect') {
  return request({
    url: `/causal/${moduleName}/object`,
    method: 'get',
    // axios/request 会自动将 params 序列化为 URL 查询参数 (?object_name=xxx)
    params
  });
}

/** - 获取可用算法列表 */
export function getCausalAlgorithms(name: string = 'effect') {
  return request({
    url: `/causal/${name}/algorithm`,
    method: 'get'
  });
}

/** - 获取变量列表 */
export function getCausalVariables() {
  return request({
    url: '/causal/variables',
    method: 'get'
  });
}

/** - 执行因果效应估计 */
export function runCausalEffect(data: {
  alg_name: string;
  alg_config: Record<string, any>;
  doid: string; // 注意：提交时参数名是 doid (对应选中的 object_doid)
  divmap: {
    X: string[];
    Y: string[];
    T: string[];
    W: string[];
  };
}) {
  return request({
    url: '/causal/run/effect',
    method: 'post',
    data
  });
}
/**
 * 执行因果发现分析
 *
 * @param data 运行参数
 */
export function runCausalDiscovery(data: RunDiscoveryParams) {
  return request({
    url: '/causal/run/discover',
    method: 'post',
    data
  });
}
