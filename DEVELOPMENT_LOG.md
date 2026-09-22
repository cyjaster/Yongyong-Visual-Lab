# Yongyong Visual Lab 开发记录

## 2026-09-21｜Collage Poster 模式与验收流程

### 本轮完成

- 保留原有 `Filter Lab`，新增无刷新切换的 `Collage Poster` 模式。
- 新增索引框、局部裁切放大图、连接线、标签、海报外框。
- 新增主标题、副标题、小字说明与重复文字。
- 新增黑白、对比度、半调、颗粒、粗粝与轮廓风格控制。
- 新增 CCTV Red、CCTV Blue、Halftone Editorial、Soft Y2K 四组预设。
- 新增 PNG 导出。
- 使用 `assets/demo-collage.jpg` 制作 `WILD SIGNAL` 默认示范模板。
- 修复模式切换被 Grid 布局覆盖的问题。
- 修复直接双击 `index.html` 时，本地图片像素读取受限导致整个 Canvas 渲染中断的问题。

### 发现的问题

曾只完成 HTML 结构和 JavaScript 语法检查，没有在真实浏览器中确认最终画面。结果示范图片触发 `file://` 像素读取限制后，Canvas 在首个滤镜阶段中断，只留下空白网格。

这说明“语法正确”不能代替“页面实际可用”。涉及 Canvas、图片、字体、拖拽、导出和响应式布局时，必须完成浏览器级验收。

### 后续固定验收流程

1. 在项目目录启动轻量静态服务器，不直接让自动化浏览器访问 `file://`。
2. 使用 Codex 内置浏览器打开 `http://127.0.0.1:<端口>/` 或 `http://localhost:<端口>/`。
3. 实际检查两个模式是否可以往返切换。
4. 检查默认示范图、索引框、局部裁切、连接线和文字是否同时出现。
5. 实际拖动并缩放至少一个索引框和一张局部图。
6. 调整至少一种全局滤镜并应用一个预设。
7. 导出 PNG，重新打开导出文件确认内容完整。
8. 检查桌面宽屏和窄屏布局；发现问题后修改，再重新加载验证。
9. 最终汇报必须区分：语法检查、结构检查、浏览器实测、导出复查。

### 本地运行建议

项目仍是纯静态网站。浏览器验收时应通过本地 HTTP 服务访问；部署到 GitHub Pages 后同样按普通同源静态资源运行。

## 2026-09-21｜Collage Poster v1.1 视觉精修

### 本轮重点

- 每张局部裁切图拥有独立滤镜与参数：Original、Black & White、High Contrast B&W、Halftone、Rough / Grain、Outline / Edge、Invert、Posterize。
- 半调增加网点大小、密度、角度、强度和对比度；强度范围允许从 Clean 推到 Destroyed。
- 全局印刷质感增加扫描纹、纸张纹理、脏版印刷、低质压缩与 Xerox 组合效果。
- Frame、Crop、Text 支持旋转并可自由越界、重叠；不再强制规整排版。
- 建立统一图层顺序，Frame、Crop、Text、Connector 均可置顶、上移、下移或置底。
- Connector 支持 Straight / Elbow、颜色、线宽、透明度、虚线和点 / 十字端点。
- Index Label 支持自动编号、前缀、自定义编号，以及 Solid / Plain / Outline 三种样式。
- Typography 增加字距、行距、横向 / 纵向缩放、旋转、透明度；Repeat Text 支持横排、竖排、间距和错位。
- 新增 Duplicate、Delete、Undo / Redo 与对应快捷键。
- 重调四套原有预设，并新增最激进的 XEROX / PUNK 视觉系统。
- 默认 WILD SIGNAL 模板改为受控错位：Face 为 Halftone，Hand 为 High Contrast B&W，Flower 为 Outline。

### 浏览器实测

- 通过本地 HTTP 服务在 Codex 内置浏览器打开，而不是使用 `file://`。
- `Filter Lab` 与 `Collage Poster` 可双向无刷新切换。
- 实际选中三张 Crop，右侧分别显示 Halftone、High Contrast B&W、Outline / Edge，独立参数未互相覆盖。
- 实际执行图层下移与撤销；页面保持可操作。
- 实际应用 XEROX / PUNK，确认高反差、粗网点、扫描纹、脏版、反相局部与错位同时生效。
- 实际点击导出，页面返回“PNG 海报已导出”。
- 浏览器控制台未发现 error 或 warning。

### 保持不变

- 原 `Filter Lab` 逻辑和页面结构未重构。
- 项目仍为 HTML / CSS / JavaScript 纯静态网站，无后端、无登录、无云存储。

## 2026-09-21｜Collage Poster v1.2 编辑体验与文字系统

### 本轮完成

- 中央 Workspace 新增 Zoom Out、当前比例、Zoom In、100% 与 FIT；支持 `Ctrl / Cmd + Mouse Wheel`，并可按住 Space 拖动画布视图。
- Zoom 仅改变 Canvas 的 CSS 显示尺寸，内部画布和 PNG 输出均保持 900 × 1200 的真实尺寸。
- 桌面三栏锁定在可视窗口高度，右侧 Inspector 独立滚动；窗口 resize 时 FIT 自动重算。
- Inspector 改为 Accordion：TRANSFORM、IMAGE、PRINT / SCAN、TEXTURE、STYLIZE、FRAME、LABEL、TYPOGRAPHY、REPEAT。
- Inspector 顶部增加当前对象说明，例如 `DETAIL CROP / 03`、`INDEX FRAME / FACE 01`、`MICRO TEXT`。
- Typography 增加激进 Tracking、Line Height、Horizontal / Vertical Scale、Alignment、Vertical Text 和更大的字号范围。
- Repeat Text 增加 X Offset、Y Offset、Rotation Step，并继续作为一个整体对象参与拖动、旋转、删除和图层排序。
- 新增 Micro Text 默认样式，用于文件号、日期、相机编号和数据索引。
- Frame 增加 Stroke Opacity、Solid / Dashed，以及 Full Frame / Corner Frame。
- 主图进入统一图层序列；Text、Crop、Frame、Connector 现在可以跨过主图前后排序。
- Duplicate 的默认偏移改为 X + 10、Y + 10。

### 真实浏览器验收

- 通过 `http://127.0.0.1:4173/` 在 Codex 内置浏览器验证，没有使用 `file://`。
- Zoom In / Out、100%、FIT 实测可切换；桌面 FIT 为 73%，1200 × 800 视口自动变为 66%，恢复后回到 73%。
- Accordion 展开后不再撑高整个三栏工作区，FIT 比例保持稳定。
- Hero Title 实测 Horizontal Scale 2、Vertical Scale 1.5、Rotation -12、Tracking 25，并可裁切到海报边缘之外。
- Micro Text 默认 Vertical；Repeat Text 实测 Repeat 7、X Offset 12、Y Offset 5、Rotation Step 2。
- 新建 Frame 后实测 Corner Frame、Dashed、Stroke Opacity 45。
- 新建 Hero Title 后送至底层，确认能够被 Main Image 遮挡。
- PNG 导出出现成功反馈，浏览器控制台无 error / warning。
- `Filter Lab` 可正常切回，原有工具面板和预览画布保持完整。

### v1.2 滚动回归修复

- 修复桌面工作区固定高度后，左侧工具栏无法用鼠标滚轮上下浏览的问题。
- 桌面端左侧工具栏、中央放大画布、右侧 Inspector 现在分别管理自己的纵向滚动。
- 820px 以下继续采用整页自然滚动，不把移动端拆成三个独立滚动区。

## 2026-09-21｜Collage Poster REMIX Layout

### 本轮完成

- 左侧新增 `LAYOUT REMIX`，提供 Light / Medium / Wild 三档强度和明显但克制的 `随机排版 / REMIX` 按钮。
- REMIX 保留主图、所有文字内容、Frame / Crop 对应关系和对象 ID，不删除或新建用户素材。
- 使用 Orbit、Side Stack、Diagonal、One Big / Two Small、Edge Notes 五类构图骨架，再叠加受约束的坐标、缩放、旋转和越界扰动，避免纯随机堆叠。
- Crop 参与位置、尺寸、旋转、图层、连接线类型和局部滤镜变化；Frame 只在原索引区域附近轻微漂移，继续保持取景意义。
- Hero、Subtitle、Caption、Micro、Repeated Text 分类型参与重排；字体只从现有海报字体池中选择，原文字内容不变。
- Medium / Wild 可轻量变化背景、外框、印刷参数和色板；Light 基本保持字体与背景，只做构图微调。
- 图层采用“背景文字 / 主图 / 连接线 / 前景拼贴”的受控重组；Hero Title 固定留在前景，并限制为至少保留可读主体。
- 每次 REMIX 只写入一次历史栈，可用一次 Undo 回到上一版，再用 Redo 恢复。
- 按钮增加短促扫描反馈，画布增加轻微脉冲，结果提示会显示本次构图模式与强度。

### 验收重点

- 通过本地 HTTP 服务在 Codex 内置浏览器打开 `http://127.0.0.1:4173/`。
- 左侧工具栏使用鼠标滚轮独立滚动到 REMIX 区，未复现无法上下滚动的问题。
- Medium REMIX 明显改变 Crop、标题、连接线、图层、背景与边框；示范图和 `WILD SIGNAL` 文案仍保留。
- 一次点击“撤销”完整恢复 REMIX 前的默认示范模板，“重做”重新恢复 REMIX 结果。
- Wild REMIX 实测产生 One Big / Two Small 构图；Hero Title 仍保留可读主体，Crop 可部分越界但没有全部飞出画布。
- PNG 导出、Filter Lab 回切和控制台检查继续纳入本轮浏览器验收。

### REMIX 非累积修复

- 修复连续点击 REMIX 时，以前一张随机结果为输入继续累加 Grain、Halftone、旋转、缩放和滤镜参数的问题。
- 第一次点击会保存当前编辑状态作为 REMIX 基准；连续点击均先恢复这份基准，再生成新的平行版式。
- 用户进行手动编辑、应用预设、Undo / Redo 跳转或恢复模板后，下一次 REMIX 会自动建立新的基准。
- 历史栈仍保留每次生成的结果，因此 Undo / Redo 与“重新生成平行方案”可以同时成立。
- 浏览器连续执行 8 次 Medium REMIX：默认 Grain 4 的结果始终处于基准扰动范围，没有逐次增长；手动把 Grain 改为 50 后，后两次结果为 47 和 41，证明新系列从手动值重新建立基准。
- 连续 REMIX 后执行 Undo，能够回到上一张 REMIX 方案，而不是留下当前方案的滤镜残留。

### REMIX 版式与文案扩充

- 构图骨架由 5 套扩充到 15 套，新增 Top Press、Bottom Press、Left Rail、Right Rail、Split Axis、Corner Burst、Center Lock、Magazine Spine、Cross Scan、Off Grid。
- 每套骨架现在同时定义 Crop 插槽、Hero Anchor 和信息文字 Anchor，避免只有局部图变化而文字仍像同一模板。
- 新增 14 组海报文案系统，Hero、Subtitle、Caption、Micro Text、Repeated Text 会作为一整套语义共同变化。
- 工具栏新增 `Shuffle Copy` 开关；关闭后只重排视觉，严格保留用户输入文字。
- 版式与文案均排除上一轮结果，避免连续两次抽中完全相同的系统。
- 结果 Toast 同时显示布局名称、文案主题和 REMIX 强度，方便判断当前生成方向。
- 浏览器连续抽取 10 次，得到 Split Axis、Magazine Spine、Cross Scan、Left Rail、Side Stack、Corner Burst、Top Press 等不同骨架；版式和文案均未连续重复。
- 开启 Shuffle Copy 后实测生成 `SPRING ERROR` 整套文案；一次 Undo 完整回到 `WILD SIGNAL`。
- 关闭 Shuffle Copy 后实测 Toast 显示 `COPY LOCK`，重排后的 Hero 仍为 `WILD SIGNAL`。

## 2026-09-21｜REMIX Main Image + Fragment System

### 本轮完成

- 将固定 `imageBox` 升级为真正的 Main Image 对象，加入 X / Y、Width / Height、Rotation、Image Zoom、Crop X、Crop Y 与 Layer Order。
- 新增 Full Base、Tight Crop、Offset Base、Floating Base + 1、Full Base + 2、Fragmented Base 六种主图构图模式。
- Offset Base 内部细分 Left、Right、Low 三种重心；Fragmented Base 会把主图本身裁成三条留缝并横向错位的图像带，而不只是把碎片盖在完整底图上。
- Light 仅轻微移动、缩放和裁切主图；Medium 最多生成 1 个 Fragment；Wild 支持 1–3 个 Fragment 与更明显的主图裁切、位移和 ±4° 旋转。
- 新增独立 `state.fragments` 与 `fragment` 图层类型，没有复用 Detail Crop 或 Connector 数据结构。
- Main Fragment 支持 Offset Slice、Enlarged Detail、Duplicated Block、Stylized Fragment 四类切片语义，并可独立使用 Original、B&W、High Contrast、Halftone、Rough、Outline、Invert、Posterize。
- Fragment 可直接选中、拖动、缩放、旋转、调透明度、复制、删除和排序；Main Image 也可直接选中并继续调整裁切。
- REMIX 改变主图后，Index Frame 会按主图新版心和比例迁移，Detail Crop 继续从对应框区域读取原图。
- Fragment 进入统一图层、历史快照和 Canvas 绘制流程，因此 Undo / Redo 与 900 × 1200 PNG 导出会保留全部主图切片。

### 浏览器验收记录

- Wild 实测抽到 Floating Base + 1，主图位置、尺寸、裁切和轻微旋转均发生变化，并生成一条独立黑白 Offset Slice。
- Fragment 在画布中成功选中，Inspector 显示独立 Transform / Image / Print / Texture / Stylize；拖动后 X 从 102 更新为 216。
- 主图在画布中成功选中，Inspector 显示 Main Image 模式与 Crop 控制；将 Image Zoom 调至 1.6 后可见裁切即时变化。
- Wild 实测抽到 Fragmented Base，画面同时出现三类差异化切片，主图仍保持主体可见。
- 从默认模板执行一次 Wild `Tight Crop` 后，一次 Undo 完整恢复默认主图尺寸、裁切、文字和无 Fragment 状态。
- 在 `Fragmented Base` 三碎片状态下执行 PNG 导出，页面返回 `900 × 1200` 成功反馈；Filter Lab / Collage Poster 往返切换正常，浏览器控制台无 error 或 warning。

## 2026-09-22｜Collage Poster v1.3 视觉锚点与混乱预算

### REMIX 生成规则

- REMIX 的第一步改为选择视觉锚点，而不是立即随机全部对象。新增 Main Image Stable、Hero Title Stable、Detail Crop Stable、Quiet Space Stable 四种 Anchor Mode，并避免连续两次使用同一种锚点。
- 每种 Anchor Mode 会给 Main Image、Hero、Detail Crop、Fragment、Frame、Tertiary Type 与 Texture 分配 Stable / Medium / Wild 预算；相同 REMIX Strength 下，不同角色获得的位移、缩放、旋转与样式变化幅度也不同。
- 左栏增加 Balanced / Experimental：Balanced 使用稳定优先的布局池与较低预算，Experimental 才开放更激进的构图骨架、旋转、越界与第二个 Fragment。
- 主图锚点会禁用 Fragment、限制旋转和裁切，并在主体区域建立安全区；标题锚点固定可读尺度、低旋转和完整不透明度；局部图锚点选择一张 Crop 放大并保留 Original / B&W；留白锚点在四个方向中保留一块安静区域并把主图、Crop 和文字推向另一侧。
- 强局部滤镜在 Balanced 中最多保留一个、Experimental 中最多两个；全局半调 / 轮廓 / Posterize 较强时，局部图会自动退回 Original / B&W，避免所有图像同时成为噪声。
- 字体池按 Hero、Editorial、UI / Mono、Accent 分工。Hero 使用显示字体，Subtitle / Caption 使用杂志字体，Micro 使用等宽字体，Repeat 使用少量强调字体；不会再把所有文字随机成彼此冲突的风格。
- 图层重建改为角色分层：Repeat / Micro 位于主图之下，Connector 与 Frame 保持索引关系，Secondary 位于中层，Hero 或 Anchor Crop 固定在主视觉层。Tertiary 元素不再随机压过 Primary。
- 结果提示现在显示本次 Anchor Mode、布局、Composition Mode 与 Strength，方便直接判断生成逻辑。

### 真实浏览器验收

- 通过 `http://127.0.0.1:4173/` 在 Codex 内置浏览器载入本次版本，并确认左栏出现 Composition 与 `4 种视觉锚点 · 70/30 混乱预算`。
- 连续执行 8 次 Balanced / Medium，实际覆盖 Hero Title Stable、Detail Crop Stable、Quiet Space Stable、Main Image Stable 四种锚点；锚点不连续重复，布局仍持续变化。
- Detail Crop Stable 实测会放大并保留一张清晰局部图；Hero Title Stable 的长标题会根据字数压缩到可读宽度；Quiet Space Stable 能保留整块上方留白；Main Image Stable 保持人物面部完整且不生成 Fragment。
- Experimental / Wild 实测得到 Main Image Stable + Side Stack：周边 Crop 明显旋转、越界并重排，但人物仍是稳定第一视线，说明强度不会覆盖锚点规则。
- Undo 目视回到上一张 Hero Title Stable / Balanced 方案，Redo 重新恢复 Experimental / Wild 方案，REMIX 仍是一个完整历史步骤。
- PNG 导出返回 `PNG 海报已导出 · 900 × 1200`；Filter Lab 与 Collage Poster 往返切换后两个工作区均正常显示。

### Frame REMIX 补充修正

- 修正 Index Frame 只按主图比例迁移、实际位置变化过小的问题。
- 每轮选择一个 Stable Frame；若锚点是 Detail Crop，则对应 Frame 自动成为 Stable Frame，其余框获得明显但受限的方向偏移。
- Frame 的位移量改为依据新版主图宽高计算，并受 Strength、Composition Mode 和 Chaos Budget 共同控制；Medium / Balanced 已能明显改变取景重心，Experimental / Wild 的幅度更大。
- Frame 同时参与尺寸、旋转、线宽与样式变化；两个框重叠过高时执行一次反向错位修复。
- 所有 Frame 仍限制在主图有效区域附近，不会像 Detail Crop 一样飞到海报外围；对应 Crop 的采样区域、标签和 Connector 会继续同步。
- 浏览器以默认示范图连续执行 Balanced / Medium，索引框相对脸部、手部和花朵区域产生了肉眼可见的不同取景重心，不再只看到外围 Crop 变化。
- Experimental / Wild 实测为 Quiet Space Stable + Off Grid，Frame 位移和旋转幅度明显放大，但仍围绕人物主体并保留一个低变化框。
- Frame 修正后 Undo / Redo 仍可用，PNG 再次成功导出为 900 × 1200。

### Frame 区域轮换与 Crop Profile

- 将 Frame 从“原坐标附近增加偏移”升级为六组受控区域模式：Head / Sleeve / Garment、Hair / Hand / Lower、Shoulder / Face / Texture、Left Edge / Flower / Sleeve、Upper / Center / Hem、Cross Body。
- 连续 REMIX 会排除上一组 Frame Pattern；非锚点框向新的归一化区域明显插值，因此不会持续聚焦脸部，也不会因为主图尺寸变化而失去相对位置。
- 取消普通 Anchor Mode 下随机保留一个完全稳定 Frame；现在只有 Detail Crop Stable 对应的 Frame 使用低混乱预算，其余框均参与区域轮换。
- Detail Crop 增加互不重复的视觉 Profile 与形状 Profile：Clean、B&W、High Contrast、Halftone、Outline、Rough，以及 Experimental 下的 Posterize / Invert；同时形成横向、纵向、方形和长条图块。
- Balanced 的强 Crop 上限由一个调整为两个，Experimental 最多三个；若主图全局处理已经很强，则仍限制为一个强 Crop。
- 浏览器连续生成三次 Balanced / Medium：Frame 分别落到脸部、手部、衣服纹理、袖口和下半身区域，连续结果不再只围绕脸部微调。
- 同组三张 Detail Crop 实测出现轮廓手部、黑白面部、衣料彩色特写，以及黑白服装 / 柔和彩色袖口等明显不同的 Profile 与横竖比例。
- 修改后 Undo / Redo 正常，PNG 再次成功导出为 900 × 1200。

### 外围微型索引网

- 将 REMIX 的 Index Frame 总量调整为 Light 约 5 个、Balanced / Medium 约 6 个、Experimental / Wild 最多 7 个。
- 原有 Frame 在 REMIX 时缩小到主图宽度约 24%、高度约 22%以内，线宽限制为 1–4，标签字号限制为 8–12，使其退回信息标记层。
- Frame Pattern 改为 Perimeter Clockwise、Cross、Low、High、Split、Offset 六组外围布局，主要占据四角、左右边缘、顶部与下缘，避免集中遮挡人物中心。
- 自动补充的 TRACE / AREA / SCAN / ID 辅助框标记为 `remixAux`，下一次 REMIX 会重新生成，不会累积；若用户由辅助框生成 Detail Crop，则自动保留为普通 Frame。
- 只有 Detail Crop Stable 对应的索引框允许靠近主角区域，其余框优先进入外围索引位。
- 浏览器以示范图执行 Balanced / Medium 后，原有三框扩展为六个微型索引标记，分别出现在顶部、左右边缘、肩部和下缘；人物脸部与上半身中心不再被多个大框共同覆盖。
- 连续执行三次 REMIX，辅助框数量保持稳定且位置重新分配，没有出现 6 → 9 → 12 的累积问题。
- 外围微型索引网修改后 Undo / Redo 正常，PNG 再次成功导出为 900 × 1200。

## 2026-09-22｜Collage Poster 画布背景 / Paper System

### 实现

- 左侧新增 `BACKGROUND / PAPER` 工具组，提供 Solid、Index Grid、Chrome、Scan Paper、Dot Matrix、Soft Y2K、Blue Print 七种程序化背景预设。
- 背景被定义为低干扰的“纸层”：网格、扫描线、点阵和渐变负责建立 Y2K / 印刷语境，但透明度与对比度受到控制，主图和索引系统仍是视觉主体。
- 新增本地背景图上传。背景图片以内存资源 ID 管理，历史快照只保存 ID，避免把大体积 Data URL 塞入 Undo / Redo 栈。
- Inspector 增加背景样式、背景图透明度和 Cover / Contain / Stretch 填充方式；自定义图片可叠加在任一程序化纸层之上，也可单独移除并保留当前预设。
- 所有背景统一进入 Canvas 绘制链路，因此导出的 900 × 1200 PNG 会保留底色、程序化纹理与自定义背景图；项目仍无后端依赖，可直接静态部署。

### 浏览器验收

- 通过 `http://127.0.0.1:4173/` 在 Codex 内置浏览器刷新本次版本，确认左栏七种背景入口与右栏 Style / Opacity / Fit 控件均正常显示。
- 实际应用 Chrome Gradient 与 Scan Paper 后，画布立即重绘且 Inspector 状态同步；Chrome 保持低对比粉蓝纸层，没有覆盖主图、标题与索引信息。
- Scan Paper → Undo 恢复 Chrome Gradient → Redo 恢复 Scan Paper，说明一次背景切换作为一个完整历史步骤进入 Undo / Redo。
- 带 Scan Paper 背景导出成功，页面返回 `PNG 海报已导出 · 900 × 1200`。
- Filter Lab / Collage Poster 往返切换正常，浏览器控制台无 error 或 warning。

### REMIX 背景联动

- REMIX 在确定 Anchor Mode 与 Layout Template 后再选择背景，背景因此服从构图角色，而不是与前景无关地随机抽取。
- Main Image Stable 优先 Solid / Grid / Soft Y2K；Hero Title Stable 可使用 Chrome / Blueprint；Detail Crop Stable 可使用 Scan Paper / Dot Matrix；Quiet Space Stable 保持较安静的 Solid / Soft Y2K / Grid。
- Edge Notes、Magazine Spine、Cross Scan、Off Grid 等信息型构图提高 Scan / Dot / Blueprint 权重；Orbit、Corner Burst 等更流动的构图提高 Chrome / Soft Y2K 权重。
- REMIX 会排除当前背景与上一次 REMIX 背景，减少连续重复；Light 使用受限背景池，Medium / Wild 才逐步放开强纹理。
- 若用户已经上传自定义背景图，REMIX 保留该图片，只改变其透明度与填充方式，不会擅自清空用户素材。

### REMIX 背景浏览器验收

- 在 Balanced / Medium 下连续执行 6 次 REMIX，背景依次出现 Blue Print、Soft Y2K、Index Grid、Soft Y2K、Chrome、Index Grid；相邻结果没有重复同一纸层。
- 实测 Hero Title Stable + Split Axis 匹配 Blue Print，Quiet Space Stable + Diagonal 匹配 Soft Y2K，Hero Title Stable + Orbit 匹配 Chrome，说明背景会随锚点与构图系统变化。
- 目视检查 Index Grid 方案时，人物仍是第一观看对象，网格只承担纸层和信息坐标感，没有压过主图与局部图。
- Undo 将整版从 Index Grid 恢复到上一版 Chrome，Redo 再恢复 Index Grid；背景与其他 REMIX 参数属于同一个可逆历史步骤。
- REMIX 背景状态下 PNG 再次成功导出为 900 × 1200，浏览器控制台无 error 或 warning。

## 2026-09-22｜REMIX 主图稳定与重叠副片

- 收紧主图的 Layout Mode 目标坐标、随机漂移、尺寸波动和模板插值幅度，避免 REMIX 时人物主体在版面内大范围跳动。
- Quiet Space 模式的留白宽度由约三分之一收紧到约四分之一，主图仍会为留白让位，但不再被推到过度偏离版心的位置。
- 非 Main Image Stable 模式将设计张力转移到可见但克制的倾斜：Medium 主要约 1–3°，Wild 可进一步增加；Main Image Stable 仍保持近乎端正。
- 新增 `OVERLAP PLATE` 主图副片：复制接近完整的主图区域，形成轻微缩小、错位和反向倾斜的第二张照片，并固定放在主图背后。
- Overlap Plate 与 Detail Crop 数据语义分离，不带索引连线；仍可选中、移动、缩放、调滤镜、排序、撤销和导出。
- Light 仅低概率出现重叠副片，Medium 适量出现，Wild 更常出现；主图作为视觉锚点时再次降低出现概率。

### 浏览器验收

- Balanced / Medium 第二次 REMIX 即生成 `DETAIL CROP STABLE · LEFT RAIL · OVERLAP PAIR`，证明重叠副片进入正常构图池而非孤立演示模板。
- 实测一版 `TIGHT CROP / OVERLAP` 的主图为 X 82、Y 130、740 × 936、Rotation −1.5°；相较默认 X 70、Y 150，主体基本守住版心，张力来自倾斜与背后副片。
- 主图 Inspector 能识别 `/ OVERLAP` 状态，主图与副片仍属于可编辑图层。
- Undo 清除整次 REMIX，Redo 恢复 `TIGHT CROP / OVERLAP`；重叠副片没有脱离历史快照。
- 该状态下 PNG 成功导出为 900 × 1200，浏览器控制台无 error 或 warning。

## 2026-09-22｜Typography REMIX 乱中有序

- 将文字 REMIX 从“每个文字对象独立随机”改为“整组先选择排版骨架”，新增 Bottom Lock、Top Editorial、Side Spine、Split Axis、Image Overlap、Quiet Corner 六种 Typography Layout Mode。
- 每种模式明确 Hero、Subtitle、Caption、Micro 与 Repeated Text 的共同轴线和区域；副标题与说明文字组成同一组，Micro / Repeat 只承担一条信息带。
- 每版只指定一个 Break Role。Hero 破格时，其他文字保持水平或统一侧向；Repeat 破格时，Hero 保持端正；Quiet Corner 不设置破格对象。
- 字体改为一次选择整套 Font System：Hero、Editorial、UI / Mono、Accent 各使用一套统一字体，同层级文字不再各抽一个字体。
- Repeated Text 取消无约束旋转和随机方向，方向由排版骨架决定；默认低透明度、零 Rotation Step，只在 Experimental 的指定模式中允许轻微节奏偏移。
- Typography Mode 会根据 Anchor Mode 筛选：主图锚点避开 Image Overlap，局部图锚点可使用 Split Axis / Image Overlap，留白锚点优先安静骨架。

### 浏览器验收

- Balanced / Medium 连续执行 10 次 REMIX，实际覆盖 Image Overlap、Top Editorial、Side Spine、Quiet Corner、Bottom Lock、Split Axis 六种 Typography Mode，相邻结果不重复同一骨架。
- Split Axis 目视呈现为顶部主标题、右上副标题 / 信息组、底部低透明度重复文字，三层共享明确轴线，没有散落到无关角落。
- Top Editorial 目视呈现为同一顶部基线上的 Hero、Subtitle 与 Caption，Micro / Repeat 退到边缘作为信息节奏，人物主体仍清晰。
- REMIX 文案轮换继续工作，Typography Mode 名称会出现在反馈中，便于判断当前文字系统。
- Undo / Redo 与 PNG 导出操作正常；PNG 返回 900 × 1200 成功反馈，浏览器控制台无 error 或 warning。
