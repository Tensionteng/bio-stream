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
    }

    interface FileTypesResponse {
      file_types: FileType[];
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

    type FileType = 'txt' | 'pdf' | 'vcf' | 'csv' | 'image';

    /** VCF文件数据结构 */
    interface VcfData {
      [key: string]: string; // 所有列都是动态的
    }

    /** CSV文件数据结构 */
    interface CsvData {
      [key: string]: number | string; // 所有列都是动态的
    }

    /** CSV文件数据结构 - 新的返回格式 */
    interface CsvResult {
      count_csv: CsvData[];
      fpk_csv: CsvData[];
      tpm_csv: CsvData[];
    }

    interface ImageData {
      url: string;
      name?: string;
    }

    type ImageResult = ImageData[];

    /** 可视化结果，只能是四种文件类型中的一种 */
    type Result =
      | { type: 'vcf'; data: VcfData[] }
      | { type: 'csv'; data: CsvResult }
      | { type: 'txt'; data: string }
      | { type: 'pdf'; data: string }
      | { type: 'image'; data: ImageResult };
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
      id: number;
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
}
