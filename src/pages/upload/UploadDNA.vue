<script setup lang="ts">
import type {
  FormInstance,
  FormRules,
  UploadFile,
  UploadInstance,
  UploadProps,
  UploadRawFile,
  UploadUserFile
} from "element-plus"
import { UploadFilled } from "@element-plus/icons-vue"
// 同时导入原始的 axios，用于直接上传到 S3
import axios from "axios"
import { ElLoading, ElMessage } from "element-plus"
import { reactive, ref } from "vue"
// 假设这是你封装的请求模块
import { request } from "@/http/axios"

const formData = reactive({
  sample_id: "",
  // file_locations 主要用于触发表单校验，而不直接存储文件对象
  file_locations: {
    json_file: "",
    fq_file1: "",
    fq_file2: ""
  },
  source_type: "DNA"
})

// 为每个上传组件创建独立的 ref，用于存储文件列表
const jsonFileList = ref<UploadUserFile[]>([])
const fq1FileList = ref<UploadUserFile[]>([])
const fq2FileList = ref<UploadUserFile[]>([])

const formRef = ref<FormInstance>()
// 保留对 el-upload 组件的 ref，用于未来可能需要调用其内置方法
const jsonUploadRef = ref<UploadInstance>()
const fq1UploadRef = ref<UploadInstance>()
const fq2UploadRef = ref<UploadInstance>()

const isLoading = ref(false)

const formRules = reactive<FormRules>({
  "sample_id": [{ required: true, message: "样本唯一标识符不能为空", trigger: "blur" }],
  "file_locations.json_file": [{ required: true, message: "请选择一个 JSON 文件", trigger: "change" }],
  "file_locations.fq_file1": [{ required: true, message: "请选择一个 FASTQ 文件", trigger: "change" }],
  "file_locations.fq_file2": [{ required: true, message: "请选择一个 FASTQ 文件", trigger: "change" }]
})

// 更新文件状态处理函数，主要用于触发表单校验
function handleFileChange(fileKey: keyof typeof formData.file_locations, file: UploadFile) {
  // 当文件状态变为 'ready' (即选择成功) 时，更新 formData 中的对应字段以触发表单校验
  if (file.status === "ready") {
    formData.file_locations[fileKey] = file.name
  }
}

function handleFileRemove(fileKey: keyof typeof formData.file_locations) {
  // 当文件被移除时，清空 formData 中的对应字段
  formData.file_locations[fileKey] = ""
}

const handleExceed: UploadProps["onExceed"] = () => {
  ElMessage.warning("每个位置只能选择一个文件，请先移除已选文件再重新选择。")
}

// 修改表单重置函数
function resetForm() {
  formRef.value?.resetFields()
  // 直接清空我们自己维护的 file-list，el-upload 的显示会自动同步更新
  jsonFileList.value = []
  fq1FileList.value = []
  fq2FileList.value = []
  // 同时清空用于校验的字段
  formData.file_locations.json_file = ""
  formData.file_locations.fq_file1 = ""
  formData.file_locations.fq_file2 = ""
}

async function submitForm() {
  const valid = await formRef.value?.validate()
  if (!valid) {
    ElMessage.error("表单包含错误，请检查所有必填项")
    return
  }

  isLoading.value = true
  const loadingInstance = ElLoading.service({
    lock: true,
    text: "正在初始化上传...",
    background: "rgba(0, 0, 0, 0.7)"
  })

  try {
    // 从我们自己维护的 ref 中获取文件，以解决类型问题
    const filesToUpload: { field_name: string, file: UploadRawFile }[] = [
      { field_name: "json_file", file: jsonFileList.value[0].raw! },
      { field_name: "fq_file1", file: fq1FileList.value[0].raw! },
      { field_name: "fq_file2", file: fq2FileList.value[0].raw! }
    ]

    // 步骤 1: 调用后端 initiate 接口获取预签名上传 URL
    loadingInstance.setText("正在获取上传授权...")
    const initiateRequestPayload = {
      file_type_id: 1,
      uploads: filesToUpload.map(({ field_name, file }) => ({
        field_name,
        filename: file.name,
        content_type: file.type || "application/octet-stream"
      }))
    }

    const initiateResponse = await request<any>({
      url: "/files/upload/initiate",
      method: "POST",
      data: initiateRequestPayload
    })
    console.log(initiateRequestPayload)
    if (initiateResponse.status !== "success") {
      throw new Error(`初始化上传失败: ${initiateResponse.message || "未知错误"}`)
    }
    const uploadUrls = initiateResponse.upload_urls

    // 步骤 2: 使用 Axios 并行上传文件到 S3
    loadingInstance.setText("正在上传文件，请稍候...")
    const uploadPromises = uploadUrls.map((urlInfo: any) => {
      const fileToUpload = filesToUpload.find(f => f.field_name === urlInfo.field_name)?.file
      if (!fileToUpload) {
        throw new Error(`找不到与 field_name "${urlInfo.field_name}" 匹配的文件`)
      }

      return axios.put(urlInfo.upload_url, fileToUpload, {
        headers: {
          "Content-Type": fileToUpload.type || "application/octet-stream"
        },
        timeout: 60 * 60 * 1000 // 设置1小时超时
      })
    })

    await Promise.all(uploadPromises)

    // 步骤 3: 读取 JSON 内容并调用后端 complete 接口
    loadingInstance.setText("正在完成上传记录...")

    const jsonFile = filesToUpload.find(f => f.field_name === "json_file")!.file
    const descriptionJson = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          resolve(JSON.parse(e.target!.result as string))
        } catch (err) {
          console.log(err)
          reject(new Error("解析JSON文件失败!"))
        }
      }
      reader.onerror = () => reject(new Error("读取JSON文件失败!"))
      reader.readAsText(jsonFile)
    })

    const completeRequestPayload = {
      file_type_id: 1,
      file_name: formData.sample_id,
      description_json: descriptionJson,
      uploaded_files: uploadUrls.map((urlInfo: any) => {
        const fileInfo = filesToUpload.find(f => f.field_name === urlInfo.field_name)!.file
        return {
          field_name: urlInfo.field_name,
          origin_filename: fileInfo.name,
          s3_key: urlInfo.s3_key,
          file_type: `.${fileInfo.name.split(".").pop()}`,
          file_size: fileInfo.size
        }
      })
    }

    const completeResponse = await request<any>({
      url: "/api/file/upload/complete",
      method: "POST",
      data: completeRequestPayload
    })

    if (completeResponse.status !== "success") {
      throw new Error(`完成上传失败: ${completeResponse.message || "未知错误"}`)
    }

    ElMessage.success(`上传成功！文件ID: ${completeResponse.file_id}`)
    resetForm()
  } catch (error: any) {
    console.error("上传过程中发生错误:", error)
    const errorMessage = error.message || "上传失败，请检查网络或联系管理员"
    if (!error.message?.includes("取消")) {
      ElMessage.error(errorMessage)
    }
  } finally {
    isLoading.value = false
    loadingInstance.close()
  }
}
</script>

<template>
  <div class="form-page-container">
    <el-card class="upload-card">
      <template #header>
        <div class="card-header">
          <el-icon><UploadFilled /></el-icon>
          <span>DNA 样本信息上传</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="160px"
        label-position="right"
        class="main-form"
      >
        <el-row :gutter="30">
          <el-col :xs="24" :sm="12">
            <el-form-item label="样本唯一标识符" prop="sample_id">
              <el-input
                v-model="formData.sample_id"
                placeholder="例如：Sample_ProjectX_001"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="生物分子类型" prop="source_type">
              <el-input v-model="formData.source_type" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">
          <span class="divider-text">文件上传</span>
        </el-divider>

        <el-row :gutter="20">
          <el-col :xs="24" :md="8">
            <el-form-item label-width="0" prop="file_locations.json_file">
              <el-upload
                ref="jsonUploadRef"
                v-model:file-list="jsonFileList"
                class="upload-dragger"
                action="#"
                drag
                :limit="1"
                :auto-upload="false"
                :on-change="(file) => handleFileChange('json_file', file)"
                :on-remove="() => handleFileRemove('json_file')"
                :on-exceed="handleExceed"
                accept=".json"
              >
                <el-icon class="el-icon--upload">
                  <UploadFilled />
                </el-icon>
                <div class="el-upload__text">
                  拖拽或 <em>点击上传 JSON 元数据</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    请提供 .json 格式的元数据文件
                  </div>
                </template>
              </el-upload>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label-width="0" prop="file_locations.fq_file1">
              <el-upload
                ref="fq1UploadRef"
                v-model:file-list="fq1FileList"
                class="upload-dragger"
                action="#"
                drag
                :limit="1"
                :auto-upload="false"
                :on-change="(file) => handleFileChange('fq_file1', file)"
                :on-remove="() => handleFileRemove('fq_file1')"
                :on-exceed="handleExceed"
                accept=".fq,.fastq,.gz"
              >
                <el-icon class="el-icon--upload">
                  <UploadFilled />
                </el-icon>
                <div class="el-upload__text">
                  拖拽或 <em>点击上传 FASTQ (R1)</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    请提供 .fq 或 .fastq 格式的 Read 1 文件
                  </div>
                </template>
              </el-upload>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label-width="0" prop="file_locations.fq_file2">
              <el-upload
                ref="fq2UploadRef"
                v-model:file-list="fq2FileList"
                class="upload-dragger"
                action="#"
                drag
                :limit="1"
                :auto-upload="false"
                :on-change="(file) => handleFileChange('fq_file2', file)"
                :on-remove="() => handleFileRemove('fq_file2')"
                :on-exceed="handleExceed"
                accept=".fq,.fastq,.gz"
              >
                <el-icon class="el-icon--upload">
                  <UploadFilled />
                </el-icon>
                <div class="el-upload__text">
                  拖拽或 <em>点击上传 FASTQ (R2)</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    请提供 .fq 或 .fastq 格式的 Read 2 文件
                  </div>
                </template>
              </el-upload>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item class="form-buttons">
          <el-button
            type="primary"
            size="large"
            @click="submitForm"
            :icon="UploadFilled"
            :loading="isLoading"
            :disabled="isLoading"
          >
            {{ isLoading ? '上传中...' : '提 交' }}
          </el-button>
          <el-button size="large" @click="resetForm" :disabled="isLoading">
            重 置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.form-page-container {
  padding: 20px;
  box-sizing: border-box;
}

.upload-card {
  max-width: 1200px;
  margin: 20px auto;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
}

.card-header {
  display: flex;
  align-items: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-header .el-icon {
  margin-right: 12px;
  font-size: 1.3rem;
}

.main-form {
  padding: 10px 20px 0 0;
}

.divider-text {
  font-size: 1rem;
  font-weight: 500;
}

/* 统一的上传拖拽区域样式 */
.upload-dragger {
  width: 100%;
}

:deep(.el-upload) {
  width: 100%;
}

:deep(.el-upload-dragger) {
  width: 100%;
  padding: 30px 10px;
  border: 2px dashed var(--el-border-color);
  transition:
    border-color 0.3s,
    background-color 0.3s;
  /* ✨ 新增：Flex 布局实现内部元素完美居中 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

:deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

:deep(.el-upload-dragger .el-icon--upload) {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 16px;
  /* ✨ 修改：移除 margin-top，因为 flex 会自动处理居中 */
}

:deep(.el-upload-dragger .el-upload__text) {
  color: #606266;
  font-size: 14px;
}

:deep(.el-upload-dragger .el-upload__text em) {
  color: var(--el-color-primary);
  font-style: normal;
}

.el-upload__tip {
  line-height: 1.2;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

/* 调整文件列表显示，使其不与提示文字重叠 */
:deep(.el-upload-list) {
  margin-top: 10px;
}

.form-buttons {
  margin-top: 40px;
}

/* ✨ 新增：通过 :deep 选择器让按钮在表单内完美居中 */
.form-buttons :deep(.el-form-item__content) {
  display: flex;
  justify-content: center;
  gap: 20px;
}

/* 覆盖 el-form-item 的 margin-bottom，使其在响应式布局中表现更好 */
.el-form-item {
  margin-bottom: 22px;
}

/* 在小屏幕上，让上传区域垂直堆叠时有一定间距 */
@media (max-width: 992px) {
  .el-col-md-8:not(:last-child) .el-form-item {
    margin-bottom: 28px;
  }
}
</style>
