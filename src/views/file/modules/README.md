# 文件上传模块重构说明

## 概述
将原始的 `src/views/file/index.vue` 进行了模块化拆分，分离为多个独立的 Vue 组件和可复用的工具函数，提高了代码的可维护性和可复用性。

## 文件结构

```
src/views/file/
├── index.vue                    # 主入口组件（重构后仅作为组件编排）
└── modules/
    ├── StatsCard.vue           # 统计信息卡片组件
    ├── SchemaSelection.vue      # 数据类型选择组件
    ├── FormSection.vue          # 动态表单生成和文件上传组件
    ├── UploadTaskPanel.vue      # 上传任务面板组件
    ├── FileList.vue             # 文件列表组件
    ├── FileDetailDialog.vue     # 文件详情弹窗组件
    ├── LineageDialog.vue        # 数据世系图弹窗组件
    ├── FileUploadHandler.ts     # 文件上传业务逻辑工具函数
    └── useFileUpload.ts         # 文件上传 Composable Hook
```

## 组件职责说明

### 1. **StatsCard.vue**
- **职责**：展示统计信息（入湖数据总数、总数据量、最后上传时间）
- **核心功能**：
  - 获取文件统计数据
  - 展示格式化的统计信息
- **暴露方法**：`fetchFileStats()`

### 2. **SchemaSelection.vue**
- **职责**：处理数据类型（Schema）的选择和搜索
- **核心功能**：
  - 获取 Schema 列表
  - 支持搜索和过滤
  - 发出 Schema 选择事件
- **Props**：`modelValue` (绑定值)
- **Events**：`update:modelValue`, `schemaSelected`

### 3. **FormSection.vue**
- **职责**：动态生成表单并处理文件上传
- **核心功能**：
  - 根据 Schema 动态生成表单字段
  - 支持多种字段类型（文本、选择、布尔值、文件等）
  - 表单验证
  - 文件管理（上传、删除）
- **Props**：`schema` (当前选中的Schema)
- **暴露对象**：
  - `dynamicForm` - 表单数据
  - `textFields` - 文本字段配置
  - `fileFields` - 文件字段配置
  - 验证、重置等方法

### 4. **UploadTaskPanel.vue**
- **职责**：展示和管理上传任务
- **核心功能**：
  - 显示上传任务列表
  - 展示上传进度
  - 支持取消和移除任务
  - 可折叠收缩
- **Props**：`tasks` (上传任务列表)
- **Events**：`cancel-task`, `remove-task`

### 5. **FileList.vue**
- **职责**：展示已上传文件列表
- **核心功能**：
  - 获取分页文件列表
  - 支持搜索和过滤（文件名、类型、ID）
  - 分页处理
  - 操作按钮（查看详情、查看世系）
- **Events**：`detail`, `lineage`

### 6. **FileDetailDialog.vue**
- **职责**：展示文件详细信息弹窗
- **核心功能**：
  - 获取文件详情
  - 展示文件基本信息
  - 展示描述JSON
  - 展示子文件列表
- **Props**：`modelValue`, `fileId`
- **暴露方法**：`openDialog(fileId)`

### 7. **LineageDialog.vue**
- **职责**：展示数据世系图弹窗
- **核心功能**：
  - 获取文件世系数据
  - 使用 ECharts 渲染关系图
  - 支持交互操作（悬停、点击）
- **Props**：`modelValue`, `row`
- **暴露方法**：`showLineage(row)`

## 工具函数

### FileUploadHandler.ts
提供文件上传相关的纯函数：

| 函数名 | 职责 |
|--------|------|
| `hashFile(file)` | 计算文件SHA256哈希 |
| `getSuffixFromFileName(fileName)` | 提取文件后缀 |
| `collectFileEntries(obj)` | 遍历收集所有文件 |
| `setNestedValue(target, path, value)` | 设置嵌套对象值 |
| `buildDescriptionJson(...)` | 构建上传描述信息 |
| `getFileNameFromSchema(dynamicForm)` | 生成文件名 |
| `processFileUploads(...)` | 处理文件上传流程 |
| `completeFileUpload(...)` | 完成上传请求 |
| `registerUploadTask(...)` | 注册上传任务（用于全局管理） |
| `cancelUploadTask(taskId)` | 取消指定上传任务 |
| `cleanupUploadTask(taskId)` | 清理已完成的任务 |

#### 进度跟踪机制改进

为了实现**实时捕捉传输请求中的进度**，进行了以下优化：

1. **独立的 axios 实例** (`createUploadAxiosInstance`)
   - 为每个文件上传创建独立的 axios 实例
   - 配置无限超时和内容长度限制
   - 确保大文件上传的可靠性

2. **精确的进度计算** (`trackUploadProgress`)
   - 使用进度事件中的 `loaded` 和 `total` 字段计算百分比
   - 确保进度单调递增，避免进度条抖动
   - 记录进度变化日志用于调试

3. **全局任务管理**
   - 维护 `uploadTaskMap` 存储所有活跃上传任务
   - 支持中途取消上传任务
   - 自动清理已完成的任务

4. **完整的生命周期管理**
   - 任务创建时自动注册
   - 上传成功/失败时更新状态
   - 任务完成后自动清理资源

### useFileUpload.ts
提供上传管理的 Composable Hook：

| 返回值 | 类型 | 说明 |
|--------|------|------|
| `uploadLoading` | Ref<boolean> | 上传加载状态 |
| `uploadTaskList` | Ref<any[]> | 上传任务列表 |
| `addUploadTask` | Function | 添加任务 |
| `updateUploadTaskProgress` | Function | 更新进度（实时捕捉） |
| `updateUploadTaskStatus` | Function | 更新状态 |
| `cancelUploadTask` | Function | 取消任务（调用全局取消机制） |
| `removeUploadTask` | Function | 移除任务 |
| `handleSubmit` | Function | 处理提交 |

#### 进度更新流程

```
文件上传 → onUploadProgress 回调
           ↓
     trackUploadProgress (进度计算)
           ↓
   updateUploadTaskProgress (状态更新)
           ↓
  UploadTaskPanel.vue (UI 实时显示)
```

## 主入口组件 (index.vue)

重构后的 `index.vue` 仅作为组件编排和事件协调的入口：

```typescript
// 主要职责：
// 1. 导入所有子组件
// 2. 协调各组件间的数据流动
// 3. 处理组件间的事件通信
// 4. 初始化各子组件
```

## 数据流动

```
用户操作
    ↓
index.vue (协调层)
    ├── StatsCard (统计)
    ├── SchemaSelection (选择Schema)
    │   └── FormSection (填写表单)
    │       └── UploadTaskPanel (显示任务)
    ├── FileList (文件列表)
    │   ├── FileDetailDialog (详情)
    │   └── LineageDialog (世系图)
    └── useFileUpload Hook (上传管理)
```

## 样式管理

所有组件均使用 **Tailwind CSS** 和 **Element Plus** 的 CSS 变量：
- 完整支持浅色/深色主题
- 响应式设计（支持移动端）
- 使用 `clamp()` 实现流体排版

## 关键特性保留

✅ 动态表单生成（支持嵌套对象、多文件等）
✅ 文件格式验证
✅ 多文件并行上传
✅ 上传进度追踪
✅ 任务管理（取消、移除）
✅ ECharts 世系图渲染
✅ 分页列表
✅ 搜索和过滤
✅ 详细信息展示
✅ 主题适配

## 接口一致性

所有接口调用方式保持与原版本一致：
- API 端点未变更
- 请求参数格式保持一致
- 响应数据处理逻辑保持一致
- 类型定义完全对应

## 性能优化

- ✨ 组件按需加载
- 📦 减少单文件体积
- 🔄 提高代码复用性
- 🎯 便于单元测试
- 🧹 改善代码可维护性

## 使用示例

```vue
<!-- 在其他地方使用单独的组件 -->
<template>
  <div>
    <!-- 使用文件列表组件 -->
    <FileList
      ref="fileListRef"
      @detail="handleShowDetail"
      @lineage="handleShowLineage"
    />
    
    <!-- 使用表单组件 -->
    <FormSection
      ref="formSectionRef"
      :schema="selectedSchema"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FileList from '@/views/file/modules/FileList.vue'
import FormSection from '@/views/file/modules/FormSection.vue'

const fileListRef = ref()
const formSectionRef = ref()
</script>
```

## 迁移指南

原有的所有功能都已保留，接口保持一致。页面使用方式无需改变。

### 调试建议

1. 检查浏览器控制台的组件树
2. 使用 Vue DevTools 检查各组件的状态
3. 查看网络请求确保 API 调用正常
4. 检查样式是否正确应用

## 后续扩展建议

1. 提取更多的逻辑为独立的 composable
2. 添加单元测试
3. 支持拖拽上传
4. 添加上传历史
5. 支持断点续传

---

重构完成时间：2025-12-01
