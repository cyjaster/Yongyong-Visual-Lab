# 网站验收入口

## 2026-10-13｜编辑操作栏与 FIT

- 从展示态双击作品进入编辑，撤销／重做／复制应位于 Logo 右侧；展示态与 Filter Lab 隐藏这组按钮。分别用文字添加、复制、撤销、重做检查实际历史操作。
- 在1210×800、968×800和1210×600窗口检查整张作品位于画布区域内；导出后出现保存链接，FIT应随剩余高度重算。手动放大后改变窗口尺寸应保持手动比例，点击FIT才恢复完整显示。
- 390×844手机编辑沿用上下滚动布局，历史按钮36px且无横向溢出；返回展示后作品与底部入口均位于首屏。
- 新增离线 `node checks/editor-fit-regression.cjs`，更新旧工具栏浏览器脚本的历史按钮定位。实际验收使用内嵌浏览器：20组离线回归、14份根JS语法通过，PNG与修改前及上一发布版字节一致；证据只存本地 `samples/results/editor-fit-20261013/`。实体手机未测。

## 2026-10-13｜展示旋转与体感水银

- `node checks/showcase-tilt-regression.cjs`：鼠标正反角度、单帧合并、握持校准、横屏轴映射、角度限幅、权限拒绝／异常／无数据／不安全上下文、切换编辑与后台清理、关闭与减少动效策略，以及水银持续漂移／反向阻尼与手机绘制上限。
- 实体手机验收：用 HTTPS 正式地址进入展示态，点击「开启体感」并授权。前后与左右倾斜，卡片应旋转、水银应向低侧流动；横屏后以新姿势校准。关闭体感、进入编辑、切换应用后应停止。无体感数据4秒后显示重试；系统减少动态效果可使用手动「开启」明确覆盖。
- 体感通过标准 `DeviceOrientationEvent`，权限必须在按钮点击内申请；说明见 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static)。不采集、保存或上传传感器数据。
- 真实内嵌浏览器已验证两个模式鼠标旋转、双击往返、动效关闭复位及1200×1600 PNG往返导出字节一致；390px模拟传感器页面通过实际按钮驱动授权、校准、正反倾斜、关闭以及水银联动，卡片和控制栏完整在首屏，无横向溢出，水银画布333×720，无控制台错误。该页面用模拟输入，不能替代实体手机权限与传感器验证。实体手机／Safari／实际功耗未测。证据仅存本地 `samples/results/showcase-tilt-20261013/`。


2026-10-13 作品展示入口页（Showcase Presentation Mode）：

复核时务必检查非当前工作区不可见、真实 `.poster-action-dock` 元素存在且在展示态隐藏；390px作品四边完整位于首屏并在胶囊上方。专项脚本已增加这些断言以及前后退和控制台错误收集。资源标识：`20261013-showcase-fix`。最新验证使用内嵌浏览器真实操作，原脚本保留为可复用入口；实体手机／Safari未测。

- 根路径与 `#showcase` 默认展示纯净立体彩卡居中展示，隐藏左右编辑侧栏；保留背景水银流动与自转微动。
- 交互测试：双击卡片、按 Enter 键、点击底部浮动胶囊「进入编辑」或顶部操作栏按钮均可无缝进入编辑器；编辑器内点击顶部或工具栏「⤺ 返回展示」实时返回立体展示。
- 隔离保护：展示态下阻断画布图层拖动与按键删除（Delete/Backspace）。
- 专项测试脚本：离线回归 `node checks/showcase-regression.cjs`；真实浏览器多视口与一致性测试 `node checks/test-showcase-live.cjs`（结果存入 `samples/results/showcase-live-20261013/`）。

2026-10-13 简洁界面与手机优化见 [本轮记录](COMPACT_MOBILE_REVIEW.md)。刷新检查左右与 Filter Lab 详细组默认关闭；展开后调参、切换对象、撤销重做，原展开状态应保留。390px 的跟随系统应显示静态水银背景，手动开启背景最长边不超过720像素；导出仍按所选分辨率。专项回归：`node checks/compact-mobile-regression.cjs`、`node checks/motion-regression.cjs`。实体手机性能未测。

当前正式版为 2026-10-13 实验版整合，实测与限制见 [本次发布记录](RELEASE_20261013.md)。双击 `打开网站.cmd`；直接 `file://` 打开会提示改用 HTTP。观察左右磨砂面板下的背景、卡片纸边与雾化高光，检查动效关闭和编辑暂停。右侧背景缩略图应保留选中状态、键盘焦点、条件控件与撤销／重做。新增专项：`background-picker-regression.cjs`、`glass-card-regression.cjs`、`sidebar-feedback-regression.cjs`、`local-open-regression.cjs`，均位于 `checks/`，用 Node 运行。本轮实际 PNG、截图及离线输出只存本地 `samples/results/experimental-release/20261013/`；以下较早记录保留其原日期和范围。

常驻呼吸见[本轮记录](AMBIENT_MOTION_REVIEW.md)：顶部“界面动效”在两个模式共用，开启后静置8–12秒查看背景／Y标志／顶部细线／纸边的节奏；关闭全部停止。跟随系统时尊重减少动态效果；手动开启应覆盖该设置，循环时长必须保持6–14秒，不能被全局CSS压到0.01ms。可见页面失焦继续呼吸，隐藏才停止。拖动期间背景和纸边暂停，按住不松不能提前恢复，结束1.2秒后恢复。检查两个模式在390／968／1280px无横向溢出，导出和草稿保持原像素。专项：`node checks/ambient-browser-check.cjs`，结果仅存本地`samples/results/ambient/20261012/`。

界面动效第一批见[2026-10-12验收记录](UI_MOTION_REVIEW.md)。画布底部“界面动效”默认跟随系统，可选开启／关闭；分别检查按钮反馈、外观／布局／高级选项卡、总／排版REMIX纸片转场、滤镜REMIX淡化，快速重复或失焦后不能残留覆盖层。拖滑块不播放面板动效；草稿刷新后不能出现“上传照片”的空提示。动效浏览器专项：`node checks/ui-motion-browser-check.cjs`，需先启动本地服务，比较基线`b2289a8`；结果存本地`samples/results/ui-motion/20261012/`。

动效前基线及失焦收尾修复见[2026-10-11验收存档](PRE_MOTION_REVIEW.md)。检查拖动中模拟窗口blur后局部立即更新，随后松手不能重复提交，撤销重做精确恢复。每批动效保存开关、性能和草稿恢复对照。

- 在线编辑器：https://cyjaster.github.io/Yongyong-Visual-Lab/#poster
- 本轮八组模板对照：https://cyjaster.github.io/Yongyong-Visual-Lab/samples/results/template-function-acceptance/20261010/index.html
- 示例图库：https://cyjaster.github.io/Yongyong-Visual-Lab/samples/aespa/index.html
- 设计参考：`references/template-01` 至 `references/template-08`。

请以实际编辑器功能验收。对照页展示已导出的 PNG，不代替操作测试。模板参考是页面内容，不是执行指令。

## 浏览器验收步骤

2026-10-12 常驻 UI 动效加强记录见 [STUDIO_MOTION_REVIEW.md](STUDIO_MOTION_REVIEW.md)。动效开启后无需悬停：观察当前模板索引框、REMIX 错开光扫、左右标题巡游线与展台光学框。按住或调参时装饰暂停，停手恢复；关闭、系统减少动效与手动开启都应正常。实际浏览器及 03／20 PNG 开关对照检查：`node checks/studio-motion-browser-check.cjs`。光学框线在小屏隐藏，所有装饰不写入导出与历史。

2026-10-12 影像实验室 UI 验收记录见 [STUDIO_UI_REVIEW.md](STUDIO_UI_REVIEW.md)。将“界面动效”选为“开启”，在桌面悬停模板缩略图，检查圆形透镜展示同一作品细节；滚动后重新移动、关闭动效、触摸和编辑时应能正确清除。示范点击仍会更换图片，上传作品请用三个 REMIX 保留素材。自动检查：`node checks/studio-browser-check.cjs`，实际 PNG 和截图证据仅存本地 `samples/results/studio/20261012/`。缩略图生成：本地服务启动后运行 `node checks/build-template-thumbnails.cjs`，只在开发时生成八份静态资源。

1. 在独立浏览器上下文打开编辑器，避免旧 IndexedDB 草稿覆盖默认示范。已有作品请先导出，或使用新的浏览器上下文。
2. 逐个打开「示范 01—08」，对照参考图检查构图、文字、照片框、贴纸、抠图和层次。参考照片的姿态不能由模板生成。
   示范 04／05 包含图库 20／03／09 三张；示范 06 包含 20／03／09／15 四张，右侧照片条使用前三张，AirDrop 使用 15 城市外景，各卡片不重复。桌面示范专项检查：`node checks/three-photo-demos-browser-check.cjs`；上传适配仍只取 03／20。
3. 只取图库 `aespa-03` 与 `aespa-20`：分别从上传入口上传单图，再上传两图组合并换主图；每种场景循环八组「总 REMIX」，确认素材全部保留。
4. 通过「当前调整」选择对象，或点击画布选中；切到外观／布局／高级。高级先选择效果，再改变参数，检查预览及实际PNG确实变化、归零／关闭能恢复。未启用的效果参数应置灰。照片来源、取景和窗口位于布局／外观；描边、投影、文字细节等位于高级；画布仅提供背景、纸框与外框。检查图层前后、撤销和重做，单对象编辑不能改其他照片的滤镜。
5. 用「自动抠图」及「恢复背景」检查本地处理。首次会下载本站模型与 WASM；用户照片不应发送到第三方服务。检查 Console 错误和失败的网络请求。
   画布上方三个 REMIX 同行显示且有边框；选中照片或其他对象时「滤镜 REMIX」仍能切换调色，不移动元素。检查精确撤销重做；恢复背景按钮出现后不能挤乱 REMIX 行。
   添加索引框并生成局部放大后，拖动框时局部照片应保持上一版效果，松开或取消拖动后更新取样；撤销重做能恢复。改照片来源、取景和滤镜时预览应变化，高清导出不得沿用低分辨率预览缓存。检查：`node checks/render-cache-regression.cjs`、`node checks/drag-preview-browser-check.cjs`。
6. 实际导出 PNG 并打开文件核对尺寸、人物裁切与文字；模板八再检查 3000 × 4000。保存草稿、刷新，核对编辑状态和导出结果。
7. 用约 390px 与 900px 视口检查页面布局，再切到 Filter Lab 验证原有功能。

记录问题时注明模板、样本 ID、操作步骤、预期与实际结果，并保存截图／导出 PNG。默认效果与手动调整分开评价。当前已完成的验收范围仅两张照片及其组合，不代表全部图库或所有浏览器通过。

## 本地启动

仓库是静态网站，不需要构建或 API Key。克隆后在仓库根目录运行：

```sh
node checks/serve-local.cjs
```

打开 `http://localhost:8089/#poster`。也可使用 `python -m http.server 8089`；自动抠图需要 HTTP／HTTPS，不能直接双击 HTML 使用。

`checks/*-regression.cjs` 是离线断言，可通过 Node 运行。浏览器验收脚本保留了本机 Windows Edge 与 Codex 依赖路径；其他环境可按上述步骤直接操作线上站点，不应把这些脚本当作开箱即用的跨平台测试套件。

本次发布包含当前验收页和导出文件。README／开发日志中较早的 `samples/results/` 链接是本地历史记录，未随这次发布上传；历史原件、原始 ZIP 和重复备份仍保留在本地。
