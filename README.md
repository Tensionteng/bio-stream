## 使用
> [!WARNING]
> 暂时先不要删除`src/views`下多余的部分，参考他们的代码新增文件即可，删除可能会导致类型错误

**环境准备**

确保你的环境满足以下要求：

- **git**: 你需要git来克隆和管理项目版本。
- **NodeJS**: >=18.12.0，推荐 18.19.0 或更高。
- **pnpm**: >= 8.7.0，推荐 8.14.0 或更高。


**安装依赖**

```bash
pnpm i
```
> 由于本项目采用了 pnpm monorepo 的管理方式，因此请不要使用 npm 或 yarn 来安装依赖。

**启动项目**

```bash
pnpm dev
```

**构建项目**

```bash
pnpm build
```

**如何新增页面**
在`src/views`文件夹下新增文件夹，在新增的文件夹下新增`index.vue`文件，即可在`src/router/index.ts`中自动注册路由。页面自动更新内容和路由。



**如何上传代码**
1. 新建自己的分支，后面统一合并到main中
2. commit message最好遵循[约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0/)的标准，中英文都可以，写清楚就行，重要的是前面的标签。例如：
  - 更新功能：`feat: 新增用户列表功能`
  - 修复bug：`fix: 修复用户列表无法加载的问题`
  - 文档更新：`docs: 更新README.md文档`
  - 样式更新：`style: 更新用户列表的样式`
  - 测试更新：`test: 更新用户列表的测试用例`
  - 重构代码：`refactor: 重构用户列表的代码`
  - 性能优化：`perf: 优化用户列表的性能`
  - 构建工具更新：`chore: 更新构建工具`
  - CI/CD更新：`ci: 更新CI/CD配置`

3. 提交代码前请先运行`pnpm lint`检查代码规范，确保代码符合规范
4. 如果提交的时候有类型错误，尽量先按照提示解决，如果解决不了可以考虑`pnpm remove simple-git-hooks`禁用类型检查
5. 有问题**随时**在群里提问

**文件结构**
```
soybean-admin
├── .vscode                        //vscode插件和设置
│   ├── extensions.json            //vscode推荐的插件
│   ├── launch.json                //debug配置文件(debug Vue 和 TS)
│   └── settings.json              //vscode配置(在该项目中生效，可以复制到用户配置文件中)
├── build                          //vite构建相关配置和插件
│   ├── config                     //构建打包配置
│   │   └── proxy.ts               //网络请求代理
│   └── plugins                    //构建插件
│       ├── index.ts               //插件汇总
│       ├── router.ts              //elegant-router插件
│       ├── unocss.ts              //unocss插件
│       └── unplugin.ts            //自动导入UI组件、自动解析iconify图标、自动解析本地svg作为图标
├── packages                       //子项目
│   ├── axios                      //网络请求封装
│   ├── color-palette              //颜色调色板
│   ├── hooks                      //组合式函数hooks
│   ├── materials                  //组件物料
│   ├── ofetch                     //网络请求封装
│   ├── scripts                    //脚本
│   ├── uno-preset                 //uno-preset配置
│   └── utils                      //工具函数
├── public                         //公共目录(文件夹里面的资源打包后会在根目录下)
│   └── favicon.svg                //网站标签图标
├── src
│   ├── assets                     //静态资源
│   │   ├── imgs                   //图片
│   │   └── svg-icon               //本地svg图标
│   ├── components                 //全局组件
│   │   ├── advanced               //高级组件
│   │   ├── common                 //公共组件
│   │   └── custom                 //自定义组件
│   ├── constants                  //常量
│   │   ├── app.ts                 //app常量
│   │   ├── business.ts            //业务常量
│   │   ├── common.ts              //通用常量
│   │   └── reg.ts                 //正则常量
│   ├── enums                      //枚举
│   ├── hooks                      //组合式的函数hooks
│   │   ├── business               //业务hooks
│   │   │   ├── auth               //用户权限
│   │   │   └── captcha            //验证码
│   │   └── common                 //通用hooks
│   │       ├── echarts            //echarts
│   │       ├── form               //表单
│   │       ├── icon               //图标
│   │       ├── router             //路由
│   │       └── table              //表格
│   ├── layouts                    //布局组件
│   │   ├── base-layout            //基本布局(包含全局头部、多页签、侧边栏、底部等公共部分)
│   │   ├── blank-layout           //空白布局组件(单个页面)
│   │   ├── context                //布局组件的上下文状态
│   │   ├── hooks                  //布局组件的hooks
│   │   └── modules                //布局组件模块
│   │       ├── global-breadcrumb  //全局面包屑
│   │       ├── global-content     //全局主体内容
│   │       ├── global-footer      //全局底部
│   │       ├── global-header      //全局头部
│   │       ├── global-logo        //全局Logo
│   │       ├── global-menu        //全局菜单
│   │       ├── global-search      //全局搜索
│   │       ├── global-sider       //全局侧边栏
│   │       ├── global-tab         //全局标签页
│   │       └── theme-drawer       //主题抽屉
│   ├── locales                //国际化配置
│   │   ├── langs              //语言文件
│   │   ├── dayjs.ts           //dayjs的国际化配置
│   │   ├── locale.ts          //语言文件汇总
│   │   └── naive.ts           //NaiveUI的国际化配置
│   ├── plugins                //插件
│   │   ├── assets.ts          //各种依赖的静态资源导入(css、scss等)
│   │   ├── dayjs.ts           //dayjs插件
│   │   ├── iconify.ts         //iconify插件
│   │   ├── loading.ts         //全局初始化时的加载插件
│   │   └── nprogress.ts       //顶部加载条nprogress插件
│   ├── router                 //vue路由
│   │   ├── elegant            //elegant-router插件生成的路由声明、导入和转换等文件
│   │   ├── guard              //路由守卫
│   │   ├── routes             //路由声明入口
│   │   │   ├── builtin        //系统内置路由 根路由和未找到路由
│   │   │   └── index          //前端静态路由创建的入口
│   │   └── index.ts           //路由插件入口
│   ├── service                //网络请求
│   │   ├── api                //接口api
│   │   └── request            //封装的请求函数
│   ├── store                  //pinia状态管理
│   │   ├── modules            //状态管理划分的模块
│   │   │   ├── app            //app状态(页面重载、菜单折叠、项目配置的抽屉)
│   │   │   ├── auth           //auth状态(用户信息、用户权益)
│   │   │   ├── route          //route状态(动态路由、菜单、路由缓存)
│   │   │   ├── tab            //tab状态(多页签、缓存页面的滚动位置)
│   │   │   └── theme          //theme状态(项目主题配置)
│   │   └── plugins            //状态管理插件
│   ├── styles                 //全局样式
│   │   ├── css                //css
│   │   └── scss               //scss
│   ├── theme                  //主题配置
│   │   ├── settings.ts        //主题默认配置及覆盖配置
│   │   └── vars.ts            //主题token对应的css变量
│   ├── typings                //TS类型声明文件(*.d.ts)
│   │   ├── api.d.ts           //请求接口返回的数据的类型声明
│   │   ├── app.d.ts           //应用相关的类型声明
│   │   ├── common.d.ts        //通用类型声明
│   │   ├── components.d.ts    //自动导入的组件的类型声明
│   │   ├── elegant-router.d.ts//插件elegant-router生成的路由声明
│   │   ├── env.d.ts           //vue路由描述和请求环境相关的类型声明
│   │   ├── global.d.ts        //全局通用类型
│   │   ├── naive-ui.d.ts      //NaiveUI类型
│   │   ├── router.d.ts        //Vue的路由描述的类型声明
│   │   ├── storage.d.ts       //本地缓存的数据类型
│   │   └── union-key.d.ts     //联合类型
│   ├── utils                  //全局工具函数(纯函数，不含状态)
│   │   ├── common             //通用工具函数
│   │   ├── icon               //图标相关工具函数
│   │   ├── service            //请求服务配置相关的工具函数
│   │   └── storage            //存储相关工具函数
│   ├── views                  //页面
│   │   ├── _builtin           //系统内置页面：登录、异常页等
│   │   ├── about              //关于
│   │   ├── function           //功能
│   │   ├── home               //首页
│   │   ├── manage             //系统管理
│   │   ├── multi-menu         //多级菜单
│   │   └── user-center        //用户中心
│   ├── App.vue                //Vue文件入口
│   └── main.ts                //项目入口TS文件
├── .editorconfig              //统一编辑器配置
├── .env                       //环境文件
├── .env.prod                  //生产环境的环境文件
├── .env.test                  //测试环境的环境文件
├── .gitattributes             //git属性配置
├── .gitignore                 //忽略git提交的配置文件
├── .npmrc                     //npm配置
├── CHANGELOG.md               //项目更新日志
├── eslint.config.js           //eslint flat配置文件
├── index.html                 //html文件
├── package.json               //npm依赖描述文件
├── pnpm-lock.yaml             //npm包管理器pnpm依赖锁定文件
├── README.md                  //项目介绍文档
├── README.zh-CN.md            //项目介绍文档(中文)
├── tsconfig.json              //TS配置
├── uno.config.ts              //原子css框架unocss配置
└── vite.config.ts             //vite配置
```

## 权限系统使用指南

本项目实现了完整的权限控制系统，支持7种权限类型：文件管理(file)、场景管理(scene)、任务管理(task)、谱系管理(genealogy)、任务链管理(task_chain)、任务单元管理(task_unit)、管理员(admin)。

### 权限类型说明

权限采用字符串标识，支持以下7种类型：
- `file` - 文件管理权限
- `scene` - 场景管理权限
- `task` - 任务管理权限
- `genealogy` - 谱系管理权限
- `task_chain` - 任务链管理权限
- `task_unit` - 任务单元管理权限
- `admin` - 管理员权限（拥有所有权限，无需申请）

### 权限检查

#### 1. 在组件中检查权限

```typescript
import { usePermissionStore } from '@/store/modules/permission';

const permissionStore = usePermissionStore();

// 检查是否有指定权限
const hasAccess = permissionStore.hasPermission('file'); // 返回 boolean

// 检查是否有任意一个权限
const hasAny = permissionStore.hasPermission('file') || permissionStore.hasPermission('admin');
```

#### 2. 使用权限守卫钩子

提供了两个权限守卫钩子，自动处理权限检查和用户引导：

```typescript
import { usePermissionGuard } from '@/hooks/business/permission-guard';

const { checkAndRequestPermission, checkPermissionAndNotify } = usePermissionGuard();

// 检查权限，如果没有则弹出确认框询问是否申请
// 用户点击"申请权限"会自动跳转到申请页面
const hasPermission = await checkAndRequestPermission('file', {
  title: '无权限访问',
  message: '您没有文件管理权限，是否需要申请该权限？',
  autoRedirect: true
});

// 仅检查并提示，不自动跳转
const hasAccess = await checkPermissionAndNotify('file');
```

#### 3. 简单同步检查

如果不需要引导用户申请，只进行同步检查：

```typescript
import { useSimplePermissionCheck } from '@/hooks/business/permission-guard';

const { hasPermission, hasAnyPermission, hasAllPermissions } = useSimplePermissionCheck();

// 检查单个权限
const canAccess = hasPermission('file');

// 检查是否有任意一个权限
const hasAny = hasAnyPermission(['file', 'scene', 'task']);

// 检查是否拥有所有权限
const hasAll = hasAllPermissions(['file', 'scene']);
```

#### 4. 路由元信息配置

在路由配置中添加权限要求，用户访问时自动检查：

```typescript
{
  name: 'file_list',
  path: '/file/list',
  meta: {
    requiredPermission: 'file'  // 需要的权限类型
  },
  component: () => import('@/views/file/list/index.vue')
}
```

用户访问该路由时：
- **管理员**：自动拥有所有权限，直接进入页面（不需要申请任何权限）
- 有权限：正常访问
- 无权限：弹出确认框询问是否申请，点击"申请权限"自动跳转到申请页面

**注意**：管理员访问`/permission/apply`（申请权限页面）时会被自动重定向到`/permission/my`

### 权限申请

#### 1. 用户申请权限

```typescript
import { usePermissionStore } from '@/store/modules/permission';

const permissionStore = usePermissionStore();

// 提交权限申请
const success = await permissionStore.applyPermission({
  permissionType: 'file',  // 权限类型
  days: 30,                // 申请天数（0表示永久）
  reason: '需要管理项目文件'  // 申请理由（不超过500字）
});

if (success) {
  // 申请提交成功
  console.log('申请已提交，等待管理员审批');
}
```

#### 2. 跳转到申请页面

```typescript
import { useRouter } from 'vue-router';

const router = useRouter();

// 跳转到申请页面（可选：携带权限类型）
router.push({
  name: 'permission_apply',
  query: { type: 'file' }  // 可选：预选择权限类型
});
```

### 权限管理（管理员）

#### 1. 审批权限申请

```typescript
import { usePermissionStore } from '@/store/modules/permission';

const permissionStore = usePermissionStore();

// 批准申请
await permissionStore.reviewPermissionRequest({
  requestId: 123,
  approve: true,
  comment: '同意申请'
});

// 拒绝申请
await permissionStore.reviewPermissionRequest({
  requestId: 123,
  approve: false,
  comment: '理由不充分'
});
```

#### 2. 直接添加权限

```typescript
import { usePermissionStore } from '@/store/modules/permission';

const permissionStore = usePermissionStore();

// 为用户添加权限（无需审批）
await permissionStore.addUserPermission('username', [
  {
    type: 'file',
    days: 0  // -1表示永久
  },
  {
    type: 'task',
    days: 30
  }
]);
```

#### 3. 撤销权限

```typescript
// 撤销用户的某个权限
await permissionStore.revokePermission(permissionId);
```

#### 4. 导出权限数据

```typescript
// 导出所有权限数据到Excel（前端导出，无需后端）
await permissionStore.exportPermissions();
// 自动生成：权限管理_2025-11-27.xlsx
```

### 权限状态

权限和申请有以下几种状态：
- `PENDING` - 待审批
- `ACTIVE` - 已通过/已激活
- `REJECTED` - 已拒绝
- `WITHDRAWN` - 已撤回
- `EXPIRED` - 已过期
- `ERROR` - 错误

### 最佳实践

1. **权限检查机制**：
   - 权限数据从登录接口 `/auth/user` 获取并存储在 store 中
   - `hasPermission()` 函数直接从 store 读取权限，无需额外 API 调用
   - 管理员拥有 `admin` 权限时，自动获得所有权限
   - 权限变更后（审批/撤销/添加），会自动刷新用户信息

2. **管理员权限**：
   - 拥有 `admin` 权限的用户自动拥有所有权限，路由守卫会直接放行
   - 访问任何需要权限的页面都无需申请
   - 访问 `/permission/apply`（申请权限页面）时会自动重定向到 `/permission/my`
   - "我的权限"页面会显示"您已是管理员，拥有所有权限"
   - 申请权限入口会自动隐藏（按钮和菜单不在界面显示）

3. **前端导出**：权限导出功能在前端实现，使用 `xlsx` 库，无需后端支持
4. **天数表示**：`-1` 或 `0` 表示永久权限，显示时为"永久"
5. **字段映射**：后端使用 `days` 字段表示天数，前端统一使用 `days`（不是 `duration`）
6. **理由长度**：申请理由最大500字，无最小字数限制

### 权限数据流

1. 用户申请权限 → 状态为 `PENDING`
2. 管理员审批：
   - 批准 → 状态变为 `ACTIVE`，权限生效
   - 拒绝 → 状态变为 `REJECTED`
3. 权限到期 → 状态自动变为 `EXPIRED`
4. 管理员可撤销 → 状态变为 `WITHDRAWN`

### 文件位置

- **权限钩子**：`src/hooks/business/permission-guard.ts`
- **权限存储**：`src/store/modules/permission/index.ts`
- **权限API**：`src/service/api/permission.ts`
- **权限类型**：`src/typings/api.d.ts` (namespace Api.Permission)
- **权限页面**：`src/views/permission/apply/`, `src/views/permission/my/`, `src/views/permission/manage/`

### 子路由权限控制

所有子路由都会继承父级路由的权限控制，包括：
- `task/list`, `task/create` - 需要 `task` 权限
- `taskChain/list`, `taskChain/create` - 需要 `task_chain` 权限
- `taskUnit/list`, `taskUnit/create` - 需要 `task_unit` 权限
- `scene/list` - 需要 `scene` 权限
- `file/index` - 需要 `file` 权限
- `visualization/index` - 需要 `task` 权限（任务可视化）

路由守卫会自动拦截所有无权限访问，管理员无需额外配置即可访问所有子路由。

