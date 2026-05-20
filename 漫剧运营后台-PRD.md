# 漫剧运营后台 PRD

> 来源：[飞书知识库](https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf)（以飞书在线版本为准，本文件为快照）

## 版本记录

| 时间 | 版本 | 变更内容 | 变更人 |
|-|-|-|-|
| 2026.04.01 | v1.0 | 初稿 | 许庆阳 |

# 需求背景

- 当前漫剧项目已进入常态化运营阶段。现阶段，相关业务流程主要依赖**多维表格**进行维护和流转，随着产能提升与协作环节增多，逐渐暴露出流程分散、协同效率不足、过程追踪困难等问题。
- 为支撑漫剧业务的持续运营与规模化发展，需建设**漫剧运营后台**，实现从**书籍、剧本到漫剧**的全链路流程管理，覆盖内容生产、流转、状态追踪及运营协同等核心环节，从而提升整体业务效率，保障流程规范化、可视化和可追踪。

# 需求目标

- 建设漫剧运营后台，统一承接漫剧业务从**书籍、剧本到漫剧**的全流程管理，替代现有以多维表格为主的协作方式，提升业务流转效率与过程可控性。具体目标如下：

1. **实现全链路流程线上化管理**覆盖书籍筛选、剧本生成、漫剧制作、内容审核等核心环节，打通流程，形成统一的业务操作与流转平台。 
2. **提升跨角色协同效率**  
支持编剧、制作、审核等相关角色在同一后台内协作，减少信息分散、重复沟通和人工同步成本。 
3. **提升流程透明度与可追踪性**  
对各阶段任务状态、负责人、处理进度及产出结果进行统一记录，便于过程追踪、问题定位和节点管理。 
4. **规范业务流程与管理标准**  
通过系统化能力沉淀统一的流程规则、状态定义和操作规范，降低对人工维护和经验驱动的依赖。 
5. **支撑业务规模化运营**  
满足当前周产能下的业务管理需求，并为后续产能增长、流程扩展及精细化运营提供系统支撑。

# 名词解释

| **名词** | **说明** |
|-|-|
| 原书 | 剧本创作的来源内容，即上游书籍/小说资源。剧本通常基于原书内容进行改编。 |
| 原书卡点 | 上游书籍/小说资源的付费卡点。作为剧本付费卡点的参考。 |
| 原书ID | 原书在系统中的唯一标识，用于关联书籍资源与剧本内容。 |
| 剧本 | 漫剧制作的文本基础内容，包含剧情、分镜、对白、分集等信息，是后续视频制作的依据。 |
| 原剧本ID | 被改编、二创或多版本衍生时所关联的上游剧本标识，用于追踪剧本来源关系。 |
| 剧本分集 | 剧本内容拆分多集，用于漫剧制作分集参考。 |
| 付费卡点 | 根据剧本内容设置的付费勾子，用于漫剧上架时制定的付费集数。 |
| 类型 | 对剧本或任务所属类别的区分字段，如原作、多版本、不同任务类型等。 |
| 剧本二创 | 在已有剧本基础上进行再次加工、改写或版本衍生的编辑行为。剧本二创的产物类型为多版本 |
| 漫剧 | 由剧本进一步制作生成的视频内容成品，通常以分集形式管理，可关联封面、字幕视频及提审材料。 |
| 全集 | 根据剧本生成的第一版视频产物，主要用于内部确认和审核，通常不是最终对外提审版本。 |
| 分集 | 经内部修改和审核后形成的正式交付版本，通常包括分集视频、字幕版本、封面图及提审所需材料。 |
| 返修版 | 漫剧在外部审核或提审阶段未通过后，依据反馈意见修改形成的重新提交版本。 |
| 制作任务 | 从剧本发布出来、交由制作人员执行的视频制作工作单。 |
| 修改任务 | 因审核驳回或成品需返工而发起的修订型任务，与首次制作任务相对。 |
| 任务大厅 | 用于集中展示可领取、可查看、可流转任务的公共任务池。 |
| 任务类型 | 任务所属类别，通常区分为制作类任务、修改类任务等。 |
| 提审材料 | 提交审核时所需的配套资料，通常包括视频文件、封面图、版权证明等。 |
| 编剧 | 负责剧本创作、改写或二创的人员。 |
| 制作人 | 负责执行漫剧制作任务的人员。 |
| 审核员 | 负责对剧本、全集、分集或返修版进行审核处理的人员。 |

# 业务流程

<whiteboard token="Oq3VwPU9phC12wbrJtNcV3eznCf"></whiteboard>

1. 掌心故事会开放书籍API接口
2. 漫剧平台对接掌心故事会API接口，定时拉取书籍信息，落库书籍表
3. 主编可从书籍或已有剧本中挑选，进入剧本创作环节
4. 剧本创作完成后，提交审核，发布审核任务
5. 审核人员领取审核任务，对剧本进行审核

   1. 审核通过：落库剧本库
   2. 驳回修改：返回修改
   3. 审核不通过：结束
6. 从剧本发起漫剧制作任务，在任务大厅展示
7. 漫剧制作人员领取任务，开始全集制作
8. 漫剧制作人员输出【全集】成片，提交审核

   1. 审核通过：进入 分集制作
   2. 驳回修改：返回 全集制作
9. 漫剧制作人员输出【分集】成片，提交审核

   1. 审核通过：判断审核人员是否配置“二审”
   
      1. 无：落库成片库
      2. 有：由“二审用户”进行二审
      
         1. 审核通过：落库成片库
         2. 驳回修改：返回 分集制作
   2. 驳回修改：返回 分集制作
10. 漫剧提交站外审核

    1. 审核通过：结束
    2. 审核不通过：发起成片修改，进入 返修版制作
11. 修复完成提交审核

    1. 审核通过：更新漫剧成片，重新提交站外审核
    2. 驳回修改：返回 返修版制作

# 需求范围

- ●：v1版本
- ●：v1版本
- ●：v1版本

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>功能模块</td><td>功能点</td><td>作用</td></tr><tr><td rowspan="4">资源管理</td><td>书籍管理</td><td>管理原书资源，支持查询、查看和作为剧本创作的上游输入。</td></tr><tr><td>剧本管理</td><td>管理剧本资产，支持查看、编辑、二创及关联后续制作流程。</td></tr><tr><td>漫剧管理</td><td>管理漫剧成品及版本，支持查看详情、发起修改和成品维护。</td></tr><tr><td>书籍数据接入</td><td>接入上游书籍信息，为资源管理和剧本创作提供基础数据。</td></tr><tr><td rowspan="3">内容创作</td><td>剧本创作</td><td>基于书籍内容完成剧本编写、分集拆分和卡点配置。</td></tr><tr><td>漫剧制作</td><td>基于剧本生成视频内容，产出全集、分集及返修版。</td></tr><tr><td>版本提交</td><td>支持全集、分集、返修版的上传、保存和提交流转。</td></tr><tr><td rowspan="3">审核管理</td><td>剧本审核</td><td>对剧本内容进行审核，输出通过、驳回修改、不通过等结果。</td></tr><tr><td>漫剧审核</td><td>对全集、分集、返修版进行内容审核，确保成片满足要求。</td></tr><tr><td>审核记录</td><td>留存每次审核结果、审核意见和处理记录，便于追溯。</td></tr><tr><td rowspan="4">任务管理</td><td>任务发布</td><td>发布剧本审核、漫剧制作、漫剧审核等任务。</td></tr><tr><td>任务认领/分配</td><td>支持任务领取、指派和执行人流转。</td></tr><tr><td>任务流转</td><td>建立书籍、剧本、漫剧在各阶段之间的流转关系。</td></tr><tr><td>任务进度管理</td><td>跟踪任务状态，如待认领、制作中、审核中、已完成、已取消。</td></tr><tr><td rowspan="3">存储与上传下载</td><td>资源存储与管理</td><td>统一存储剧本、视频、封面、提审材料等内容资产。</td></tr><tr><td>文件上传</td><td>支持视频、图片、封面及提审材料上传。</td></tr><tr><td>文件下载</td><td>支持成品、图片及提审材料下载。</td></tr><tr><td rowspan="2">多媒体与编辑器</td><td>视频预览播放</td><td>支持在线视频预览，便于审核和内容确认。</td></tr><tr><td>富文本编辑器</td><td>支持剧本编辑、格式设置、分集拆分及卡点配置。</td></tr><tr><td rowspan="3">系统管理</td><td>注册/登录</td><td>后台用户注册/登录校验</td></tr><tr><td>角色管理</td><td>区分编剧、制作人、审核员、管理员等角色，并分配权限。</td></tr><tr><td>后台用户管理</td><td>管理后台人员账号、角色归属和使用权限</td></tr><tr><td rowspan="2">通知管理</td><td>邮件通知</td><td rowspan="2">审核结果通知给对应责任人</td></tr><tr><td>飞书通知</td></tr></tbody></table>

# 全局说明

## 筛选项

- 筛选区使用响应式流式布局，筛选控件按照既定顺序横向排列。
- 当容器宽度不足时，筛选项自动换行，不出现横向滚动。
- 操作按钮区固定置于筛选区最后一行末尾，包含“查询”“重置”按钮，按钮组保持右对齐展示。
- 筛选项文本框输入，前后空格自动删除，中间空格保留。
- 所有“ID类”的文本框筛选项，均为**精准搜索**；其他文本框筛选项为**模糊搜索**

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGI4NGU0NTgwYzFmMWY0MGMzNDBjMGU1YWJkZGJjMDlfZDhhYWYyMTE2MTk1ZjRhODE0MDc3OWJhYjI4MTk2YjJfSUQ6NzYyMzcwNjM4NTI4MTE5MTA5OF8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM)

## 表头

- 数据列表表头默认冻结在顶部，首行固定显示，不随列表内容的纵向滚动而移动。

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Yjg0NWJiMmFjMjJhMjdjMDMwYzNmMmRmMzIyMzMxYTVfZmNiMGEyYjc2NjE4MzQxYWIxNjk1ZTAyYzQxNzU2MGRfSUQ6NzYyMzcwNzc0MTMwMDgyMTIxMF8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM)

## 分页说明

- 所有表格在无特殊说明情况下，默认启用分页，默认每页展示 **10 条数据**。 
- 分页区域位于表格底部：**左侧展示当前数据总数，右侧展示分页器组件**。 
- 分页器支持切换每页展示数量，可选项为：**10 条 / 20 条 / 50 条 / 100 条**。 
- 分页区域固定展示在页面底部，**不随表格数据内容滚动**。

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzhhZWFjYTUyODdiMDdjODI0NDJmY2QzMmM1NTIyZWRfZGI1MGEzZDc2MmE5NDdlYzI3NzhiMGMzOGNlNDVjZGRfSUQ6NzYyMzcwNjU4NzgzMTU2OTM2Ml8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM)

## 数据展示

- 数据列内所有字段内容、卡片及操作按钮均保持**单行展示**，不自动换行。 
- 当前列数较少、未占满页面可用宽度时，各字段按容器宽度**自动拉伸并均匀分布**，以铺满整行。 
- 当列数较多或字段内容较长，导致页面可用宽度不足时，表格区域支持**横向滚动**，用户可通过左右滑动查看完整数据内容。

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTMxOTU3YzU4M2VmYWE5MzgwMDMzZTY4MWY2ZDQxOThfZWNhOTg4MWEzM2U5NmQwOTdkYzRjNDkzMjljNGFhYjRfSUQ6NzYyMzcwNzY1NTQzNzMzOTYwMl8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM)

## 字数统计规则

- 通用计算规则 ：中文字数量 + 连续英文块数 + 连续数字块数 + 连续符号块数（不含破折号序列和空白）。

| 类型 | 示例 | 是否计数 | 说明 |
|-|-|-|-|
| **中文字符** | `我`, `你` | ✅ 每个算 1 个字 | 独立单个汉字都计入 |
| **英文字母（连续）** | `Hello`, `abc` | ✅ 整个连续串算 1 个字 | 连续字母视为一个单元 |
| **数字（连续）** | `12345` | ✅ 整个连续串算 1 个字 | 连续数字视为一个单元 |
| **连续符号（特殊符号块）** | `...`, `!!!`, `??` | ✅ 整个连续符号串算 1 个字 | ASCII 33–126 范围的符号视为一个块 |
| **混合字母+数字** | `abc123` | ✅ 通常按连续性算 1 个字 | 属于连续 ASCII 范围字符 |
| **破折号序列 (“--”)** | `--` | ✅ 算 1 个字 | 计入一个 |
| **单个破折号 (“-”)** | `-` | ✅ 算 1 个字 | 计入一个 |
| **中文破折号 (“`——`”)** | `——` | ❌ 忽略 | 被标记为 `emptyWords` |
| **空格（英文/中文）** | `" "`, `"　"` | ❌ 忽略 | 属于空白字符 |
| **换行符 / 回车符** | `\n`, `\r` | ❌ 忽略 | 不计入 |
| **制表符** | `\t` | ❌ 忽略 | 不计入 |

## 文本框输入字数限制

- 所有文本输入框如设置了字数上限，用户输入内容超过限制时，超出部分不予保留，系统自动截断至允许的最大字数。

## 配置项提示

- 针对系统内各输入框及配置项，需定义并配置相应的校验规则。
- 当触发校验失败或需要进行信息提示时，系统应在对应输入框或配置项下方展示提示信息或错误提示，便于业务方准确定位具体问题项并及时处理。

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzM4ZDJjZTNhNzJkZmQ4YmE4NGY0OTk4YWNmYjBiMmZfYThlZmVhOGVhN2ZlZjZjMjkxOGZkNzY1NzJlYjJkNTlfSUQ6NzYzMTU0NzAzMDgwODU5NTY4MF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM)

## 文件上传

- 系统内存在多个文件上传场景，本节用于说明文件上传能力的**通用规则**；如具体业务页面有特殊要求，以对应页面需求为准。
-  用户点击上传入口后，系统需**调用系统文件选择器**，支持选择本地文件进行上传。

  - 当上传入口仅支持上传**1个文件**时，系统文件选择器仅支持**单选**
  - 当上传入口仅支持上传**多个文件**时，系统文件选择器支持**多选**
-  支持的文件格式

  - **视频**：`.mp4`、`.mov`
  - **图片**：`.jpg`、`.jpeg`、`.png`、`.gif`、`.webp`

### 上传中

- 上传过程中，需展示以下信息：

  - 文件名称
  - 文件大小
  - 上传进度

### 上传完成后

- 上传完成后，需展示以下信息： 

  - 文件名称
  - 文件大小
  - 上传状态：**上传完成**
- 需展示文件缩略图，支持点击预览：

  - **视频**：点击后弹出视频播放器，并自动播放当前视频
  - **图片**：点击后打开大图预览
-  **【删除】** button

  -  点击后删除当前文件
  -  删除后支持重新上传

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OGVkNGY3ZmIxMDBjNGZiNTA1OGM3OTQ3MjI4ODk5ZDJfMDEzYzcyYmE0NzE4NmM0YjIyYjA0MTM5YzcwMmI1M2VfSUQ6NzYyNDM3MjM1OTQxMTczMTM4N18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM)

## 视频播放器

- 为统一系统内各视频播放场景的交互表现，现对视频播放器的通用规则说明如下；如具体业务场景存在特殊要求，以页面实际需求为准。

1. 基础能力

   - 播放 / 暂停
   - 拖动进度条与点击跳转
   - 音量调节
   - 倍速播放
   - 全屏播放
2. 倍速范围：`0.5x`、`0.75x`、`1.0x`、`1.25x`、`1.5x`、`2.0x`

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDg0NzA2ZDgxZDc5NjA1NjVkMGUzZmJlZjhmMDE2MWNfY2I0ZjVmY2MwYTJkN2Q5YWYxNTRkYjU3OTQxZjA1NzRfSUQ6NzYyNDQyMDg3NTQ4NDU5NzQ0Nl8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM)

## 图片显示

- 为统一全平台图片查看体验，所有页面中的图片均需支持点击放大预览。

  1. 全平台图片默认支持点击放大查看，适用于列表缩略图、详情页图片、表单上传图片、审核意见图片、证明材料图片等所有图片展示场景。
  2. 当同一字段下存在多张图片时，用户点击任意一张图片进入放大预览后，可在预览态中通过左右切换查看该字段下的其他图片。
  3. 放大预览时，默认定位到用户当前点击的那张图片，并以该图片作为预览起始项。
  4. 同一字段下的图片应视为同一组图片进行预览，不同字段之间的图片不互相串联。
  5. 图片预览能力应在全平台保持一致，包括预览样式、切换方式、关闭方式和交互体验。

**说明：**

- “同一字段下的多张图片”是指同一个业务字段内上传或展示的图片集合，例如：版权证明材料、审核意见图片、修改意见图片等。
- 若字段下仅有 1 张图片，则点击后仅展示单张放大预览，不显示左右切换。

![](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Y2ZlMDhiYjRiZWYyODE4N2I3MjVjYzM0M2VjOTY0NTJfZTAxNTJjMzY3YjQyNWViOTk2OGFlOTk2NTllMzhiN2RfSUQ6NzYyNjQzNzkyNTYyMzQ5OTcyN18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM)

# 功能详情

## 交互原型

- 链接：http://10.235.120.235:3000/（本地部署，无法登录请联系<cite type="user" user-id="ou_3f5fabad01e91b7e3a2ecf531c9689f2"></cite>）
- 超管账密

  - 账号：admin@test.com
  - 密码：admin123
- https://github.com/xuqingyang1212-arch/comic-admin

## 账号注册

### 注册流程

1. 用户输入邮箱
2. 触发阿里云验证码（滑块验证）
3. 验证通过后，发送邮箱验证码
4. 用户输入邮箱验证码、密码、用户名
5. 提交注册申请，生成“待审核”注册申请
6. 审核人员进行审核

   1. 审核通过：账号正式生效，用户信息写入用户库
   2. 审核不通过：不创建正式账号（不落库），本次注册申请失效，该邮箱允许重新发起注册

### 格式校验

- 账号格式

  - 邮箱，需通过邮箱验证码校验有效性
  - 邮箱在系统平台内保持唯一
- 密码格式

  - 6\~24位
  - 可由数字、字母、常规符号 任意组合，区分大小写
- 邮箱验证码

  - 6位纯数字验证码
  - 有效期：60min
  - 测试环境：默认“000000”

## 账号登录

- 通过校验登录账号和登录密码，校验通过后，即可登录对应账号

### 登录流程

1. 用户输入账号（邮箱）与密码
2. 触发阿里云验证码（滑块验证）
3. 验证通过后，发起登录请求
4. 服务端校验： 

   - 账号是否存在 
   - 账号是否已审核通过 
   - 密码是否正确 
5. 校验通过后登录成功

### 登录限制

- 同一登录账号，最多可支持1个设备登录
- 当登录设备超出限制，旧设备将自动退出登录，返回登录页面

### 登录有效期

- 登录有效期为30天
- 超过有效期登录失效，需重新登录

## 阿里云验证码

- 接入阿里云验证码

  - [验证码Captcha - 交互验证 - 人机识别 - 云安全 - 阿里云](https://www.aliyun.com/product/security/captcha?spm=5176.30275541.J_ZGek9Blx07Hclc3Ddt9dg.1.25de2f3df65btx&scm=20140722.S_card@@%E4%BA%A7%E5%93%81@@2835505.S_new~UND~card.ID_card@@%E4%BA%A7%E5%93%81@@2835505-RL_%E4%BA%BA%E6%9C%BA%E9%AA%8C%E8%AF%81-LOC_2024SPSearchCard-OR_ser-PAR1_0b0b31d617689977175436607d0c2d-V_4-RE_new5-P0_0-P1_0)
  - [Web和H5客户端V3架构接入](https://help.aliyun.com/zh/captcha/captcha2-0/user-guide/new-architecture-for-web-and-h5-client-access?spm=a2c4g.11186623.0.0.12c66045fYtTvO)
- 触发时机

  - 注册：在每次发送邮箱验证码时触发，验证通过后，再向用户邮箱发送验证码
  - 登录：在提交登录请求时触发，验证通过后，再向服务端发送账号验证请求
  - 忘记密码：在每次发送邮箱验证码时触发，验证通过后，再向用户邮箱发送验证码
- 验证方式：使用 滑块方式 进行验证

## 权限管理

### 创建用户规则

#### 普通注册

-  用户自主发起注册 
-  注册成功并审核通过后，账号默认角色为空 

#### 邀请注册

-  用户通过角色邀请链接进入注册流程 
-  邀请链接需绑定一个明确角色 
-  注册成功并审核通过后，账号默认关联邀请链接对应角色

#### 邀请链接

- 每个角色对应一条邀请链接，通过链接注册的用户，默认关联对应角色
- 邀请链接参数要求

  - 每个角色对应一条链接，链接参数永久有效
  - 用于标识角色的参数，需加密且不可破解，
  - 例如：HMAC-SHA256，由研发决定

### 角色管理规则

- 角色是权限分配的核心单位。管理员通过角色统一配置权限，再将角色绑定给用户。
- 每个角色至少包含以下信息：

  - 角色名称
  - 备注
  - 权限树配置
- 权限采用树状多选器配置，支持：

  - 多选
  - 父子联动
  - 半选态
  - 展开 / 收起
  - 编辑时自动回填已选权限
- 权限项按“一级菜单 / 二级菜单 / 按钮权限”组织。

### 页面权限规则

- 若用户未分配某页面权限，则该页面不应通过菜单暴露，也不应允许直接访问页面地址进入。
- 若用户通过收藏链接、手动输入地址等方式访问无权限页面，应进行拦截处理。

### 按钮显示规则

- 按钮权限遵循“有权限才展示”的原则，不采用“按钮展示但点击后报无权限”的交互方式。

### 权限生效规则

- 用户登录成功后，系统根据当前绑定角色实时计算其可见菜单、页面和按钮权限。
- 当管理员修改用户角色或修改角色权限后，权限应在当前会话内刷新后即时生效。
- 若一个用户绑定多个角色，则权限按“并集”计算。
- 即：只要任一角色拥有某权限，该用户就拥有该权限。

<table><colgroup><col/><col/><col/><col/><col/><col/><col/><col/></colgroup><tbody><tr><td colspan="2">菜单</td><td>按钮</td><td>超级管理员</td><td>编剧</td><td>制作员</td><td>审核员</td><td>提审员</td></tr><tr><td rowspan="14">资源管理</td><td rowspan="3">书籍管理</td><td>列表数据</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td>创作剧本</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td>书籍详情</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td rowspan="4">剧本管理</td><td>列表数据</td><td>●</td><td>●</td><td>-</td><td>●</td><td>-</td></tr><tr><td>剧本详情</td><td>●</td><td>●</td><td>-</td><td>●</td><td>-</td></tr><tr><td>发布制作任务</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>剧本二创</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td rowspan="4">漫剧管理</td><td>列表数据</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td>漫剧详情</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td>下载</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td>发起修改</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td rowspan="3">下载中心</td><td>列表数据</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td>下载</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td>重试</td><td>●</td><td>-</td><td>-</td><td>-</td><td>●</td></tr><tr><td colspan="2" rowspan="5">剧本创作</td><td>列表数据</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td>剧本详情</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td>编辑</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td>删除</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td>审核记录</td><td>●</td><td>●</td><td>-</td><td>-</td><td>-</td></tr><tr><td rowspan="11">漫剧制作</td><td rowspan="5">任务大厅</td><td>列表数据</td><td>●</td><td>-</td><td>●</td><td>●</td><td>-</td></tr><tr><td>任务详情</td><td>●</td><td>-</td><td>●</td><td>●</td><td>-</td></tr><tr><td>领取任务</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td>取消任务</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>审核记录</td><td>●</td><td>-</td><td>●</td><td>●</td><td>-</td></tr><tr><td rowspan="6">我的任务</td><td>列表数据</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td>任务详情</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td>上传全集</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td>上传分集</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td>上传返修版</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td>审核记录</td><td>●</td><td>-</td><td>●</td><td>-</td><td>-</td></tr><tr><td rowspan="15">审核管理</td><td rowspan="8">剧本审核</td><td>任务大厅-列表数据</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>任务大厅-剧本详情</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>任务大厅-领取任务</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>任务大厅-审核记录</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>我的审核-列表数据</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>我的审核-剧本详情</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>我的审核-审核</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td>我的审核-审核记录</td><td>●</td><td>-</td><td>-</td><td>●</td><td>-</td></tr><tr><td rowspan="7">漫剧审核</td><td>待我审核-列表数据</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td>待我审核-任务详情</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td>待我审核-审核</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td>待我审核-审核记录</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td>我参与的-列表数据</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td>我参与的-任务详情</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td>我参与的-审核记录</td><td>●</td><td>-</td><td>-</td><td>●</td><td>●</td></tr><tr><td rowspan="9">系统设置</td><td rowspan="2">用户管理</td><td>列表数据</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>编辑</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td rowspan="4">角色管理</td><td>列表数据</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>新增</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>编辑</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>复制邀请链接</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td rowspan="3">注册审核</td><td>列表数据</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>通过</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr><tr><td>不通过</td><td>●</td><td>-</td><td>-</td><td>-</td><td>-</td></tr></tbody></table>

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>页面</td><td>示例</td><td>介绍</td></tr><tr><td>登录页</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTgxZTQ2ODA3ODIwNjdlOGVlMzI3NDU0NTU3OWNhNTJfNDEzMjYxNzg4NDNhZTRjY2JiOGE1ZWZiMjg0NzlhZjhfSUQ6NzYzMDczNDE5NDU3MDY5MzU2M18xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="Ulmdb0D0ho2CaAx6vnAcp4sWnpc"/></td><td><ul><li>邮箱：文本框，需校验邮箱格式</li><li>密码<ul><li>文本框，密文输入</li><li>小眼睛：点击切换 密文/明文显示</li></ul></li><li>【登录】button<ul><li>点击验证阿里云验证码</li><li>验证通过：提交登录验证</li><li>验证不通过：重试</li></ul></li><li>【忘记密码】button：点击跳转【忘记密码】页面</li><li>【立即注册】button：点击跳转【立即注册】页面</li></ul></td></tr><tr><td>注册账号</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDlmY2M0ZjZhYmYzYjRiM2QwMzMzZWM0ZWJiYjA3YjdfYjEzYzA0MjBhMmIyNGRlOWYxNTI2YjU0MmNjYmVmMjFfSUQ6NzYzMDczMzgwNDMxOTA4MzQ2MV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="WENtbhZkSovq2sxI6kfcwI5enVe"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NmFlN2U1YjZjNWE4YjZjNDJkMjFjODhhYWYyYTEwNmJfMzUwMjYzMWY2MDY1MmM4NzhkZmIyYzM4NmVhYzNlMmJfSUQ6NzYzMDczMzczNjcyODU2Mjg2Nl8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="B0TBbwuuJo6d28x1Z3ocETQ6nQd"/></td><td><ul><li>入口<ul><li>在【登录页】页面点击【立即注册】button跳转（图1）</li><li>通过“邀请链接”进入（图2）</li></ul></li><li>注册角色<ul><li>显示当前邀请链接邀请注册的角色</li><li>不可编辑</li><li>仅通过“邀请链接”进入显示</li></ul></li><li>邮箱：文本框，需校验邮箱格式</li><li>验证码：文本框</li><li>【发送验证码】button<ul><li>点击验证阿里云验证码</li><li>验证通过：发送验证码到输入的邮箱</li><li>验证不通过：重试</li><li>发送成功后，进入60s倒计时，且点击无反应</li><li>倒计时结束后，显示【重新发送】，点击将重新验证阿里云验证码</li></ul></li><li>密码<ul><li>文本框，密文输入</li><li>小眼睛：点击切换 密文/明文显示</li></ul></li><li>用户名：文本框，最多输入20个字</li><li>【注册】button：点击提交注册请求</li><li>【返回登录】button：点击跳转【登录页】</li></ul></td></tr><tr><td>忘记密码</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjNiZDk2NjE5NzBmOTcyNmMzMmM5MjQwMGMwOGQwY2ZfYTQ0MTYyMzQzODg1MDVlOWM1ODRmYzQ2MDE5ZTI5ZmVfSUQ6NzYzMDczOTEzODIxMTY2Mjc5M18xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="Mkj9bwBFvo1a6yxfolSc803cnug"/></td><td><ul><li>入口：在【登录页】页面点击【忘记密码】button跳转</li><li>邮箱：文本框，需校验邮箱格式</li><li>验证码：文本框</li><li>【发送验证码】button<ul><li>点击验证阿里云验证码</li><li>验证通过：发送验证码到输入的邮箱</li><li>验证不通过：重试</li><li>发送成功后，进入60s倒计时，且点击无反应</li><li>倒计时结束后，显示【重新发送】，点击将重新验证阿里云验证码</li></ul></li><li>【验证】button<ul><li>验证提交的邮箱和验证码是否正确</li><li>验证通过：跳转密码页面</li><li>验证不通过：错误提示</li></ul></li><li>【返回登录】button：点击跳转【登录页】</li></ul></td></tr><tr><td>重置密码</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjYyMjIxY2Q5MTI5ZjdhZDA5NDkzNzhlZjIwZmIwMjhfYjQ5NTUxZGUzZjYyODMxMWQyMzY4MTMyNmRjOTU1MmJfSUQ6NzYzMDczOTM3MDc5MDI5MjcwMF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="SvLsbGUrnoTaDnx6BIQcMQrCnBe"/></td><td><ul><li>入口：在【忘记密码】页面点击【验证】button跳转</li><li>邮箱<ul><li>文本框，显示需要重置密码的邮箱</li><li>不可编辑</li></ul></li><li>新密码<ul><li>文本框，密文输入</li><li>小眼睛：点击切换 密文/明文显示</li></ul></li><li>【重置密码】button<ul><li>点击提交邮箱和新密码</li><li>新密码覆盖原有密码，作为账号的登录密码使用</li><li>重置成功后，自动跳转【登录页】</li></ul></li><li>【返回登录】button：点击跳转【登录页】</li></ul></td></tr><tr><td>用户管理</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTIzZjVmMjJkNWNkMzExZWU3YmQ2MzZiNDEyNDhkOWNfNDI5MjE4N2UxZWRkMGJjNGE4ZDM4Y2E2ZGJiOWY5MmJfSUQ6NzYzMDg2MTY0MDgwODEyMzU4OV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="VFZJbu8FZowqBPxaMbIcgNb2n9e"/></td><td><h3>入口</h3><ul><li>新增【系统设置】一级菜单</li><li>在【系统设置】菜单下，新增【用户管理】二级菜单</li></ul><h3>筛选项</h3><ul><li>姓名：文本框</li><li>邮箱：文本框</li><li>角色<ul><li>单选</li><li>可选项：在<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-IMDbdEJtSoDcTTxf3YhccF3mn5f">角色管理</a>列表中选择</li></ul></li><li>状态<ul><li>单选</li><li>可选项：启用、禁用</li></ul></li></ul><h3>列表</h3><ul><li>根据注册时间倒序展示</li><li>姓名</li><li>邮箱</li><li>角色：用户绑定的角色</li><li>二审用户：当前用户配置的二审用户</li><li>注册时间</li></ul><h3>操作</h3><ul><li>【编辑】button：点击弹出【编辑】弹窗</li></ul></td></tr><tr><td>编辑</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjNlNTM3ODQ1ZWQ2MzVmNTYzOTgxNmQxOWUyZDRmMWVfYzY1MTVjMDQxNDU3ODkxNDk4NTk5ZWUzYzBjYWM3ZmFfSUQ6NzYzMDg2MTc4NzMwMjM2NjEzNl8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="QaJMbEw9ToKYWgxJp2Hcl05mnSd"/></td><td><ul><li>入口：【用户管理】页面，点击【编辑】button弹出</li><li>姓名：文本框，不可编辑</li><li>邮箱：文本框，不可编辑</li><li>角色<ul><li>多选，非必填</li><li>可选项：在<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-IMDbdEJtSoDcTTxf3YhccF3mn5f">角色管理</a>列表中选择</li></ul></li><li>二审用户<ul><li>单选</li><li>在用户列表中选择，仅显示 状态=启用 的用户</li></ul></li><li>状态<ul><li>单选，必填</li><li>可选项：启用、禁用</li></ul></li></ul></td></tr><tr><td>角色管理</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZTQ0ZTIxMDY4ZjdmYjljMjQwYThmNzBhZTdkM2Y5OGJfMWE5NDU4ZGExMjYyMzAzYmVlMWQwZDNhY2M2ZGRhN2RfSUQ6NzYzMDcyODQ5MTE5NDc2NDQ5N18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="HamgbWAKEoLmnsxztE9cJ4QLnEd"/></td><td><h3>入口</h3><ul><li>在【系统设置】菜单下，新增【角色管理】二级菜单</li></ul><h3>筛选项</h3><ul><li>姓名：文本框</li></ul><h3>列表</h3><ul><li>根据注册时间倒序展示</li><li>角色名称</li><li>备注</li><li>用户：角色关联的用户名称</li></ul><h3>操作</h3><ul><li>【新增】button：点击弹出【新增】弹窗</li><li>【编辑】button：点击弹出【编辑】弹窗</li><li>【复制邀请链接】button：点击将对应角色邀请链接复制到剪切板</li></ul></td></tr><tr><td>新增/编辑弹窗</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Yjg3NTM2ZGZhMTQ4YjI5NDJmYzAzOWI2YWI2NjJhYzRfNmVmY2RjM2FmMTdjYTE5MDE2MmZmNjNiM2RhYjE0YWVfSUQ6NzYzMDcxNjQzOTE4ODI0NTcxNl8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="RqYjbJVT6oGLOBxpSfpcfyJ8nlg"/></td><td><ul><li>入口：【角色管理】页面点击【新增】、【编辑】button弹出</li><li>角色名称：文本框，必填</li><li>备注：文本框，非必填</li><li>权限：“菜单 / 子菜单 / 按钮权限”三级结构组织</li></ul></td></tr><tr><td>注册审核</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Mjc4ODE4ODk2OTBlNDc5YmUxNDVkYThkNDU0YWJhODRfZmM1NjdlYzIzYjc0NTk0YTFhMzM2ZDg4ZTM5NjA5MzhfSUQ6NzYzMDc0Mjc1ODQ0NTE1NzU4NV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="QQK4bbmxyof97wxghEicuRsSnMj"/></td><td><h3>入口</h3><ul><li>在【系统设置】菜单下，新增【注册审核】二级菜单</li></ul><h3>筛选项</h3><ul><li>用户名：文本框</li><li>邮箱：文本框</li><li>角色<ul><li>单选</li><li>在【角色管理】列表中选择</li></ul></li><li>审核状态<ul><li>单选</li><li>可选项：审核通过、审核不通过、审核中</li></ul></li></ul><h3>列表</h3><ul><li>根据注册时间倒序展示</li><li>用户名</li><li>角色<ul><li>注册时的默认角色</li><li>若普通注册则为空</li></ul></li><li>邮箱：账号注册提交的邮箱</li><li>注册时间：提交审核的时间</li><li>审核状态</li></ul><h3>操作</h3><ul><li>【通过】button<ul><li>点击将审核记录状态修改为“审核通过”，账号写入用户库</li><li>仅“审核状态”为审核中显示</li></ul></li><li>【不通过】button<ul><li>点击将审核记录状态修改为“审核不通过”</li><li>仅“审核状态”为审核中显示</li></ul></li></ul></td></tr></tbody></table>

## 书籍管理

- **获取方式**：对接掌心故事会 API 接口，按固定周期拉取书籍数据。 
- **接口文档**：待提供
- **获取范围**： 

  -  书籍上架状态 = 已上架； 
  -  书籍来源 = 自签书； 
  -  或书籍来源 = 内部修文，且其源 BookID 对应书籍来源 = 自签书。 
- **获取字段**

  - 书籍名称
  - 内容类型
  - 分类
  - 标签
  - 内容
  - 原书付费卡点
- **请求频率**：每 10 分钟执行一次增量拉取。 
- **保存方式**：采用增量保存，仅新增数据。

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>页面</td><td>示例</td><td>介绍</td></tr><tr><td>书籍管理</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTI0MDA5NWZlOTg5ZGQwZTQxZTZmZDY0ZTczMDE0MWVfNmNmYzEzNWFkZWJkOGZmYmYzZjVlZmZmNmFjYzQwZmRfSUQ6NzYyNDAzMTkwMDU0OTg5MzI5OF8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="XkwybJ8xaoWyk3x0Xl5cy7MGnvf"/></td><td><h3>入口</h3><ul><li>新增【资产管理】一级菜单</li><li>在【资产管理】菜单下，新增【书籍管理】二级菜单</li></ul><h3>筛选项</h3><ul><li>书籍ID：文本框</li><li>书籍名称：文本框</li><li>内容类型<ul><li>单选</li><li>可选项：原作、多版本</li></ul></li><li>是否关联剧本<ul><li>单选</li><li>可选项：是（关联剧本数＞0）、否（关联剧本数=0）</li><li>默认为“否”</li></ul></li><li>上架时间：日期范围选择器</li></ul><h3>列表</h3><ul><li>排序方式：根据书籍ID倒序</li><li>书籍ID<ul><li>漫剧后台书籍ID，非掌心故事会书籍ID</li><li>生成规则：服务端确认</li></ul></li><li>书籍名称：超链接，点击弹出【书籍详情】弹窗</li><li>内容类型：通过API接口获取</li><li>分类：通过API接口获取</li><li>标签：通过API接口获取</li><li>字数：书籍内容的总字数</li><li>关联剧本数量：当前书籍创建剧本的数量，通过【剧本管理】查询</li><li>上架时间：书籍拉取落库的时间</li></ul><h3>操作</h3><ul><li>书籍名称：超链接，点击弹出【书籍详情】弹窗</li><li>【创建剧本】button：点击弹出【创作剧本】弹窗</li></ul></td></tr><tr><td>书籍详情</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTk2OWJhZmI4ZTMzZjVhMzc1Nzk1NDRmNjFiNTYwMzJfOGEyZDk0ZGRkYTFhOWY2YzUyYjlhNmJkMDViZmQ2OTJfSUQ6NzYyMzczNDgzOTI5MjU2MjM3NV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="XWjYb8F2yobSTLxSNTMcmlzInFg"/></td><td><ul><li>入口：在【书籍管理】页面，点击【书籍名称】超链接弹出</li><li>页面显示小说书籍内容，书籍字数，原书付费卡点</li><li>【查看卡点】button：点击书籍滑动至原书付费卡点位置</li><li>【创建剧本】button：点击弹出【创作剧本】弹窗</li></ul></td></tr></tbody></table>

## 剧本创作&审核

### 业务流程说明

1. 编剧可从**书籍**或**已有剧本**发起剧本创作。 
2. 剧本创作过程中，剧本默认处于**待提审**状态。 
3. 编剧完成剧本创作后提交审核，系统在**剧本审核 - 任务大厅**中生成一条审核任务，审核状态变更为**待认领**。 
4. 审核员领取审核任务后，审核状态变更为**审核中**。 
5. 审核员完成审核后，根据审核结果进行流转： 

   - **审核通过**：剧本状态更新为**审核通过**，并保存至**剧本库**； 
   - **驳回修改**：剧本状态更新为**驳回修改**，退回编剧修改；编剧修改完成后可再次提交审核； 
   - **审核不通过**：剧本状态更新为**审核不通过**，本次剧本流程结束，不可再次提审。

### 剧本审核状态 和 审核记录 说明

| **操作** | **审核状态** | **审核记录** |
|-|-|-|
| 发起剧本创作，但尚未提交审核 | 待提审 | - |
| 已提交审核并生成审核任务，但尚无审核员领取 | 待认领 | 提交审核 |
| 审核任务已被领取，正在审核处理中 | 审核中 | 领取任务 |
| 剧本审核通过，保存至剧本库 | 审核通过 | 审核通过 |
| 退回编剧修改，修改完成后可重新提交审核 | 驳回修改 | 驳回修改 |
| 流程终止，且不可再次提交 | 审核不通过 | 审核不通过 |

### 剧本类型说明

- 原作：从书籍发起的剧本创作
- 多版本：从已有剧本发起的二次创作

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>页面</td><td>示例</td><td>介绍</td></tr><tr><td>创作剧本</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTYyZjRkNjczMDk5NDU1ZGY1ZTEyOGE2YTRhZTVjODBfYThhMDAxMjM0MjNhMDRmZjAyZTgwZTU5ZjE2YTUxNGNfSUQ6NzYyNjkzMzc1OTcwNzI3MDEwMV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="PQsFbUgv4o0QRaxpZgAcXv7fnmc"/></td><td><ul><li>入口<ul><li>【书籍管理】页面，点击【创作剧本】button弹出</li><li>【书籍管理】-【书籍详情】页面，点击【创作剧本】button弹出</li><li>【剧本管理】页面，点击【剧本二创】button弹出</li><li>【剧本创作】页面，点击【编辑】button弹出</li></ul></li><li>剧本名称<ul><li>文本框，必填</li><li>默认同步书籍名称 或 剧本名称</li></ul></li><li><a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-TEDLdhFFcooRDHxfJtecrSh8nFb">剧本编辑器</a></li><li>全文字数：根据字数统计规则，统计剧本字数</li><li>集数：编辑器内划分集的数量，根据分集实时更新</li><li>【保存】button<ul><li>点击保存剧本内容信息至【剧本创作】页面，生成剧本创作记录</li><li>若剧本已存在，则更新剧本内容信息</li><li>下次打开回显</li></ul></li><li>【提交】button：点击生成剧本创作记录，将剧本提交审核，发布审核任务至剧本审核 - 任务大厅</li></ul></td></tr><tr><td>剧本创作</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTIyOWNkZWYxNzg2NTkwZWJiZDZmZDUyMGQwYzUyMzFfZTg0MmQ5MzAzYWYzZDY4NmI4ODFkZjU1ZmRkMTNlODRfSUQ6NzYyMzc2MDUxMDAyNjU2NjYxM18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="JexybDwXnogMLjxkH7tcZ604ns9"/></td><td><h3>入口</h3><ul><li>新增【剧本创作】一级菜单</li></ul><h3>筛选项</h3><ul><li>剧本名称：文本框</li><li>原书ID：文本框</li><li>类型<ul><li>单选</li><li>可选项：原作、多版本</li></ul></li><li>原剧本ID：文本框</li><li>审核状态<ul><li>单选</li><li>可选项：待提审、待认领、审核中、审核通过、驳回修改、审核不通过</li></ul></li><li>审核员：文本框</li></ul><h3>列表字段</h3><ul><li>排序方式：根据创建时间倒序</li><li>数据范围：仅展示当前用户创建的剧本数据</li><li>剧本名称</li><li>集数：剧本内划分的集数</li><li>原书ID<ul><li>发起剧本创作的书籍ID</li><li>若剧本类型为多版本，则为发起二次创作剧本的剧本原书ID</li></ul></li><li>类型</li><li>原剧本ID<ul><li>仅在剧本来为多版本时有值</li><li>发起二次创作剧本的剧本ID</li></ul></li><li>审核状态</li><li>审核员<ul><li>领取剧本审核任务的审核员</li><li>审核状态为待审核和待认领时为空</li></ul></li></ul><h3>操作</h3><ul><li>剧本名称：超链接，点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-Nuu2d6V4loxKU7xqGoCc2NKdnTc">剧本详情</a>】弹窗</li><li>【编辑】button<ul><li>点击弹出【创作剧本】弹窗</li><li>仅在审核状态为“待提审”和“驳回修改”时显示</li></ul></li><li>【删除】button<ul><li>点击删除当前数据，需进行二次确认</li><li>仅在审核状态为“待提审”时显示</li></ul></li><li>【审核记录】button<ul><li>点击弹出【审核记录】弹窗</li><li>在审核状态为“待提审”时不显示，其他状态均显示</li></ul></li></ul></td></tr><tr><td>剧本审核-任务大厅</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzQwODUwNTVlZGQ4MDYyMDBjNjM2NGI0NjE1YzVjODhfMzcyYjQ3ZTg0YWRlOTQ4OWYxZmJhYzQ5NmJmOGU4NzNfSUQ6NzYyMzk3OTU5MjQ0MDkwODc1M18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="Or73bOgcqoOtkWxfC97cfMQRnzb"/></td><td><h3>入口</h3><ul><li>新增【审核管理】一级菜单</li><li>在【审核管理】菜单下，新增【剧本审核】二级菜单</li><li>在【剧本审核】页面，新增【任务大厅】tab</li></ul><h3>筛选项</h3><ul><li>剧本名称：文本框</li><li>原书ID：文本框</li><li>类型<ul><li>单选</li><li>可选项：原作、多版本</li></ul></li><li>原剧本ID：文本框</li><li>审核状态<ul><li>单选</li><li>可选项：待认领、审核中、审核通过、驳回修改、审核不通过</li><li>默认为“待认领”</li></ul></li><li>编剧：文本框</li><li>审核员：文本框</li></ul><h3>列表</h3><ul><li>根据创建时间倒序展示</li><li>剧本名称</li><li>集数：剧本内划分的集数</li><li>原书ID<ul><li>发起剧本创作的书籍ID</li><li>若剧本类型为多版本，则为发起二次创作剧本的剧本原书ID</li></ul></li><li>类型</li><li>原剧本ID<ul><li>仅在剧本来为多版本时有值</li><li>发起二次创作剧本的剧本ID</li></ul></li><li>审核状态</li><li>编剧：剧本提交审核的用户</li><li>审核员<ul><li>领取剧本审核任务的审核员</li><li>审核状态为“待认领”时为空</li></ul></li></ul><h3>操作</h3><ul><li>剧本名称：超链接，点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-Nuu2d6V4loxKU7xqGoCc2NKdnTc">剧本详情</a>】弹窗</li><li>【领取任务】button<ul><li>点击领取任务，更新数据的“审核状态”和“审核员”信息</li><li>同时自动弹出【剧本审核】弹窗</li><li>仅在审核状态为“待认领”时显示</li></ul></li><li>【审核记录】button：点击弹出【审核记录】弹窗</li></ul></td></tr><tr><td>剧本审核-我的审核</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=M2VmYjUyMGU3OWY0MGRjZmQ5Y2E4NWMxODA2OGFhNDBfODg4NDhjYTRjYzU3YWY2N2JlMDUxNmIzMDk3ZDkxN2ZfSUQ6NzYyMzk4NDEzNTY0Mzg5MjkzOV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="A5r9bKR93oEpaDxWC6ic59punjc"/></td><td><h3>入口</h3><ul><li>在【剧本审核】页面，新增【我的审核】tab</li></ul><h3>筛选项</h3><ul><li>剧本名称：文本框</li><li>原书ID：文本框</li><li>类型<ul><li>单选</li><li>可选项：原作、多版本</li></ul></li><li>原剧本ID：文本框</li><li>审核状态<ul><li>单选</li><li>可选项：待认领、审核中、审核通过、驳回修改、审核不通过</li><li>默认为“待认领”</li></ul></li><li>编剧：文本框</li></ul><h3>列表</h3><ul><li>根据创建时间倒序展示</li><li>数据范围：仅展示“审核员=当前用户”的审核任务</li><li>剧本名称</li><li>集数：剧本内划分的集数</li><li>原书ID<ul><li>发起剧本创作的书籍ID</li><li>若剧本类型为多版本，则为发起二次创作剧本的剧本原书ID</li></ul></li><li>类型</li><li>原剧本ID<ul><li>仅在剧本来为多版本时有值</li><li>发起二次创作剧本的剧本ID</li></ul></li><li>审核状态</li><li>编剧：剧本提交审核的用户</li></ul><h3>操作</h3><ul><li>剧本名称：超链接，点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-Nuu2d6V4loxKU7xqGoCc2NKdnTc">剧本详情</a>】弹窗</li><li>【审核】button<ul><li>点击弹出【剧本审核】弹窗</li><li>仅在审核状态为“审核中”时显示</li></ul></li><li>【审核记录】button：点击弹出【审核记录】弹窗</li></ul></td></tr><tr><td>审核记录</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZjgyNWMxODJhNTI1MjFjMzI0YjE5OGU2ZWUwYjk1ZmZfODlmYmM1ZmNkNjk1OTQ4YTIzNzVhMTk2NzljZjM0NjRfSUQ6NzYyMzk3MjI3Nzc5MzAwMDM4Nl8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="S4JGbnhunomc5gxqn6qc17OCn3M"/></td><td><ul><li>入口<ul><li>【剧本创作】页面，点击【审核记录】button弹出</li><li>【剧本审核】-【任务大厅】tab，点击【审核记录】button弹出</li><li>【剧本审核】-【我的审核】tab，点击【审核记录】button弹出</li></ul></li><li>展示剧本创作从提交审核 到审核通过/不通过 期间各流程节点详情<ul><li>操作动作</li><li>操作人</li><li>审核意见：提交审核 和 领取任务 为空</li><li>提交时间</li></ul></li><li>展示顺序：根据时间节点正序展示</li></ul></td></tr><tr><td>剧本详情</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDIyNDBmYjdjYjdjN2U5ZGVmMzhiMDc4ODJiMmViY2VfYTQzNWNjZjZjMDFlNDc2N2VlZmYwMmExNjI3OWY5MDRfSUQ6NzYyNDA1MjY1Nzg0MzkxNTk5NV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="T9GJbmuaMoX43mxhtaBcS9ZEnuf"/></td><td><ul><li>入口<ul><li>【剧本创作】页面，点击【剧本名称】超链接弹出</li><li>【剧本审核】-【任务大厅】tab，点击【剧本名称】超链接弹出</li><li>【剧本审核】-【我的审核】tab，点击【剧本名称】超链接弹出</li><li>【剧本管理】页面，点击【剧本名称】超链接弹出</li></ul></li><li>展示 剧本名称、剧本内容、原书卡点、剧本分集、全文字数，付费卡点 均不可修改</li><li>【查看卡点】button<ul><li>点击将内容滚动至付费卡点位置</li><li>仅在【剧本管理】页面打开显示</li></ul></li></ul></td></tr><tr><td>剧本审核</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGE4NTZkNzkzODAxZmQ4YjA2ODU3MzA2OTc4MjEyYzJfNzI0OWZiMTMwN2I1Zjg3YTU5ZDBhNzk3OTM4NzhlMDNfSUQ6NzYyNjkzNDAwOTM1NjQyMjMyNV8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="Mq8Nbo6Lno2mdUxtKG9cNsaznCh"/></td><td><h3>入口</h3><ul><li>【剧本审核】-【任务大厅】tab，点击【领取任务】button弹出</li><li>【剧本审核】-【我的审核】tab，点击【审核】button弹出</li></ul><h3>左半区</h3><ul><li>剧本名称：文本框，必填</li><li><a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-KFPsdyuCRo7KFcxlFs0cLtfOnKf">剧本编辑器</a></li><li>全文字数：统计剧本内容字数</li><li>集数：编辑器内划分集的数量，根据分集实时更新</li></ul><h3>右半区</h3><ul><li>基础信息<ul><li>当前状态：当前剧本审核状态</li><li>集数：剧本编辑器内设置的分集线数量</li><li>原书ID</li><li>类型</li><li>原剧本ID</li><li>付费卡点<ul><li>剧本编辑器内设置的付费卡点</li><li>未设置则为空</li></ul></li></ul></li><li>审核意见：文本框，最多支持输入2000字</li><li>审核操作<ul><li>【审核不通过】button<ul><li>点击将审核状态修改为“审核不通过”</li><li>校验“审核意见”必填</li></ul></li><li>【驳回修改】button<ul><li>点击将审核状态修改为“驳回修改”</li><li>返回编剧修改</li><li>校验“审核意见”必填</li></ul></li><li>【审核通过】button<ul><li>点击将审核状态修改为“审核通过”</li><li>剧本落库至【剧本管理】页面</li><li>校验“付费卡点”必填</li><li>校验【剧本名称】在【剧本管理】页面内唯一</li></ul></li></ul></li><li>【保存】button<ul><li>点击保存剧本内容信息和审核意见内容</li><li>下次打开回显</li></ul></li></ul></td></tr><tr><td>剧本编辑器</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Y2U1ZjNkM2YxNTkzYjQ2ZjdiNmNiZjM4NWEwMjA4M2JfZjFhNjEwMTNjOWMwYmEzNzQwNzBlNzVkYzg3YTVhZGVfSUQ6NzYyNDAzNzI4ODg2NzcyODU4OF8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="FE7qbpTxVo788Pxmjo1cmutwndc"/></td><td><ul><li>富文本编辑器，最多支持100万字</li><li>支持修改剧本内容，在内容选中后弹出工具栏，对选中内容进行操作</li><li>工具类<ul><li>字号：修改字号大小</li><li>加粗：字体加粗</li><li>下划线：与删除线互斥</li><li>删除线：与下划线互斥</li><li>字体颜色</li><li>字体背景颜色</li></ul></li><li>原书卡点<ul><li>显示来源小说的付费卡点，不可编辑</li><li>当剧本类型为“多版本”时不存在</li><li>跟随内容修改移动</li></ul></li><li>分集线<ul><li>用来表示剧本分集界限</li><li>可在任意行间插入/删除，每个行间最多插入1条</li><li>第N集：表示第N集的结束，编辑器从上往下排列，第几条线就是第几集</li><li>总计X字：表示当前集有包含X字，统计当前分集线到上条分集线或开头之前包含的字数</li><li>在剧本末端固定存在分集线，表示最后一集的结束</li></ul></li><li>【付费卡点】button<ul><li>在分集线上显示设置剧本的付费卡点</li><li>每个剧本最多存在1个付费卡点，当设置新的付费卡点后，原有付费卡点自动取消</li><li>仅【剧本审核】弹窗支持该功能</li></ul></li></ul></td></tr><tr><td>剧本管理</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGVjODY0MTVjMTU0ODU2NGJjNDRkOGYwZWRiZmE5YjFfYWM5ZGU3MzVlNGI5N2M4YjE0NzRhMGFhNDgxMGU2NGRfSUQ6NzYyNDA0MzQxNTYzNDQ2MzcxMl8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="BKybbYacQoaOkAxKkxtcamhInpb"/></td><td><h3>入口</h3><ul><li>在【资源管理】菜单下，新增【剧本管理】二级菜单</li></ul><h3>筛选项</h3><ul><li>剧本ID：文本框</li><li>剧本名称：文本框</li><li>原书ID：文本框</li><li>类型<ul><li>单选</li><li>可选项：原作、多版本</li></ul></li><li>原剧本ID：文本框</li><li>编剧：文本框</li><li>审核员：文本框</li><li>创建时间：日期范围选择器</li></ul><h3>列表</h3><ul><li>排序方式：根据创建时间倒序展示</li><li>剧本ID：<ul><li>剧本在剧本库中唯一标识</li><li>生成规则：服务端确认</li></ul></li><li>剧本名称</li><li>集数</li><li>付费卡点</li><li>书籍ID</li><li>类型</li><li>原剧本ID</li><li>编剧：创作/二创该剧本的用户</li><li>审核员：领取该剧本审核任务的用户</li><li>创建时间：剧本审核通过落库至剧本库的时间</li></ul><h3>操作</h3><ul><li>剧本名称：超链接，点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-UDzCdyysiolGhJxipGGcFfR5nTf">剧本详情</a>】弹窗</li><li>【发布制作任务】button：点击弹出【发布制作任务】弹窗</li><li>【剧本二创】button：点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-XDMjdKKANo5OipxRZOkcYoMnnab">创作剧本</a>】弹窗</li></ul></td></tr></tbody></table>

## 漫剧制作&审核

### 漫剧制作&审核任务类型

- **制作任务**

  - 基于剧本发起，用于完成从全集制作到分集制作的完整生产流程
  - 同一剧本支持多次发起制作任务，且支持同时发起，各次任务相互独立
  - 每次任务完成后，均生成一部新的漫剧。 
- **修改任务**

  - 基于已入库漫剧发起，用于完成既有漫剧的修订与更新。
  - 同一部漫剧支持多次发起修改任务，各次任务相互独立
  - 同一部漫剧同一时间内仅支持一个修改任务在进行中
  - 每次任务完成后，均更新原漫剧内容，不生成新的漫剧。

### 审核任务类型

- **审核任务**：在全集、分集或返修版产物提交审核时，由系统自动生成的审核处理任务。 

  - **全集审核**：在**全集制作**提审后生成，用于审核全集产物，审核通过后进入分集制作。 
  - **分集审核**：在**分集制作**提审后生成，用于审核分集产物，审核通过后成片入库。
  - **二审审核**
  
    - 在**分集制作**提审通过后，由“二审用户”进一步审核
    - 仅**分集审核**的审核员配置了“二审用户”后生成
  - **返修版审核**：在**返修版制作**提审后生成，用于审核返修版产物，审核通过后更新漫剧库内容。

### 业务流程说明

#### 制作任务

1. 基于已通过审核的剧本发起漫剧制作任务。  
系统在 **漫剧制作 - 任务大厅** 中生成一条制作任务，任务进度初始化为 **待认领**。 
2. 制作员领取制作任务后，任务进度更新为 **全集制作中**。 
3. 制作员完成全集制作后，上传全集产物并提交审核。提交后： 

   - 制作任务进度更新为 **全集审核中**； 
   - 系统同步创建一条 **全集审核任务**，审核任务状态初始化为 **审核中**。 
4. 审核员完成全集审核后，根据审核结果进行流转： 

   - **审核通过**： 
   
     - 制作任务进度更新为 **分集制作中**； 
     - 全集审核任务状态更新为 **审核通过**。 
   - **驳回修改**： 
   
     - 制作任务进度更新为 **全集制作中**，退回制作员修改； 
     - 制作员修改完成后可再次提交审核； 
     - 全集审核任务状态更新为 **驳回修改**。 
5. 制作员完成分集制作后，上传分集产物并提交审核。提交后： 

   - 制作任务进度更新为 **分集审核中**； 
   - 系统同步创建一条 **分集审核任务**，审核任务状态初始化为 **审核中**。 
6. 审核员完成分集审核后，根据审核结果进行流转： 

   - **审核通过**：
   
     - 根据审核员是否配置“**二审用户**”判断 
     
       - 否
       
         - 制作任务进度更新为 **已完成**； 
         - 分集成片保存至 **漫剧库**； 
         - 分集审核任务状态更新为 **审核通过**。 
       - 是：进入**“二审审核”**
   - **驳回修改**： 
   
     - 制作任务进度更新为 **分集制作中**，退回制作员修改； 
     - 制作员修改完成后可再次提交审核； 
     - 分集审核任务状态更新为 **驳回修改**。
7. **二审审核**

   - **审核通过**
   
     - 制作任务进度更新为 **已完成**； 
     - 分集成片保存至 **漫剧库**； 
     - 二审审核任务状态更新为 **审核通过**。 
   - **驳回修改**
   
     - 制作任务进度更新为 **分集制作中**，退回制作员修改； 
     - 二审审核任务状态更新为 **驳回修改**。

#### 修改任务

1. 在 **漫剧库** 中发起漫剧修改任务。  
 系统在 **漫剧制作 - 任务大厅** 中生成一条修改任务，并指定制作员，任务进度初始化为 **返修版制作中**。 
2. 制作员完成返修版制作后，上传返修版产物并提交审核。提交后： 

   - 修改任务进度更新为 **返修版审核中**； 
   - 系统同步创建一条 **返修版审核任务**，审核任务状态初始化为 **审核中**。 
3. 审核员完成返修版审核后，根据审核结果进行流转： 

   - **审核通过**： 
   
     - 修改任务进度更新为 **已完成**； 
     - 修改内容同步更新至 **漫剧库**； 
     - 返修版审核任务状态更新为 **审核通过**。 
   - **驳回修改**： 
   
     - 修改任务进度更新为 **返修版制作中**，退回制作员修改； 
     - 制作员修改完成后可再次提交审核； 
     - 返修版审核任务状态更新为 **驳回修改**。

### 任务进度、审核状态、审核记录 说明

#### 制作任务

| **操作** | **制作任务进度** | **审核任务状态** | **审核记录** |
|-|-|-|-|
| 从剧本发起漫剧制作任务，但尚未有制作员领取 | 待认领 | - | 发布漫剧制作任务 |
| 制作员已领取制作任务，开始进行全集制作 | 全集制作中 | - | 领取任务 |
| 制作员完成全集制作，上传全集产物并提交审核 | 全集审核中 | 审核中 | 提交审核（全集） |
| 全集审核通过，进入分集制作阶段 | 分集制作中 | 审核通过 | 审核通过（全集） |
| 全集审核驳回，退回制作员修改 | 全集制作中 | 驳回修改 | 驳回修改（全集） |
| 制作员完成分集制作，上传分集产物并提交审核 | 分集审核中 | 审核中 | 提交审核（分集） |
| 分集审核通过，且未配置“二审用户”，任务完成，成片保存至漫剧库 | 已完成 | 审核通过 | 审核通过（分集） |
| 分集审核通过，且配置“二审用户”，进入“二审” | 二审审核中 | 审核中 | 审核通过（分集） |
| 分集审核驳回，退回制作员修改 | 分集制作中 | 驳回修改 | 驳回修改（分集） |
| 二审审核通过，任务完成，成片保存至漫剧库 | 已完成 | 审核通过 | 审核通过（二审） |
| 二审审核驳回，退回制作员修改 | 分集制作中 | 驳回修改 | 驳回修改（二审） |
| 对制作任务进行取消 | 已取消 | 已取消 | 任务取消（全集）  <br/>任务取消（分集） |

- **制作任务：**包含**全集制作**和**分集制作**两个连续阶段，从制作员**领取任务**起开始流转，直至分集/二审审核通过后任务完成。 
- **审核任务：**按审核阶段拆分为**全集审核、分集审核、二审审核 三**类任务，三者分别独立生成、独立处理，并对应各自的审核结果与流转节点。

#### 修改任务

| **操作** | **制作任务进度** | **审核状态** | **审核记录** |
|-|-|-|-|
| 在漫剧库发起修改任务，并指定制作员 | 返修版制作中 | - | 发起成片修改 |
| 制作员完成返修版制作，上传返修版产物并提交审核 | 返修版审核中 | 审核中 | 提交审核（返修版） |
| 返修版审核通过，任务完成，同时更新漫剧库内容 | 已完成 | 审核通过 | 审核通过（返修版） |
| 返修版审核驳回，退回制作员继续修改 | 返修版制作中 | 驳回修改 | 驳回修改（返修版） |
| 对修改任务进行取消 | 已取消 | 已取消 | 任务取消（返修版） |

### 意见数据透传规则

- 系统中存在两类意见

  - **审核意见**：由审核员在审核弹窗中填写，针对制作人提交的交付物进行审核反馈。支持多条记录，每条包含文字 + 图片。
  - **修改意见**：由发起人在"发起成片修改"时填写，描述需要修改的内容。支持多条记录，每条包含文字 + 图片。
- 漫剧制作/修改任务提交审核，审核员填写的“审核意见”，将跟随任务透传至每一个任务环节，方便下次审核时参考。
- 当"发起成片修改"任务，填写“修改意见”，需同步至“修改”任务的“审核意见”，跟随任务透传，用于“返修版审核”时参考

### 人员选择

#### 制作员

- 制作任务发布成功后，由制作员主动领取任务
- 修改任务发布成功后，默认由漫剧的制作员承担修改职责。
- 系统需预留修改任务制作人字段及相关配置能力，以支持后续修改任务制作人与制作任务制作人不一致的业务场景。

#### 审核员

- 当前版本暂不支持单独指定审核员，默认由任务发起人承担审核职责。

  - **制作任务的审核员 = 制作任务的发起人**
  - **二审任务的审核员=制作任务审核员配置的二审用户**
  - **修改任务的审核员 = 修改任务的发起人**
- 系统需预留审核员字段及相关配置能力，以支持后续审核员与发起人不一致的业务场景。

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>页面</td><td>示例</td><td>介绍</td></tr><tr><td>发布制作任务</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZjgwNzlkMjgwODY1ZjU0NmUyNmUwMmQ3ZmQ2ZDJmYThfODdiMTdlYjk0YmMzNGJjYmIzZTM1YjQwYzZmMTIzNzlfSUQ6NzYyNDA3ODIxNjg2OTU3OTc0Ml8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="LJ5mbCnmvoYS0KxGoXMcfarBnKg"/></td><td><h3>入口</h3><ul><li>【剧本管理】页面，点击【发布制作任务】button弹出</li><li>【剧本审核】页面，剧本审核通过，剧本落库至剧本库后自动弹出</li></ul><h3>剧本信息</h3><ul><li>剧本名称</li><li>剧本ID</li><li>集数</li><li>付费卡点</li></ul><h3>制作配置</h3><ul><li>画风类型<ul><li>单选，必填</li><li>可选项：解说漫、动画漫、沙雕漫、仿真人剧</li></ul></li><li>视觉效果<ul><li>单选，必填</li><li>可选项：2D、3D、仿真人</li></ul></li><li>画面比例<ul><li>单选，必填</li><li>可选项：横屏16:9、竖屏9:16</li></ul></li><li>制作备注<ul><li>文本框，非必填</li><li>最多输入2000字</li></ul></li></ul><h3>操作</h3><ul><li>【确认发布】button：点击发布漫剧制作任务至【漫剧制作】-【任务大厅】页面</li></ul></td></tr><tr><td>任务大厅</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MmMxOTYzNjJkMzdhZWQyYmI1NGJlMzZkMjJhMWI3ZDRfMzcyYzdhNGI1Y2ZmM2JjM2UyOGRmZmE2NTliNWIyNjhfSUQ6NzYyNDEwNzM4MjYzNzQxNTM4OV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="M0J3b6PPRotSP1xX2PNc6k17nSc"/></td><td><h3>入口</h3><ul><li>新增【漫剧制作】一级菜单</li><li>在【漫剧制作】菜单下，新增【任务大厅】二级菜单</li></ul><h3>筛选项</h3><ul><li>任务名称：文本框</li><li>剧本ID：文本框</li><li>画风类型<ul><li>单选</li><li>可选项：解说漫、动画漫、沙雕漫、仿真人剧</li></ul></li><li>视觉效果<ul><li>单选</li><li>可选项：2D、3D、仿真人</li></ul></li><li>画面比例<ul><li>单选</li><li>可选项：横屏16:9、竖屏9:16</li></ul></li><li>发布时间：日期范围选择器</li><li>任务类型<ul><li>单选</li><li>可选项：制作、修改</li><li>默认为“制作”</li></ul></li><li>任务进度<ul><li>单选</li><li>与【任务类型】联动，根据【任务类型】展示可选项</li><li>任务类型 = 制作：待认领、全集制作中、全集审核中、分集制作中、分集审核中、二审审核中、已完成、已取消</li><li>任务类型 = 修改：返修版制作中、返修版审核中、已完成、已取消</li><li>默认为“待认领”</li></ul></li><li>发起人：文本框</li><li>制作人：文本框</li></ul><h3>列表</h3><ul><li>根据发布时间倒序展示</li><li>任务名称</li><li>剧本ID<ul><li>发起漫剧制作的剧本ID</li><li>若任务类型为修改，则为发起修改任务漫剧的剧本ID</li></ul></li><li>集数：剧本的集数</li><li>画风类型</li><li>视觉效果</li><li>画面比例</li><li>制作备注：任务类型为“修改”时为空</li><li>发布时间</li><li>任务类型</li><li>任务进度</li><li>发起人：发起制作/修改任务的用户</li><li>制作人：领取制作/修改任务的用户</li></ul><h3>操作</h3><ul><li>任务名称：超链接，点击弹出【剧本详情】弹窗</li><li>【领取任务】button<ul><li>点击任务进度变更为“全集制作中”</li><li>仅任务进度为“待认领”时显示</li></ul></li><li>【取消任务】button<ul><li>点击任务进度变更为“已取消”，【漫剧审核】页面审核状态变更为“已取消”</li><li>在任务进度为“已完成”和“已取消”不显示</li></ul></li><li>【审核记录】button：点击弹出【审核记录】弹窗</li></ul></td></tr><tr><td>我的任务</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODk1NWRlNGJkOWExNzIwMDU1YmQzYTllMjc4OTMzMjhfNGNkMDYyZjI4MDQ2NjJkNDZhMTAyZjgyMGMxOGVjNTlfSUQ6NzYyNDM0NjgyMjA3MzEyNTgyNV8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="GmTcb0agvo60nOxNBZMc8zWYnjB"/></td><td><h3>入口</h3><ul><li>在【漫剧制作】菜单下，新增【我的任务】二级菜单</li></ul><h3>筛选项</h3><ul><li>任务名称：文本框</li><li>任务类型<ul><li>单选</li><li>可选项：制作、修改</li></ul></li><li>任务进度<ul><li>单选</li><li>与【任务类型】联动，根据【任务类型】展示可选项</li><li>任务类型 = 制作：全集制作中、全集审核中、分集制作中、分集审核中、二审审核中，已完成、已取消</li><li>任务类型 = 修改：返修版制作中、返修版审核中、已完成、已取消</li></ul></li><li>审核员：文本框</li></ul><h3>列表</h3><ul><li>根据发布时间倒序展示</li><li>任务名称</li><li>集数：剧本的集数</li><li>任务类型</li><li>任务进度</li><li>审核员：当前项目的审核员</li></ul><h3>操作</h3><ul><li>任务名称：超链接，点击弹出【剧本详情】弹窗</li><li>【上传全集】button<ul><li>点击弹出【上传全集】弹窗</li><li>仅任务进度为“全集制作中”显示</li></ul></li><li>【上传分集】button<ul><li>点击弹出【上传分集】弹窗</li><li>仅任务进度为“分集制作中”显示</li></ul></li><li>【上传返修版】button<ul><li>点击弹出【上传返修版】弹窗</li><li>仅在务进度为“返修版制作中”显示</li></ul></li><li>【审核记录】button：点击弹出【审核记录】弹窗</li></ul></td></tr><tr><td>任务详情</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTI5ZDA1N2M3OGMwNzY5MjhjYjFiNWNjZWVlODA0ZTJfZWU2MjhiNTE4ZWVlNDVlYjViZDNjMGU0NjUyMTdlOGZfSUQ6NzYyNDM1NzAxOTAyMTAwMzcwN18xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="Q1pdbjASnodAu3xlQhRcLvwnnzf"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZWY3ZjA3ZjdlZTI3MTZmM2YxMGMwMzY1YjlkODgxN2RfNDYwMWRlZjk2OGJmYWRkNmNiNDY5Yjc4NTFlYTc5MWFfSUQ6NzYyNDM1NzEzMjY1ODQ3ODI3M18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="IHPgbqQ2Ao3GIWxK2JjcrkpfnHP"/></td><td><h3>入口</h3><ul><li>【任务大厅】页面，点击【任务名称】超链接弹出</li><li>【我的任务】页面，点击【任务名称】超链接弹出</li></ul><h3>左半区</h3><ul><li>展示剧本内容，剧本分集，全文字数</li></ul><h3>右半区</h3><ul><li>任务名称</li><li>剧本ID</li><li>集数</li><li>画风类型</li><li>视觉效果</li><li>画面比例</li><li>制作备注：任务类型为“制作”时显示</li><li>修改意见<ul><li>任务类型为“修改”时显示</li><li>显示多条修改意见记录，点击图片放大查看</li></ul></li></ul></td></tr><tr><td>审核记录</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzNmYjFmNmE2OTI2ZDQ1MGYxOGZkOGY2MjU4N2FjMzhfODk0YWM3ZWQ3MzAyNzc2ZTgzNDQ2ZTdjNGQyMjdjOWRfSUQ6NzYyNDM1OTQwOTE0NTUxNDk2NF8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="Pzb4bz6pso9UihxaWdHcXGRQnPc"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDM3MmE2MmVlMTkzZjM1YjRjMWUyNGIxMzgxYWI1NmRfMmZjM2RlNWVkY2NiNTU0Y2UwODY3YTg2OThiMzRmNjhfSUQ6NzYyNDM1OTEyNDc4ODQ0ODQ4MF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="SFncbogRKoa1kgxp7nEcy43znYc"/></td><td><ul><li>入口<ul><li>【任务大厅】页面，点击【审核记录】button弹出</li><li>【我的任务】页面，点击【审核记录】button弹出</li><li>【漫剧审核】-【待我审核】tab，点击【审核记录】button弹出</li><li>【漫剧审核】-【我参与的审核】tab，点击【审核记录】button弹出</li></ul></li><li>显示制作任务 和 修改任务 每个流程节点的操作</li><li><cite doc-id="IM62wp1n2i703fkrU1Pc7PCSnYf" file-type="wiki" title="漫剧运营后台v1.0" token="HqlDdGTZVokgtMxM2e9cJGIwnF4" type="doc"></cite><ul><li>每个节点展示以下信息</li><li>节点操作动作</li><li>操作人</li><li>阶段（全集、分集、返修版）</li><li>修改意见：显示多条修改意见记录，点击图片放大查看</li><li>时间</li></ul></li></ul></td></tr><tr><td>上传全集</td><td><grid><column width-ratio="0.500000"><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzM3NDc4ZmE1YTg5YmRkNTc3OTViZjg5NWU5ZWJiZjVfOWIwZDUwOGVlNmE0YmMyNThjYzc5MWUxNDVjYjYyOTNfSUQ6NzYyNDM2MTk0NzY3MjE4NjA2MV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="0.380605" src="CxAbb3DbRo5qB9xm23Yc94q7n7x"/></column><column width-ratio="0.500000"><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Y2Y1YzRlZmMzOGE2ODYzMGRjOTMzZjA5NzdmY2I4MTdfYjI0MmVkNDc1MDEyYWE3MWVhNWY0ZjhkMjRjMmMzOGNfSUQ6NzYyNDM2NTEwODI1MzA4NDYyOV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="0.380605" src="HbFYbtajXoUaIYx8D1mckqPNnnm"/></column></grid><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTRmN2EwZDA5NThmM2FkZTM5NGZlMDk4ZDkyOGI2OGJfYmUxMjFlZjMzMjZiMGQ0OWNlM2VkYTFkMzE0MzM1YzlfSUQ6NzYyNDM2NTE0NTkwMDczMTU5Ml8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="0.165276" src="Hx4Sbsr0hozG9uxMGNKcIYZSnUc"/></td><td><ul><li>入口：【我的任务】页面，点击【上传全集】button弹出</li><li>基础信息<ul><li>任务名称</li><li>集数</li><li>任务类型</li><li>任务进度</li></ul></li><li>上传附件<ul><li>上传视频文件</li><li>文件数量：最多1个</li><li>支持文件大小：最大支持5GB</li></ul></li><li>当前页面具备自动保存功能，上传/删除文件完成后，下次打开均回显当前文件状态</li></ul></td></tr><tr><td>上传分集&amp;上传返修版</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzJmZjc3NTRkZjgzOWY5ZjRiNzkyZjgwNTdhYmIxMzRfM2ZhZTI1NmQwNTZjMmVmMWFlNTIxMjJjMGYzNmNlYTdfSUQ6NzYyNDM2NjA4MDAyNjY0MzQwM18xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="BL9QbHbvFohTSRxVIV7coKd9nTg"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTEwNDlkNGUzNTI1N2Q2MDdlOTc1MDE3ZDBmYjIxNDVfNDdhM2Y3MTQ2NzczYzZkZDFiMDlkN2Q2NTJiZDJjNzJfSUQ6NzYyNDM2NzQ3ODEzNTQwOTg2OF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="TZHpbmj4Qo314FxkOY0cRa50ntf"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NmEzNmVjYjU2Y2E5YzFjNmU4NzIyYjEwNjJhNTNhMzBfZjBlOWFjNmI1N2YwMzliNDY0NDNmZWU0NDEwYjRlZGJfSUQ6NzYyNDQxMzExNjQxMTU2Mjk3NF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="OiZ2bS3tQoguwcxEQGEczbx0nhb"/></td><td><ul><li>入口<ul><li>【我的任务】页面，点击【上传分集】button弹出</li><li>【我的任务】页面，点击【上传返修版】button弹出</li></ul></li><li>基础信息<ul><li>任务名称</li><li>集数</li><li>任务类型</li><li>任务进度</li></ul></li><li>剧集名称<ul><li>文本框，必填</li><li>默认与任务名称保持一致，支持修改</li></ul></li><li>上传封面图<ul><li>上传图片文件</li><li>文件数量：最多1个</li><li>支持文件大小：最大支持10MB</li></ul></li><li>上传有字幕版本&amp;上传无字幕版本<ul><li>集数：根据剧本集数，按集数顺序展示文件上传区域</li><li>上传视频文件</li><li>文件数量：与集数保持一致</li><li>支持文件大小：最大支持500MB</li><li>【批量上传】button<ul><li>点击调用系统文件选择器</li><li>上传视频文件</li><li>文件数量：支持多个</li><li>支持文件大小：最大支持500MB</li><li>根据文件名称匹配对应集数<ul><li>支持格式：第1集.mp4、第一集.mp4、1.mp4、001.mp4、1_有字幕.mp4…</li><li>当文件名称匹配不到时，不执行上传、并给予错误提示</li></ul></li><li>当上传的集数已存在文件时，则覆盖原文件重新上传</li></ul></li></ul></li><li>上传版权证明材料<ul><li>上传图片文件</li><li>文件数量：最多15个</li><li>支持文件大小：单个文件不超过10MB</li></ul></li><li>当前页面具备自动保存功能，上传/删除文件完成后，下次打开均回显当前文件状态</li></ul></td></tr><tr><td>漫剧审核-待我审核</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTRiYzYxNzNjMzIyMTYyZjIyNDQwYjVhMmNlOWIzMjlfOTI1N2JmODM0Y2MzYWQ2Y2NmODE3MzU2OTIwN2YyOGVfSUQ6NzYzMDg4NzQyOTY5OTk0NzQ2OF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="EqbsbZURooNXrIxZWsxcluPpnYe"/></td><td><h3>入口</h3><ul><li>在【审核管理】菜单下，新增【漫剧审核】二级菜单</li><li>在【漫剧审核】页面，新增【待我审核】tab</li></ul><h3>筛选项</h3><ul><li>任务名称：文本框</li><li>剧本ID：文本框</li><li>制作人：文本框</li><li>审核阶段<ul><li>单选</li><li>可选项：全集审核、分集审核、二审审核、返修版审核</li></ul></li></ul><h3>列表</h3><ul><li>仅展示 审核员=当前用户 &amp; 审核状态=审核中 的审核任务</li><li>根据任务创建时间倒序展示</li><li>任务名称</li><li>剧本ID</li><li>集数</li><li>制作人</li><li>审核阶段</li><li>审核状态</li></ul><h3>操作</h3><ul><li>任务名称：超链接，点击弹出【剧本详情】弹窗</li><li>【审核】button：点击弹出【审核】弹窗</li><li>【审核记录】button：点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-HF2tdi7iDoZ6r6xBZGDcXjJQnFp">审核记录</a>】弹窗</li></ul></td></tr><tr><td>漫剧审核-我参与的审核</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDczNDBkODk2ZTE4ZGJhMzUxYzZmMDllODJmZTg3OWNfZjI2OWEwMzQ1YWVmZGMxMjI1ZThkNzE3NTJlOGYzMDZfSUQ6NzYzMDg5MDczOTA3NzA1Nzc1OF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="EO7FbzbsMoGptmxjPZzcJeJanTh"/></td><td><h3>入口</h3><ul><li>在【漫剧审核】页面，新增【我参与的审核】tab</li></ul><h3>筛选项</h3><ul><li>任务名称：文本框</li><li>剧本ID：文本框</li><li>制作人：文本框</li><li>审核阶段<ul><li>单选</li><li>可选项：全集审核、分集审核、二审审核、返修版审核</li></ul></li><li>审核状态<ul><li>单选</li><li>可选项：审核中、驳回修改、审核通过、已取消</li></ul></li></ul><h3>列表</h3><ul><li>展示 当前用户参与过的审核任务</li><li>根据任务创建时间倒序展示</li><li>任务名称</li><li>剧本ID</li><li>集数</li><li>制作人</li><li>审核阶段</li><li>审核状态</li></ul><h3>操作</h3><ul><li>任务名称：超链接，点击弹出【剧本详情】弹窗</li><li>【审核记录】button：点击弹出【<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-HF2tdi7iDoZ6r6xBZGDcXjJQnFp">审核记录</a>】弹窗</li></ul></td></tr><tr><td>漫剧审核</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDIyOGZjMzk3MTE2ZDM4ODNmMGI4ZjRiN2Q4ZDFhZWNfMDE4YzliNWY5YjFiZDE3NTJiZmVmYzFkMDBhNDQ3NmRfSUQ6NzYzMDg4ODg1OTIxMjU0OTA3NF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="XBulb9phJoFBkCxkvhkcrzHrnfe"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGQwZTUwYzc2YzM5YmZiMDBkNDUyNzBmZDE1ODNhZmVfYzRiZjYzMzQ5YTUxZTMyMWQ1ZjY2YTY0NTIwYWY2ODNfSUQ6NzYzMDg4OTEyMjU5MjM2MTY1OF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="NtyPbBNDRoKPtbxRiqocrWGBnvf"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGVmOWMzMThmYmRjYzRmNDRkMzlhM2RkNGU2YzI2ZDRfYzY3YzQzY2NkZjc5NWQ2MGI1NmU0ODljOTkxOTIwYjZfSUQ6NzYyNDQxMzkxMjMxMTk0MjEwN18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="JlombyJMCoSXVBxQqM2cEVoGnDe"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTE0NDQ1ODhiODVhN2JmNzU4MTJhNTFlMDRkNTFiMTdfZGRlYTU2NDE5ZGU0YTY1MzZmN2EwYmIyODZmMzE2YWNfSUQ6NzYyNjk0MDU1NjA0NDExMDgwN18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="WoRlb2kA9oWVf2xH5wwcywk5npd"/></td><td><h3>入口</h3><ul><li>【漫剧审核】页面，点击【审核】按钮弹出</li></ul><h3>左侧区域</h3><ul><li>显示漫剧关联的剧本详情</li><li>显示剧本内容、剧本分集、付费卡点、集数</li><li>【查看卡点】button：点击滚动至付费卡点处</li><li>联动：当【有字幕视频&amp;无字幕视频】播放对应集数视频时，剧本将自动跳转到对应集数的内容</li></ul><h3>中间区域</h3><ul><li>区域内划分多个Tab<ul><li>任务信息：不区分任务类型</li><li>全集视频：仅任务类型为“全集审核”时显示</li><li>有字幕视频：仅任务类型为“分集审核”、“二审审核”、“返修版审核”时显示</li><li>无字幕视频：仅任务类型为“分集审核”、“二审审核”、“返修版审核”时显示</li></ul></li></ul><h4>任务信息</h4><ul><li>基础信息<ul><li>任务名称</li><li>集数</li><li>画风类型</li><li>视觉效果</li><li>画面比例</li><li>任务类型</li><li>制作备注：仅任务类型为“全集审核”、“分集审核”、“二审审核”时显示</li><li>修改意见<ul><li>仅任务类型为“返修版审核”时显示</li><li>显示多条修改意见记录，点击图片放大查看</li></ul></li></ul></li><li>剧集名称：文本框，支持编辑</li><li>封面图</li><li>版权证明材料</li></ul><h4>全集视频</h4><ul><li>仅任务类型为“全集审核”时显示</li><li>显示“全集制作”上传的“全集视频”</li></ul><h4>有字幕视频&amp;无字幕视频</h4><ul><li>仅任务类型为“分集审核”和“返修版审核”时显示</li><li>显示“分集制作”和“返修版制作”上传的每集视频卡片</li><li>显示内容<ul><li>缩略图</li><li>集数</li><li>时长</li><li>大小</li></ul></li><li>点击展开显示视频播放器，同一个Tab最多存在1集展开，在展开其中一集时，其他集自动折叠</li><li>默认展开第1集视频播放器</li><li>当每集视频播放结束时，做以下动作<ul><li>收起当前集视频播放器</li><li>下一集滚动至固定位置（上一集内容折叠状态完整显示）</li><li>自动展开下一集视频播放器，并自动播放</li></ul></li><li>联动：当【有字幕视频&amp;无字幕视频】播放对应集数视频时，剧本将自动跳转到对应集数的内容</li></ul><h3>右侧区域</h3><ul><li>审核意见：审核员对提审内容的意见编辑区域</li><li>【新增记录】button：点击新增1个“编辑器”</li></ul><h4>编辑器</h4><h5>展开状态</h5><ul><li>支持输入文字、粘贴图片</li><li>最多支持粘贴15张图片</li><li>点击图片放大查看</li></ul><h5>折叠状态</h5><ul><li>文字：展示2行文字，超出部分缩略显示</li><li>图片<ul><li>展示首张图片缩略图</li><li>显示“+N”表示未显示图片数量</li><li>N = 粘贴图片数量 - 1</li></ul></li></ul><h4>操作</h4><ul><li>【保存】button<ul><li>点击保存审核意见的内容和剧集名称，支持下次打开时回显</li><li>文字和图片均为空的记录不保存</li></ul></li><li>【驳回修改】button<ul><li>点击将制作/修改任务进度更新为 “全集/分集/返修版制作中”，将审核任务状态更新为“驳回修改”</li><li>返回制作员修改</li><li>校验“审核意见”必填</li></ul></li><li>【审核通过】button<ul><li>任务类型为“全集审核”：点击将制作任务进度更新为 “分集制作中”，审核任务状态更新为“审核通过”</li><li>审核阶段为“分集审核”<ul><li>判断当前用户是否配置“二审用户”<ul><li>是<ul><li>点击将制作任务进度更新为 “二审审核”</li><li>审核任务审核阶段更新为“二审审核”</li><li>审核任务审核状态更新为“审核中”</li></ul></li><li>否<ul><li>点击将制作任务进度更新为 “已完成”，审核任务状态更新为“审核通过”，将当前剧集落库至漫剧库</li><li>校验：“剧本名称”在【漫剧管理】列表中保持唯一</li></ul></li></ul></li></ul></li><li>审核阶段为“二审审核”<ul><li>点击将制作任务进度更新为 “已完成”，审核任务状态更新为“审核通过”，将当前剧集落库至漫剧库</li><li>校验：“剧本名称”在【漫剧管理】列表中保持唯一</li></ul></li><li>审核阶段为“返修版审核”<ul><li>点击将修改任务进度更新为 “已完成”，审核任务状态更新为“审核通过”，将当前任务修改内容在漫剧库内更新</li><li>校验：“剧本名称”在【漫剧管理】列表中保持唯一</li></ul></li></ul></li><li>审核意见将跟随审核任务，驳回修改后，制作员重新提交，审核意见将一并提交回显</li></ul></td></tr><tr><td>任务详情</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGFkMTQ5MTM0ZmMyZDExZTcyNzNjZWY2ZTViMGZiMDNfZmZlMzQyMWEwNWFmZWRlZDgzOTNiZWYyOTM0ZTIzOWRfSUQ6NzYyNDQyODc1MTQxNzcwNzQ3OV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="OqVCbMqhfohOKgxvmrxcyrMRnld"/></td><td><ul><li>入口<ul><li>【漫剧审核】-【待我审核】tab，点击【任务名称】超链接弹窗</li><li>【漫剧审核】-【我参与的审核】tab，点击【任务名称】超链接弹窗</li></ul></li><li>显示内容与<a href="https://rcn6u2y4zn7a.feishu.cn/wiki/IM62wp1n2i703fkrU1Pc7PCSnYf#share-YeAndVt4NowIgqxJQzucQlQqnLg">【漫剧审核】弹窗中间区域</a>内容一致，剧集名称不可编辑</li></ul></td></tr><tr><td>漫剧管理</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NWY4ODMyZmNkNmI4Y2VjYTNhNjAyNDJkNjM3NDg4ZDhfYTU0YzM3ZWUzM2Q3NjlmZDhlYjhiMzVjOTM3Y2FlNzJfSUQ6NzYyNDQ1NDExNzM5NDM2OTcyNl8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="VH5EbfYgrorcypxOI1mcXTHQntf"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NjYyMGUyNmRlY2M2NzNhOGRmNWMxOWNiYzkxNzM5MjJfZjA3NjU0NTlhZGExMjdhYjVkOTZkMGU1NWQ1NjU1MDZfSUQ6NzYyOTY1MTI1MTAyMjIyMDIyOF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="MwK6bNJOFow3oqxMCWictMY8nid"/></td><td><h3>入口</h3><ul><li>【资源管理】菜单下，新增【漫剧管理】二级菜单</li></ul><h3>筛选项</h3><ul><li>漫剧ID：文本框</li><li>剧集名称：文本框</li><li>剧本ID：文本框</li><li>画风类型<ul><li>单选</li><li>可选项：解说漫、动画漫、沙雕漫、仿真人剧</li></ul></li><li>视觉效果<ul><li>单选</li><li>可选项：2D、3D、仿真人</li></ul></li><li>画面比例<ul><li>单选</li><li>可选项：横屏16:9、竖屏9:16</li></ul></li><li>编剧：文本框</li><li>制作员：文本框</li><li>创建时间：日期范围选择器</li></ul><h3>列表</h3><ul><li>根据创建时间倒序展示</li><li>漫剧ID</li><li>剧集名称</li><li>封面图：点击放大查看</li><li>集数</li><li>付费卡点</li><li>剧本名称</li><li>画风类型</li><li>视觉效果</li><li>画面比例</li><li>编剧：漫剧关联剧本的编剧</li><li>制作员：漫剧的制作员</li><li>创建时间：漫剧审核通过 落库至漫剧库的时间</li></ul><h3>操作</h3><ul><li>剧集名称：超链接，点击弹出【漫剧详情】弹窗</li><li>【下载】button<ul><li>点击弹出下拉选项：下载【无字幕】视频、下载【有字幕】视频、下载提审材料</li><li>点击下拉选项<ul><li>创建打包下载任务<cite doc-id="IM62wp1n2i703fkrU1Pc7PCSnYf" file-type="wiki" title="漫剧运营后台v1.0" token="HqlDdGTZVokgtMxM2e9cJGIwnF4" type="doc"></cite></li><li>toast：下载任务已创建，请到下载中心查看</li><li>若下载任务已存在且未过期时，弹出确认弹窗<ul><li>【重新下载】button：点击将已存在任务状态修改为“已失效”</li></ul></li></ul></li></ul></li><li>【发起修改】button：点击弹出【发起修改】弹窗</li></ul></td></tr><tr><td>漫剧详情</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZWQwYmFmODQ4OGRjMTk0YTVjZDFkZmRmNDUxYTVmNGZfOTgwMTQwNmM5OTgwZjgxMDk1OTUwZDk5YWUyMTMwMjNfSUQ6NzYyNDQ3Nzg1OTE4MDQ0ODcxM18xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="CXicb1A7RoHPPPxNiZZcKprVnJc"/><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTE0Zjk3ZWYxZTExOTU2NDY2MjIxNDlmZTkyOTUxNjhfNDAxMmQ2M2UyZTAxMzhjNTZjZDBkODA2MzkyN2M4ODdfSUQ6NzYyNDQzMjU2ODc3NjI5NzQzOF8xNzc5MjYzNTM3OjE3NzkyNjcxMzdfVjM" mime="image/png" scale="1.000000" src="EVv3bCB1eoLqgmxLf3HculSnnJd"/></td><td><h3>入口</h3><ul><li>【漫剧管理】页面，点击【剧集名称】超链接弹出</li></ul><h3>剧集信息</h3><ul><li>剧集名称</li><li>集数</li><li>付费卡点</li><li>画风类型</li><li>视觉效果</li><li>画面比例</li><li>封面图</li><li>版权证明材料</li></ul><h3>有字幕视频&amp;无字幕视频</h3><ul><li>交互：与<cite doc-id="IM62wp1n2i703fkrU1Pc7PCSnYf" file-type="wiki" title="漫剧运营后台v1.0" token="HqlDdGTZVokgtMxM2e9cJGIwnF4" type="doc"></cite>保持一致</li><li>【下载】button：点击下载单集视频</li></ul></td></tr><tr><td>发起修改</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWQ2YzhkMjM4ODZlYjMzOWJjMTMyOGFkZmNkNDU2ZjlfNjA4ODk5MjFhOTZhYTkyMGRiOTMxNjlkNTc2OWM4ODBfSUQ6NzYyNDQzMjczMDY4ODU3MjM4MF8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="H4xLbIgPIolLDCxUURDcmUJ7nee"/></td><td><ul><li>入口：【漫剧管理】页面，点击【发起修改】button弹出</li><li>漫剧信息<ul><li>剧集名称</li><li>集数</li><li>画风类型</li><li>视觉效果</li><li>画面比例</li><li>制作人</li><li>封面图：点击放大查看</li></ul></li><li>修改意见<ul><li>审核员对提审内容的意见编辑区域</li><li>提交的修改意见，会同步至“修改”任务修改意见字段。</li><li>同时会同步至“修改”任务 审核意见字段，与跟随任务透传</li></ul></li><li>【新增记录】button：点击新增1个“编辑器”</li><li>编辑器：与<cite doc-id="IM62wp1n2i703fkrU1Pc7PCSnYf" file-type="wiki" title="漫剧运营后台v1.0" token="HqlDdGTZVokgtMxM2e9cJGIwnF4" type="doc"></cite>保持一致</li><li>【确认发起】button<ul><li>点击将发起“修改任务”</li><li>需校验“修改意见”必填，至少存在1条文本或图片</li><li>校验：当前剧集若存在“进行中”的“修改任务”，则不予提交，并给予toast提示</li></ul></li></ul></td></tr></tbody></table>

## 下载规则

- 用户触发打包下载后，将需下载的文件打包到同一个文件夹内，再将文件夹归档至“.ZIP”格式压缩包供用户下载

<whiteboard token="AYdYwbYOUhBxfVbNIbrcHPVonng"></whiteboard>

### 文件命名

- 视频文件

  - 按视频的“第X集”为文件名称
  - X：集数序号
- 图片文件

  - 按图片的内容为文件名称
  - 当存在多个相同文件内容时，则在文件名称后面增加自增序号后缀
- 文件夹&压缩包

  - 以“剧集名称”+“下载内容”+“日期”+“时间”格式命名
  - 下载内容
  
    - 有字幕视频
    - 无字幕视频
    - 提审材料（包含 封面图 和 版权证明材料）
  - 日期时间
  
    - 创建下载任务的日期时间
    - 格式：YYYYMMDD_hhmm

### 下载流程

1. 用户触发下载任务
2. 服务器生成文件夹
3. 将需要的文件放置文件夹内
4. 生成ZIP包（仅归档、不做压缩，支持ZIP64）
5. ZIP 包上传到服务器存储，CDN加速
6. 返回临时下载链接给前端（有效期72h）
7. 用户下载（支持断点续传）

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>页面</td><td>示例</td><td>介绍</td></tr><tr><td>下载中心</td><td><img name="image.png" href="https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MWMxYjU4MTdhYTM5YTYzOTUwOWU4ZjYzY2QwOTQ1MDhfNzMxNzU0OTFkY2RhMTIxYjg3NTExYjZiZDkxYmNiMjZfSUQ6NzYyNDQ2NjE5NTk4NzQzNDY4NV8xNzc5MjYzNTM4OjE3NzkyNjcxMzhfVjM" mime="image/png" scale="1.000000" src="Hpq9bgN7RoDcllxmKeHcmuWVnc5"/></td><td><h3>入口</h3><ul><li>【资源管理】菜单下，新增【下载中心】二级菜单</li></ul><h3>筛选项</h3><ul><li>剧集名称：文本框</li><li>下载内容<ul><li>单选</li><li>可选项：【有字幕】视频、【无字幕】视频、提审材料</li></ul></li><li>创建时间：YYYY-MM-DD hh:mm:ss</li><li>状态</li></ul><h3>操作</h3><ul><li>【下载】button<ul><li>点击下载压缩文件</li><li>仅状态为“已完成”时显示</li></ul></li><li>【重试】button<ul><li>点击重新开始打包任务</li><li>仅状态为“失败”时显示</li></ul></li></ul></td></tr></tbody></table>