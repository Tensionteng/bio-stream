/**
 * Namespace Api
 *
 * All backend api type
 */
declare namespace Api {
  namespace Common {
    /** common params of paginating */
    interface PaginatingCommonParams {
      /** current page number */
      current: number;
      /** page size */
      size: number;
      /** total count */
      total: number;
    }

    /** common params of paginating query list data */
    interface PaginatingQueryRecord<T = any> extends PaginatingCommonParams {
      records: T[];
    }

    /** common search params of table */
    type CommonSearchParams = Pick<Common.PaginatingCommonParams, 'current' | 'size'>;

    /**
     * enable status
     *
     * - "1": enabled
     * - "2": disabled
     */
    type EnableStatus = '1' | '2';

    /** common record */
    type CommonRecord<T = any> = {
      /** record id */
      id: number;
      /** record creator */
      createBy: string;
      /** record create time */
      createTime: string;
      /** record updater */
      updateBy: string;
      /** record update time */
      updateTime: string;
      /** record status */
      status: EnableStatus | undefined;
    } & T;
  }

  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface LoginToken {
      token: string;
      refreshToken: string;
    }

    interface UserInfo {
      userId: string;
      userName: string;
      permissions: string[];
    }
  }

  namespace Files {
    interface Schema {
      id: number;
      name: string;
      schema_json: object;
    }
    /** 文件 Schema 信息 */
    interface FileSchemaInfo {
      schemas: Schema[];
    }

    interface FileStatistics {
      total_files: number;
      total_size: number;
      last_upload_time: string;
    }

    interface UserItem {
      user_id: number;
      user_name: string;
    }

    interface FileItem {
      file_id: number;
      file_name: string;
      file_size: number;
      created_time: string;
      upload_user: UserItem;
    }

    interface FileList {
      count: number;
      page: number;
      page_size: number;
      results: FileItem[];
    }

    interface FileUpload {
      field_name: string;
      filename: string;
      content_type: string;
    }

    interface FileBatchUploadItem {
      sample_id: string;
      fields: FileUpload[];
    }

    interface FileBatchUploadInit {
      sample_id: string;
      fileds: FileUpload[];
    }

    interface FileUploadUrl {
      field_name: string;
      upload_url: string;
      s3_key: string;
    }

    interface FileUploadInitResponse {
      status: string;
      upload_urls: FileUploadUrl[];
    }

    interface UploadedFile {
      field_name: string;
      origin_filename: string;
      s3_key: string;
      file_type: string;
      file_size: number;
      file_md5: string;
    }

    interface FileUploadCompleteResponse {
      status: string;
      file_id: number;
    }

    interface FileDetailSubfile {
      origin_filename: string;
      field_name: string;
      file_type: string;
      file_size: number;
      file_hash: string;
      upload_time: string;
    }

    interface FileDetail {
      file_id: number;
      file_name: string;
      file_size: number;
      created_time: string;
      upload_user: UserItem;
      description_json: object;
      uploaded_subfiles: FileDetailSubfile[];
    }

    interface TaskItem {
      user: string;
      time: string;
      task_units: [
        {
          task_unit_id: string; // 任务id
          id: string; // 执行顺序编号
          task_unit_name: string;
        }
      ];
    }

    interface FileUserItem {
      file_id: string;
      file_name: string;
      file_type: string;
      user: string; // 上传用户
    }

    interface FileGenealogy {
      Genealogy: [
        {
          file1: FileUserItem; // 上游文件
          task: TaskItem; // 任务信息
          file2: FileUserItem; // 下游文件
        }
      ];
    }
  }

  namespace Home {
    interface FileType {
      file_type_name: string;
      count: number;
      size: number;
    }

    interface FileTypesResponse {
      file_types: FileType[];
      total_count: number;
      total_size: number;
    }

    interface TaskStatus {
      status: string;
      count: number;
    }

    interface TaskStatusResponse {
      status: TaskStatus[];
    }

    interface Event {
      event_time: string;
      event_message: string;
      event_type: string;
    }

    interface EventsResponse {
      events: Event[];
    }
  }

  namespace Visualization {
    /** 任务信息 */
    interface TaskInfo {
      task_id: number;
      file_type: FileType[];
    }

    /** 可视化配置信息 */
    interface ConfigInfo {
      supported_formats: FileType[];
      default_format: FileType;
    }

    type FileType = 'txt' | 'pdf' | 'vcf' | 'csv' | 'image' | 'graph';

    /** Graph 图数据结构 */
    interface GraphItem {
      from: string;
      to: string;
    }

    type GraphData = GraphItem[];

    /** VCF文件数据结构 */
    interface VcfData {
      [key: string]: string; // 所有列都是动态的
    }

    /** CSV文件数据结构 */
    interface CsvData {
      [key: string]: number | string; // 所有列都是动态的
    }

    /** CSV文件数据结构 - 返回的键名由后端动态给出 */
    interface CsvResult {
      [key: string]: CsvData[];
    }

    interface ImageData {
      url: string;
      name?: string;
    }

    type ImageResult = ImageData[];

    /** 可视化结果，只能是五种文件类型中的一种 */
    type Result =
      | { type: 'vcf'; data: VcfData[] }
      | { type: 'csv'; data: CsvResult }
      | { type: 'txt'; data: string }
      | { type: 'pdf'; data: string }
      | { type: 'image'; data: ImageResult }
      | { type: 'graph'; data: GraphData };
  }
  /**
   * namespace Route
   *
   * backend api module: "route"
   */
  namespace Route {
    type ElegantConstRoute = import('@elegant-router/types').ElegantConstRoute;

    interface MenuRoute extends ElegantConstRoute {
      id: string;
    }

    interface UserRoute {
      routes: MenuRoute[];
      home: import('@elegant-router/types').LastLevelRouteKey;
    }
  }

  /**
   * namespace SystemManage
   *
   * backend api module: "systemManage"
   */
  namespace SystemManage {
    type CommonSearchParams = Pick<Common.PaginatingCommonParams, 'current' | 'size'>;

    /** role */
    type Role = Common.CommonRecord<{
      /** role name */
      roleName: string;
      /** role code */
      roleCode: string;
      /** role description */
      roleDesc: string;
    }>;

    /** role search params */
    type RoleSearchParams = CommonType.RecordNullable<
      Pick<Api.SystemManage.Role, 'roleName' | 'roleCode' | 'status'> & CommonSearchParams
    >;

    /** role list */
    type RoleList = Common.PaginatingQueryRecord<Role>;

    /** all role */
    type AllRole = Pick<Role, 'id' | 'roleName' | 'roleCode'>;

    /**
     * user gender
     *
     * - "1": "male"
     * - "2": "female"
     */
    type UserGender = '1' | '2';

    /** user */
    type User = Common.CommonRecord<{
      /** user name */
      userName: string;
      /** user gender */
      userGender: UserGender | undefined;
      /** user nick name */
      nickName: string;
      /** user phone */
      userPhone: string;
      /** user email */
      userEmail: string;
      /** user role code collection */
      userRoles: string[];
    }>;

    /** user search params */
    type UserSearchParams = CommonType.RecordNullable<
      Pick<Api.SystemManage.User, 'userName' | 'userGender' | 'nickName' | 'userPhone' | 'userEmail' | 'status'> &
        CommonSearchParams
    >;

    /** user list */
    type UserList = Common.PaginatingQueryRecord<User>;

    /**
     * menu type
     *
     * - "1": directory
     * - "2": menu
     */
    type MenuType = '1' | '2';

    type MenuButton = {
      /**
       * button code
       *
       * it can be used to control the button permission
       */
      code: string;
      /** button description */
      desc: string;
    };

    /**
     * icon type
     *
     * - "1": iconify icon
     * - "2": local icon
     */
    type IconType = '1' | '2';

    type MenuPropsOfRoute = Pick<
      import('vue-router').RouteMeta,
      | 'i18nKey'
      | 'keepAlive'
      | 'constant'
      | 'order'
      | 'href'
      | 'hideInMenu'
      | 'activeMenu'
      | 'multiTab'
      | 'fixedIndexInTab'
      | 'query'
    >;

    type Menu = Common.CommonRecord<{
      /** parent menu id */
      parentId: number;
      /** menu type */
      menuType: MenuType;
      /** menu name */
      menuName: string;
      /** route name */
      routeName: string;
      /** route path */
      routePath: string;
      /** component */
      component?: string;
      /** iconify icon name or local icon name */
      icon: string;
      /** icon type */
      iconType: IconType;
      /** buttons */
      buttons?: MenuButton[] | null;
      /** children menu */
      children?: Menu[] | null;
    }> &
      MenuPropsOfRoute;

    /** menu list */
    type MenuList = Common.PaginatingQueryRecord<Menu>;

    type MenuTree = {
      id: number;
      label: string;
      pId: number;
      children?: MenuTree[];
    };
  }

  namespace Permission {
    /** 权限类型 */
    type PermissionType = 'file' | 'scene' | 'task' | 'genealogy' | 'task_chain' | 'task_unit' | 'admin';

    /** 权限状态 */
    type PermissionStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'ERROR';

    /** 用户权限 */
    interface UserPermission {
      id: number;
      userId: string;
      userName: string;
      permissionType: PermissionType;
      status: PermissionStatus;
      days: number;
      createTime: string;
      expireTime?: string;
      grantedTime?: string;
    }

    /** 权限申请 */
    interface PermissionRequest {
      request_id: number;
      userId: string;
      userName: string;
      permissionType: PermissionType;
      requestTime: string;
      days: number;
      reason: string;
      status: PermissionStatus;
      createBy: string;
      createTime: string;
      updateBy: string;
      updateTime: string;
      expireTime?: string;
      reviewerId: string;
      reviewerName: string;
      reviewTime?: string;
      reviewComment?: string;
    }

    /** 权限申请参数 */
    interface PermissionApplyParams {
      permissionType: PermissionType;
      days: number;
      reason: string;
    }

    /** 权限审批参数 */
    interface PermissionReviewParams {
      requestId: number;
      approve: boolean;
      comment?: string;
    }

    /** 权限搜索参数 */
    interface PermissionSearchParams {
      permissionType: PermissionType | null;
      userName: string | null;
      current: number;
      size: number;
    }
  }
  namespace Task {
    /** 任务状态类型 */
    type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

    /** 单个任务单元详情 */
    interface ExecutionUnit {
      name: string;
      description: string;
      type: string;
      start_time: string | null;
      end_time: string | null;
      status: 'success' | 'running' | 'failed' | string;
      upload_status: 'Success' | 'Running' | 'Failed' | 'Pending';
      message: string;
      result: string | null;
    }

    /** 流程图节点 */
    interface ExecutionFlowStep {
      name: string;
      status: string;
      message: string | null;
      /** 该步骤涉及的文件列表 */
      files: string[];
    }

    /** 任务详情的完整类型 */
    interface TaskDetail {
      id: number;
      /** 任务/流程名称 */
      name: string;
      /** 任务来源类型 */
      task_source_type: string;
      file_ids: number[];
      start_time: string;
      end_time: string | null;
      status: string;
      upload_status: 'Success' | 'Running' | 'Failed' | 'Pending' | string;
      total_units?: number;
      success_units?: number;
      error_summary: string | null;
      execution_flow: ExecutionFlowStep[];
      result_json: {
        process_name: string;
        total_units: number;
        success_units: number;
        execution_units: Record<string, ExecutionUnit>;
      };
    }

    /** 任务列表项 */
    interface TaskListItem {
      id: number;
      name: string;
      task_source_type: string;
      file_ids: number[];
      file_name: string;
      start_time: string;
      end_time: string | null;
      status: TaskStatus;
      error_summary: string | null;
    }

    /** 任务列表查询参数 */
    interface TaskListParams {
      page?: number;
      page_size?: number;
      /** 运行状态 */
      status?: TaskStatus;
      /** task_chain或者process名字 */
      name?: string;
      /** 任务ID */
      task_id?: number;
      /** 任务来源：只支持 process 和 task_chain */
      task_source_type?: string;
    }

    /** 停止任务响应 */
    interface StopTaskResponse {
      status: string;
      message: string;
    }

    /** 重启任务响应 */
    interface RestartTaskResponse {
      new_task_id: number;
      status: string;
      message: string;
    }

    /** 上传状态 Payload */
    interface UploadStatusPayload {
      task_id: number;
      upload_status: 'Success' | 'Failed' | 'Running' | 'Pending';
    }

    /** 流程描述信息 */
    interface ProcessDescription {
      process_name: string;
      total_units: number;
      execution_units: ExecutionUnit[];
      execution_strategy: Record<string, any>;
    }

    /** 流程列表项 */
    interface ProcessListItem {
      process_id: number;
      name: string;
      description: ProcessDescription;
    }

    /** 流程 Schema 定义 */
    interface ProcessSchema {
      process_id: number;
      parameter_schema: Record<string, any>;
      input_file_type: number;
    }

    /** 创建新任务 Payload */
    interface NewTaskPayload {
      process_id: number;
      parameter_json: Record<string, any>;
    }

    /** 创建新任务响应数据 */
    interface NewTaskData {
      task_id: number;
      status: string;
      message: string;
    }

    /** 创建新任务响应包装 */
    interface NewTaskResponse {
      code: string;
      message: string;
      data: NewTaskData;
    }

    /** 手动上传文件项 */
    interface UploadMapItem {
      filed_name: string;
      file_dir: string;
    }

    /** 选择文件上传 Payload */
    interface SelectFileUploadPayload {
      meta_file_id: number;
      uploads: UploadMapItem[];
      content_json: Record<string, any>;
    }

    /** 文件上传响应 */
    interface UploadTaskResponse {
      message: string;
      code: string;
    }

    /** 任务清理响应 */
    interface TaskCleanupResponse {
      free_size_size: number;
    }

    /** 任务总大小响应 */
    interface TaskTotalSizeResponse {
      total_size: number;
    }

    /** 任务各级别大小响应 */
    interface TaskFileSizeResponse {
      size_0: number;
      size_1: number;
      size_2: number;
      size_3: number;
      [key: string]: number;
    }

    /** 文件 Schema 项 */
    interface FileSchemaItem {
      id: number;
      name: string;
      schema_json: Record<string, any>;
    }

    /** 文件 Schema 列表响应 */
    interface FileSchemaListResponse {
      schemas: FileSchemaItem[];
    }

    /** 任务列表响应结构 (匹配后端 { count, results, ... }) */
    interface TaskListResponse {
      count: number;
      page: number;
      page_size: number;
      results: TaskListItem[];
    }
    /** 任务详情的输入输出文件 */
    interface InOutData {
      input: string; // 输入文件前几行内容
      output: string; // 输出文件前几行内容
    }
    // 1. 基础节点接口：包含所有节点共有的字段 (id, type, name)
    export interface FlowNodeBase {
      id: number;
      type: string; // 'function', 'data', 'if', 'start', 'end'
      name: string; // ✅ 新增：根据接口截图，所有节点都有 name
    }

    // 2. 分支情况接口 (用于 IF 节点)
    export interface BranchCase {
      desc: string; // 条件描述 (例如 "QC > 20")
      to: number; // 指向的节点 ID
    }

    // 3. 普通节点接口 (Function / Data)
    // ✅ 只有普通节点才有 desc 和 to
    export interface NormalFlowNode extends FlowNodeBase {
      desc: string; // 描述信息
      to?: number; // 指向下一个 ID (可选，结束节点可能没有)
    }

    // 4. IF 节点接口
    // ✅ IF 节点没有 desc，而是使用 case 数组
    export interface IfFlowNode extends FlowNodeBase {
      case: BranchCase[]; // 分支逻辑
    }

    // 5. 联合类型，用于数组
    export type TaskFlowNode = NormalFlowNode | IfFlowNode;

    // 6. 响应结构 (对应 API 返回的 data 字段内容)
    export interface TaskFlowData {
      nodes: TaskFlowNode[];
    }
  }
}
