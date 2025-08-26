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
      roles: string[];
      buttons: string[];
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

    type FileType = 'txt' | 'pdf' | 'vcf' | 'csv';

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

    /** 可视化结果，只能是四种文件类型中的一种 */
    type Result =
      | { type: 'vcf'; data: VcfData[] }
      | { type: 'csv'; data: CsvResult }
      | { type: 'txt'; data: string }
      | { type: 'pdf'; data: string }; // PDF data is a URL string
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
}
