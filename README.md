# 小微财报 MVP

一个原生微信小程序财务月报 MVP，面向小微企业老板和兼职会计。

## 当前功能

- 企业初始化与资料维护
- 月份切换和月报状态管理
- 资产、负债、所有者权益填报
- 收入、成本、费用填报
- 金额按整数分计算，避免浮点误差
- 资产负债平衡校验
- 财务风险和异常提示
- 月报草稿、确认和撤销确认
- 资产负债表
- 利润表
- 毛利率、净利率、资产负债率、流动比率
- 近六个月收入与利润趋势
- 演示数据生成
- JSON 数据备份复制

## 页面结构

- `pages/index`：经营首页
- `pages/add`：月报填报
- `pages/stats`：财务报表
- `pages/profile`：企业和数据管理
- `pages/setup`：企业初始化

## 数据层

- `utils/report.js`：字段定义、金额计算、报表计算和校验
- `repositories/report-repository.js`：云端优先、本地兜底的统一 Repository
- `repositories/cloud-report-repository.js`：CloudBase 云端调用实现
- `utils/store.js`：本地缓存、离线兜底和演示数据
- `cloudfunctions/report-service`：身份、企业权限、月报、版本和审计云函数

当前版本已接入 CloudBase Repository，并保留微信本地 Storage 作为环境不可用时的兜底。后续商业化仍需要增加：

- 成员邀请和角色管理页面
- 自动备份与恢复流程
- Excel 导入
- 服务端 PDF/Excel 导出
- 敏感数据加密

## 本地检查

```bash
node tests/report.test.js
node tests/repository.test.js
```

使用微信开发者工具打开项目即可运行。首次进入会跳转到企业初始化页面；也可以在“我的”页面加载六个月演示数据。

## CloudBase Repository

当前项目已配置云开发环境：

```text
cloud1-8g7tc4p441c51f6d
```

环境配置位于：

```text
config/env.js
```

云端实现位于：

```text
repositories/cloud-report-repository.js
repositories/report-repository.js
cloudfunctions/report-service/
```

运行策略：

1. 优先调用 `report-service` 云函数。
2. 云环境、云函数或数据库不可用时，自动切换到本地 Repository。
3. 云端首次可用且云端暂无企业时，会尝试迁移本机已有企业和月报数据。
4. “我的”页面可以查看云端状态并重新检测连接。

### 部署前创建集合

在云开发控制台创建以下集合：

```text
companies
company_members
monthly_reports
report_versions
audit_logs
```

小程序客户端不直接访问数据库，正式环境建议关闭客户端对这些集合的直接读写权限，所有操作都经过云函数。

### 部署云函数

在微信开发者工具中右键：

```text
cloudfunctions/report-service
```

选择“上传并部署：云端安装依赖”。

云函数部署完成后，打开小程序“我的”，点击“检测连接”。
