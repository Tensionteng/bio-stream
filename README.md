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


