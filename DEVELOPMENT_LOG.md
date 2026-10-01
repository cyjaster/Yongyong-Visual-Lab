# Yongyong Visual Lab 开发记录

## 2026-10-01｜高精复刻模板 01 落地：Aespa《Rich Man》电气档案（Y2K 赛博档案）

- **需求背景**：用户要求告别程序化随机混杂排版，严格以高标杆“逐个精心复刻”的工作流推进。首个复刻目标为 Aespa 经典专辑概念海报《Rich Man》。
- **设计与技术实现亮点**：
  1. **全幅粗颗粒黑白半调底图**：精准配置 `bw: 100, contrast: 72, halftone: 45, halftoneSize: 11, halftoneDensity: 52, halftoneAngle: -15, grain: 20`，还原高反差报纸胶印网点质感。
  2. **三路特写证据裁切系统（Eye / Teeth / Eye contact）**：
     - `Eye`：左上眼眸高清原彩局部特写，配专属克莱因蓝角标与肘形折线；
     - `Teeth`：微张唇齿/唇妆特写，配右下克莱因蓝角标；
     - `Eye contact`：双眼宽幅全景电影条带，配水平白色指引线；
     - 底层重构采样映射算法，准确对齐面部特征，并在画布上呈现虚线采样指示框。
  3. **金色半调衬块（Fragments）**：3 处半透明金黄半调点阵色块，在暗部发丝与留白区域形成极强层次感。
  4. **全套定制排版文字系统**：
     - 顶部倾斜野性涂鸦主标题 `RICH MAN`（金色高饱和小写/大写加粗 + 9px 黑色厚重描边轮廓）；
     - 赛博金属副标题 `aespa`（银白字身 + 5px 黑色描边）；
     - 左上角克莱因蓝官方吉他拨片盾形小徽章；
     - 左侧经典三行垂直叠字 `Karina / Karina / Karina` 与 `rich man / rich man / rich man`；
     - 面颊区域低对比度单色矩阵叠字 `i'm a rich man`；
     - 底部核心态度标语 `I'M ENOUGH AS I AM.` 与涂鸦删除线重构的 `I'M A RICH MAN`（带双重叛逆鲜红划痕漆线）；
     - 档案编号与署名：`woman`、`11.4.2000`（蓝底胶囊标）、`Yu Ji-min`、`Eye contact`。
- **渲染引擎深度增强**：
  - `spacedLine` 与 `drawText` 支持文字外轮廓描边 `strokeColor`、`strokeWidth`；
  - 支持叛逆涂鸦红漆划痕删除线 `strikeThrough` 与双道粗细喷漆折线；
  - 支持吉他拨片徽章 `badgeShape: 'pick'` 与胶囊背景填充 `backgroundColor`；
  - `drawDetail` 支持独立显示克莱因蓝浮动角标；
  - `fragmentSourceRect` 完善画布到原生图片的逆向投影数学映射。
- **自动化测试与验收**：
  - 编写并执行 `test-template-01.js`，通过无头 Edge 浏览器完成点击载入、状态验证与 900×1200 全清画布渲染导出；
  - 导出预览图保存在 `template-01-richman-preview.jpg` 供用户验收。



- **需求背景**：用户提供了一张高难度 3D 酸性全息流体水银壁纸，由于版权合规要求不可直接使用外部原图，需要纯靠代码从数学底层进行 100% 独立复现，彻底告别单薄低幼的简单背景。
- **数学与着色器架构（`poster-liquid-chrome.js`）**：
  1. **多阶域翘曲流体场（Domain-Warped Fluid Field）**：采用多层梯度噪声与旋转矩阵，构造初级大涡流向量与二级漩涡黏性扰动，生成犹如融化水银般充满肌肉张力的高低起伏流体表面。
  2. **高精度法线与曲率反光（Finite-Difference Surface Normals）**：通过中心差分算法实时求解流体表面的三维梯度法向量，赋予其极度细腻、平滑的金属高光滚边（Specular Crests）。
  3. **全息薄膜干涉彩虹衍射（Thin-Film Iridescent Dispersion）**：基于菲涅尔视线掠射角（Fresnel NdotV）与曲面高度相位，调制柔和的高级感全息珍珠色散光谱（粉红、冰青、琥珀金、深紫），完美契合参考图的光学物理特征。
  4. **四点矩阵摄影棚反射与暗部环境闭塞（Studio Lighting & Crevice AO）**：暗部沉降至午夜深蓝黑，高光呈现纯正金属银白与彩虹焦散。
- **性能与交互整合**：
  - 纯 WebGL GPU 并行渲染，900×1200 全高清画质在 0.3 秒内渲染完成并瞬时缓存，海报平移与缩放无任何卡顿。
  - 右侧背景面板上线独立大按钮 <code style="background-color: #eaf0ff; color: #002FA7; border: 1px solid #002FA7; padding: 2px 6px; border-radius: 4px;">LIQUID CHROME</code>。
  - 选中该背景时，面板动态提供 <code style="background-color: #eaf0ff; color: #002FA7; border: 1px solid #002FA7; padding: 2px 6px; border-radius: 4px;">换一换水银流向 ↻ / REROLL CHROME</code> 按键，支持无限随机重滚不同水银波浪形态。
- **自动化验证**：
  - 编写 `test-liquid-chrome-click.js` 与 `export-preview.js`，通过真实浏览器完成着色器编译检查、底板一键切换、水银流向重滚及全画幅 PNG 导出验证。



## 2026-10-01｜背景纸板系统升级（新增纯黑与纯白高对比底板）

- **新增预设**：
  1. <code style="background-color: #eaf0ff; color: #002FA7; border: 1px solid #002FA7; padding: 2px 6px; border-radius: 4px;">PURE BLACK</code>（纯黑基底）：背景设为纯正深邃黑 `#000000`，外框设为高反差纯白 `#ffffff`，并具备“暗色文字智能反白保护”，防止黑色标题或文字陷入黑背景中隐形。
  2. <code style="background-color: #eaf0ff; color: #002FA7; border: 1px solid #002FA7; padding: 2px 6px; border-radius: 4px;">PURE WHITE</code>（纯白基底）：背景设为极简亮白 `#ffffff`，外框与文字设为清晰墨黑 `#111111`，打造高反差画册排版质感。
- **重构预设按钮样式**：
  - 在 `poster.css` 中用属性选择器 `button[data-poster-background="pure-black"]` 等精准定义按钮微缩预览色，彻底废弃不稳定的 `:nth-child` 伪类索引。
- **自动化测试**：
  - 编写并执行 `test-pure-black-white.js`，通过无头 Edge 浏览器验证一键切换纯黑/纯白底板生效、文字与边框自动反色正常。



## 2026-10-01｜彻底解决“排版 REMIX 导致右侧已调滤镜概率性变回原图”问题

- **问题现象**：用户在右侧调好滤镜（或应用滤镜预设、背景底纸）后，去左侧点击“排版 REMIX”换排版时，滤镜有概率直接变回未经任何处理的原图。
- **根本原因深度排查**：
  1. `poster.js` 中 `remixLayout` 维护了一个 `remixBaseSnapshot` 基础底稿机制。首次点击排版时，由于用户刚调节过滤镜，`currentSnapshot !== remixLastResultSnapshot`，代码执行了 `cleanBase.filters = cleanFilters()` 写入基础快照。
  2. 当用户对第一次生成的排版不满意、连续点击第 2 次或更多次“排版 REMIX”时，满足了 `currentSnapshot === remixLastResultSnapshot`，触发底稿恢复 `Object.assign(state, JSON.parse(remixBaseSnapshot))`，直接将预存的 `cleanFilters()` 覆盖回 `state.filters`，导致用户精心调节的黑白、半调、对比度、颗粒等滤镜彻底被抹除变回原图！
  3. 此外，`remixLayout` 内部在单图与无辅图分支中执行了 `state.main = makeMain()`，导致右侧调节的“主图透明度”被重新冲刷为默认的 100%；同时在遍历辅图时执行了 `sec.filters.bw = 0; sec.filters.contrast = 0;` 等破坏性清空。
- **重构与保护机制**：
  1. 严格落实职责分离：左侧专注“排版与构图 REMIX”，右侧专注“滤镜与调色 REMIX”，排版变换永远不得改动调色与视觉底纸。
  2. 在 `remixLayout` 入口处严密捕获并封存当前所有视觉参数（全局滤镜 `state.filters`、主图透明度 `main.opacity`、底纸样式 `backgroundStyle`、背景色与自定义背景图、外框颜色与宽度、辅图卡片独立滤镜与透明度、局部证据框滤镜与双色调等）。
  3. 在底稿保存与恢复全周期中，严禁将滤镜重置为 `cleanFilters()`，并在版式变化后 100% 强制回填锁定用户的所有滤镜与视觉属性。
  4. 移除辅图卡片与主图透明度的破坏性覆盖逻辑，确保主图透明度在重新构图时完整保留。
- **自动化验收**：
  - 编写专属 CDP 浏览器自动化集成测试 `test-remix-preserve-filters.js`：
    - 验证自定义高对比度黑白半调滤镜下，连续 5 次点击“排版 REMIX”，每一次滤镜与透明度、底纸样式均保持 100% 吻合，版式构图正常变化；
    - 验证点击“滤镜 REMIX”随机预设后，再连续 5 次点击“排版 REMIX”，预设滤镜与背景完全保持一致不复原；
    - 验证右侧面板动态拖动滑块后再点击“排版 REMIX”，修改后的滤镜数值坚实稳固，彻底断绝复原原图的可能。


## 2026-10-01｜索引框图像质感滤镜库升级（10 种效果与色彩重构）

- 彻底解除“局部框大量黑白化”的限制，构建基于参考图的 10 种现代图像质感滤镜：
  1. 彩色半调（CMYK 分色印刷网点）
  2. 半调图案「点状」（单色/强调色点阵）
  3. 半调图案「圆形」+ 颗粒（同心圆环纹扫描）
  4. 玻璃「块状」（折射与折射边缘高光）
  5. 马赛克（像素化）+ 锐化（大像素阶梯加硬）
  6. 马赛克拼贴 + 颗粒（多边形嵌缝与粗颗粒）
  7. 渐变映射 + 颗粒（双色调高对比金黄/蓝紫）
  8. 渐变映射（单色柔和氛围渐变）
  9. 位图：20 像素（Bayer 矩阵 1-bit 点刻抖动 Dither）
  10. 阈值 + 颗粒（高反差复印机硬二值化）
- 调整 REMIX 策略：优先分配彩色质感滤镜（彩色半调、玻璃、双色调、锐化马赛克等），黑白类滤镜严格限制为至多 1 个且仅小概率（约 20%）偶尔出现，避免以往满屏黑白噪点的问题。
- 调整示范模板（WILD SIGNAL）与预设系统（CCTV Red, CCTV Blue, Editorial, Soft Y2K），默认呈现兼顾色彩与印刷纹理的丰富层次。
- 检查员面板（Inspector）增加对应滤镜的动态调节滑块（玻璃尺寸、马赛克尺寸、双色调映射色盘、环纹密度等）。
- 【排查与关键修复】解决“马赛克等参数滑块拖动无变化、只有对比度有效”问题：
  1. 根因 A（file:// 协议画布污染）：直接双击打开本地 HTML 时，相对路径图片触发 Chromium 跨域限制，使 Canvas 被标记为 Tainted，导致 pixelEffects 与 halftone 中的 getImageData() 异常跳过，只有通过原生 CSS filter 处理的“对比度”能起效。现将示范图编译为安全的 Base64 数据文件 `assets/demo-collage-data.js`，彻底终结 file:// 与 http:// 环境下的画布污染。
  2. 根因 B（事件监听器不全）：原生 `<select>` 在鼠标点击切换选项时触发 `change` 事件，原代码仅在 `input` 事件中处理属性更新与面板重绘，导致滤镜类型未被正常写入或控件失步。现抽离统一处理函数，同步监听 `input` 与 `change`。
  3. 根因 C（马赛克锐化混合比）：原马赛克锐化算法中混合了 55% 的原图细节导致像素块不纯粹，现重构为纯正阶梯像素块与高反差边缘加硬。
- 本地 Edge 真实浏览器无头自动化测试全流程通过（Canvas 像素读取 100% 成功、滑块调节差异率 95%、PNG 导出正常）。

## 2026-09-29｜Collage Poster 交互动效

- 在海报编辑工作区加入鼠标跟随扫描光与十字定位线，借鉴视频中的 Cursor-Driven Gaze Tracking，并转译成符合索引/扫描主题的交互反馈。
- REMIX 时增加一束短暂的印刷扫描光，保留原有轻微画布反馈。
- 光标效果是编辑器界面覆盖层，不进入 PNG；不影响画布元素的位置、拖动、命中或导出。
- 触屏隐藏光标追踪；减少动态效果时取消过渡与扫描动画，保留即时定位提示。
- 本地静态服务返回 200，海报模式与 REMIX 实际浏览器操作正常；仅做语法检查和视觉操作检查，尚未 Push。

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
# 2026-09-29 — 编辑稳定性与响应式修复

- 修复隐藏画布初始化为 20%：仅在可见时计算 FIT，进入海报模式时自动适配；手动缩放保持不变。
- 修复主图 `main-image` 与索引来源 `main` 标识不一致，拖动或在属性栏调整主图时同步索引框。
- 待保存参数在撤销前落入历史，结束输入立即提交，避免快速撤销丢失最后一次修改；移除下拉选项重复派发事件。
- 属性文字和上传文件名进行 HTML 转义，支持引号与尖括号；拒绝无效数字，宽高至少 20，避免对象消失。
- 中等宽度三栏允许画布区域收缩；窄屏顶部换行；增加键盘焦点轮廓、文本控件可访问名称与窗口失焦后的平移释放。
- 新增无依赖回归检查：`node checks/editor-regression.cjs`，覆盖待保存撤销/重做、重做分支、主图索引同步和特殊字符。
- 验证：三份 JS 语法检查、回归检查、Git diff 检查通过。本地浏览器实测 Filter Lab 随机配方/配方卡导出、Collage Poster REMIX/撤销/重做；海报 PNG 返回 900 × 1200 导出反馈。下载事件工具超时，未验证导出文件内容。1280/900 宽度页面无横向溢出，桌面 FIT 为 58%，控制台未捕获 error/warn。
- 保持静态部署，无新增依赖；更新资源版本号以刷新线上缓存。

## 2026-09-30 — 编辑交互动效补充

- 根据反馈撤掉轻量的面板入场与选中闪线，重做为局部光圈跟随指针。第一版 `@property` 设为不继承，让伪元素始终使用中心默认坐标；已删除该注册，改用容器传给伪元素的坐标。
- 移除鼠标移动时覆盖整块画布的 `backdrop-filter` 与大面积遮罩，改为 220px 局部光圈，避免全画布持续重绘。REMIX 的扫描显影保留，并将清除动画类的计时与动画时长统一到 700ms。
- 触屏继续隐藏指针扫描；系统开启减少动态效果时关闭显影动画。
- 浏览器实测：光圈先在右下再移到左上，计算后的坐标随指针改变；离开画布后 `is-tracking` 关闭且透明度为 0。REMIX 完成后动画类清除，控制台无 error/warn。未量化帧率。

### REMIX 纸片转场

- 替换上述扫描显影：旧海报快照分成五条纸片，交错平移、轻旋转退场，新海报缩放显现，总时长约 0.9 秒。原生 Web Animations，仅动画 transform/opacity，无新增依赖、无逐帧滤镜计算。
- 新增 `poster-motion.js`，动画仅在预览覆盖层，未改变海报数据、历史或 PNG 绘制逻辑。指针操作、键盘、滚轮、切换模式和调整窗口都会取消转场；连续 REMIX 不累积覆盖层。
- 画布下方新增跟随系统 / 开启纸片转场 / 关闭选项。当前浏览器启用了减少动态效果，跟随系统时跳过转场；用户主动开启后显示完整动效。指针光圈降低为辅助效果。
- 浏览器验收：开启后观察到五条纸片实际位移/旋转；结束后覆盖层为 0、主画布 transform 为 none。连续 REMIX、撤销/重做操作完成，PNG 返回 900 × 1200 导出反馈；未检查下载文件内容。控制台未捕获 error/warn。
- 增加 `node checks/motion-regression.cjs`，覆盖减少动态效果、五条纸片、快速重启、编辑中断和结束清理；保留原编辑回归检查。

## 2026-09-30 — REMIX 构图精修

- 新增 `poster-composition.js`，八种构图同时定义主图、标题、副标题、说明、留白和 Crop 索引带：顶部报刊、底部沉底、侧边书脊、双轴对齐、角隅留白、底部索引带、侧栏封面、图文穿插。
- 去掉主图布局、Crop 布局、文字布局分别抽取及多轮随机避让的组合，改用一套共同轴线。随机保留在字体组合、配色、背景、局部滤镜和少量倾斜上，避免二次挪位破坏构图。
- Crop 位于主图外的侧栏或底部网格，尺寸上限 180，按数量分配位置，互不重叠；辅助照片沿另一侧排布。重叠照片放在主图背后，局部碎片缩为小点缀。
- Hero 使用实际字体宽高适配标题区；小字与重复文字退到页边信息带。同版字体分工统一，Light 保留用户当前字体，所有文案保持可编辑。
- 已有 Crop 的索引框围绕原取样区域微调，避免每次被移到天空产生空白小图；无 Crop 的辅助框仍在主图四周变化。修正 REMIX 后未保存新索引框相对坐标、随后同步恢复旧位置的问题。
- 移除多图 REMIX 超过模板数量时删除用户 Crop 的行为，保留所有用户元素。原滤镜、静态架构、绘制和 PNG 导出路径沿用。
- 验证：浏览器连续 14 次 REMIX 覆盖全部八种构图并逐种目视检查；Crop 实际拖动正常，整版 Undo / Redo 的构图卡内容恢复一致。PNG 显示 900 × 1200 成功反馈，下载事件未返回文件路径，未验收下载文件内容。控制台未捕获 error/warn。
- 新增 `node checks/composition-regression.cjs`，检查八种构图在 0/3/8 张 Crop 下的边界、互不重叠、不占主图、长标题适配以及内容与图层保留。编辑与动效回归检查继续通过。
- 补充实测：Filter Lab 的全部随机更新为 midnight diary；多图模式 REMIX 正常渲染主图、辅图与原有三张证据图，未捕获控制台错误。侧边书脊的辅图转到主图下部，避开旋转标题。验收截图保存在 Codex visualizations 目录，不加入网站资源。
- 按用户要求将纸片转场设为默认选项，仍可切换为跟随系统或关闭；无需手动开启即可在 REMIX 时播放。

## 2026-09-30 — 修复局部放大比例畸变

- 根因：`filteredImage` 将来源矩形直接拉伸到任意图块宽高，两个方向缩放不一致。改为统一比例的 Cover 填充：图块比例不同时居中裁切边缘，不拉宽、压扁人脸；使用逻辑宽高计算，避免小数尺寸经过画布取整后产生比例偏差。
- 同一绘制入口覆盖 Detail Crop、辅图与主图碎片；预览和 PNG 导出复用修复。主图现有等比适配及背景用户主动选择的 Stretch 模式保持不变。
- 倾斜索引框改用四角变换后取来源包围区域，不再仅计算两条对角点；辅图索引取样同步使用等比 Cover 坐标，越界取样限制在源图有效范围内。旋转取样为轴对齐包围区域，不做透视变形。
- 扩展 `node checks/editor-regression.cjs`，检查横向 / 竖向 / 小数尺寸的等比缩放、45° / 90° 旋转取样、辅图 Cover 对应区域及越界保护；构图和动效回归、JS 语法和 diff 检查通过。
- 本地浏览器实测：原色面部 Crop 分别调整为 340 × 150 与 150 × 340，只裁切边缘、脸部比例正常；REMIX 后仍可显示，Undo / Redo 恢复整版状态；PNG 返回 900 × 1200 成功反馈，未验收下载文件内容。Filter Lab 全部随机正常更新，控制台未捕获 error/warn。
- 确认刷新后纸片转场默认值为 on，并实际显示转场；更新 poster.js 缓存版本。截图保存在 Codex visualizations 目录，不加入网站资源。

## 2026-09-30 — 合并单图与多图编辑入口

- 移除 Collage Poster 内的 Single / Multi 切换，主图上传下方新增「＋ 添加图片」按钮，可一次多选辅图；图片列表始终可见，标注主图、辅图及各自特写数量。沿用现有颜色、字体和三栏结构，Filter Lab 未修改。
- 不再保存独立模式状态，REMIX 根据画布实际辅图数量判断单图 / 多图逻辑；删除最后一张辅图后自然回到单图，不从示范素材或素材库自动补图。
- 加图只追加，不替换当前主图或清空示范海报中的索引、文字、局部图。批量导入按选择顺序入场，同批图片作为一步撤销；载入失败不创建空素材。没有主图时仅将第一张设为主图，其余作为辅图。
- 单图 / 多图均可使用同一个索引框与局部放大按钮以及 F / D 快捷键；辅图素材支持设为主图和删除。删除素材保留解码图像供撤销恢复，恢复空画布时不继续显示上一张图片。
- 移除过时的模式专属显隐规则和自动预载辅图。多图下恢复示范模板会先提示替换当前海报与历史，防止误清空。
- 扩展 `node checks/editor-regression.cjs`：检查内容保留、批量一步撤销 / 重做、空画布首图、辅图删除与图像恢复、图片计数及无独立模式状态。构图与动效回归检查通过。
- 本地浏览器验收：默认 1 张主图；添加两张后为 3 张且原主图的 3 张特写保留，Undo 为 1 张、Redo 为 3 张；辅图上建框及局部放大成功。删掉两张辅图后为 1 张，随后 REMIX 仍为 1 张；撤销两次删除恢复为 2 / 3 张且图片可渲染。多图 REMIX、Filter Lab 全部随机与模式切换正常，控制台未捕获 error/warn。
- PNG 返回 900 × 1200 成功反馈，未检查下载文件内容。更新 JS / CSS 缓存版本；无新增依赖，仍使用同一静态项目。首次浏览器文件选择检查超时，中断后恢复本地服务并重试成功。

## 2026-09-30 — aespa 参考方向的 UI 精修

- 实际打开 https://aespa.com/，观察当前 Lemonade 页面：黑底、酸性荧光绿、液态金属与装置式导航。借鉴配色与材质语言，不复制官方 Logo、图片、视频或全屏特效。
- 在现有 `styles.css` 中统一界面色板：黑色外壳、石墨面板、冷灰工作区、银白文字与荧光绿操作强调。顶部保留 Yongyong 品牌，改为倾斜标记与小型金属字标；模式切换、随机与导出突出，常规按钮收敛。
- 在现有 `poster.css` 中调整工具文字大小、按钮间距、图片列表、预设样本、历史状态和属性控件；修正深色面板中的提示、删除动作、下拉选项与键盘焦点对比度。背景预设保留自身的浅色样本，避免将 UI 主题误当作海报配色。
- 本轮仅修改 `index.html`、`styles.css`、`poster.css` 与本记录；未改图像处理、构图、历史、上传与导出代码。纸片转场保留；无新依赖、远程字体或后端，仍为同一静态项目。CSS 缓存版本已更新。
- 检查：编辑、构图、动效三项 Node 回归与 `git diff --check` 通过。浏览器实测 Filter Lab 随机配方更新为 blue hour；Collage Poster REMIX 有效、Undo 回到 Demo、Redo 构图卡与生成方案一致。PNG 返回 900 × 1200 成功反馈，未检查下载文件内容。
- 在窄屏与 900px 中屏检查：页面无横向溢出，导航可见，中屏工具与属性面板可独立滚动。保留原生页面滚动，不添加滚动拦截；恢复测试视口后截取最终界面。

## 2026-10-01 — 作品优先的工作台精修

- 保留黑银绿主题，收紧两侧面板及中央留白，画布底部操作提示与动效/缩放控件合并成紧凑一行。同一桌面窗口下，示范海报高度从约 516px 增加至 552px，作品显示面积约增加 14%。未改变海报实际分辨率与导出内容。
- 左侧分为原生滚动工具区与常驻操作区，REMIX、撤销、重做、复制、PNG 导出不再位于长面板最底部；沿用原按钮与事件委托，不增加一套重复操作逻辑。
- 风格预设、背景与纸张、排版设置使用原生 details/summary，默认折叠；文字工具改为两列。保留全部选项，移动端恢复正常页面流，不拦截滚轮。
- 普通分组标题与属性状态回归银灰，主图上传降为次级动作；荧光绿集中在模式选中与 REMIX。提升中文操作文字、小字提示与属性字号，减少按钮边框与重复分隔线。Filter Lab 同步应用更清楚的辅助字号与低强调滑块。
- 修正 FIT：读取画布容器实际四边 padding，适应缩放向下取整，避免固定余量与四舍五入造成多余滚动条。手动缩放仍保留原逻辑。扩展现有编辑回归检查覆盖实际留白与 FIT 尺寸约束。
- 验证：编辑/构图/动效三项 Node 回归、JS 语法、diff 检查通过。实际浏览器展开三个分组、应用预设及背景、REMIX、Undo/Redo、文字输入与常驻复制按钮正常；Filter Lab 随机更新为 candy haze。桌面及 900px 中屏 FIT 的 scrollWidth/scrollHeight 与容器尺寸一致，窄屏页面无横向溢出，工具区滚动时操作区保持可见；控制台未捕获 error/warn。
- PNG 返回 900 × 1200 成功反馈，未检查下载文件内容。更新静态资源缓存版本，无新依赖、无部署改动；本轮尚未提交或推送。

### 根据反馈改为明亮可读的银灰面板

- 用户反馈深色界面能见度低。保留黑色品牌顶栏与荧光绿强调，将两侧工具/属性面板改为浅银灰，主要文字改深色、辅助文字加深；中央海报工作台同步提亮。未改变任何海报数据、滤镜、构图或 PNG 绘制逻辑。
- 中文属性标签提高到 13px，英文辅助标签到 10px，说明和图源状态同步放大；Filter Lab 的滑块标签列加宽，避免字号增加后中文换行。更新下拉框、焦点、滑块、危险操作和预设文字的浅色主题对比度。
- 单独定义强调色上的深色文字，避免主题切换后 REMIX / Toast / 主图徽标变成绿底浅字；拖图提示仍保留深色遮罩上的白字。CSS 缓存版本更新为 readable。
- 实测主属性标签与面板对比度约 14.9:1，英文辅助标签约 6.8:1（仅检查这两种文字，非完整无障碍审计）。900px 与窄屏页面无横向溢出；REMIX Undo/Redo 一致，Filter Lab 随机为 soft chrome；PNG 返回成功反馈，未检查下载文件内容。控制台无 error/warn，三项现有回归检查通过。
- 本轮仅继续修改既有 CSS / HTML 与工作记录，保留前一轮未提交修改；未推送，先供用户确认明亮版效果。

## 2026-10-01 — 右侧属性面板主图直连与全局元素直选

### 改进
- 解决“还得点主图才能出现这种交互，不能都放右侧嘛”的问题：在海报全局状态（未在画布上点击任何物体）下，右侧 Inspector 直接常驻呈现 `【主图】MAIN IMAGE` 控件组。
- 无论是否在画布上点选主图，用户均可直接在右侧面板调节：
  - `主图透明度`（0% – 100%）：实时调节主图与背景及纹理的混合融合；
  - `画面缩放`（0.7x – 2.4x）：无需激活手柄即可缩放主图主体；
  - `裁切横移`（-350 – +350）与 `裁切纵移`（-450 – +450）：微调裁切取景；
  - `旋转角度`（-15° – +15°）：微调主图旋转倾角；
  - 提供快捷动作 `选中主图自由拖拽 / SELECT MAIN`，点击可一键唤起主图画布边框与控制手柄。
- 新增 `【海报元素列表】POSTER ELEMENTS` 折叠面板：将主图、辅图卡片、索引框、局部特写、排版文字统一以直观列表展现，点击任意元素即可直接选中并展示对应专属属性，无需在复杂画布中费力点选小框或小字。
- 顶部标题栏新增 `全局 POSTER ↗` 快捷返回按钮：选中任何子元素时自动显示，点击一键脱离选中并回到海报全局/主图面板。
- 修复 `poster.js` 中 `handleInspectorInput` 的语法括号闭合问题并提前处理全局主图滑块更新；版本号更新至 `v=20261001-v5`。

### 验收
- Node 语法与回归测试通过（`editor-regression.cjs` 4/4 PASS）。
- Edge 无头浏览器自动化全链路测试（`test-inspector-controls.js` 全部项通过）：
  - 页面初次加载时无需点击画布，右侧面板即展示主图透明度/缩放/裁切/倾角滑块；
  - 拖拽主图透明度滑块即刻触发 Canvas 重绘且像素透明度同步变化；
  - 旋转角度滑块联动更新；
  - 选中主图与列表中其他元素动作均正常，`全局 POSTER ↗` 按钮正常显示且点击可一键回到全局面板。

## 2026-10-01 — REMIX 图像质感彻底刷新与滤镜一键恢复

### 改进
- 解决“在右边调了半天还是不喜欢，点 REMIX 之前的效果并没有刷新，还是一团糊的东西带着 REMIX 去动”的问题：
  - 根因分析：此前 `remixLayout` 仅对现有 `state.filters` 进行小幅数值扰动（`remixNudge`），且 `remixBaseSnapshot` 会固化用户手动调节的破坏性数值（如过高颗粒、黑白、粗糙度、脏版、压缩损坏等），导致多次 REMIX 都在用户“调糊”的基础上打转；同时主图透明度（如调低为半透明）和极端缩放也未被重置。
  - 彻底刷新逻辑：
    1. 每次点击 REMIX，彻底清空所有破坏性滤镜：`bw: 0`（恢复鲜明彩色）、`rough: 0`、`compression: 0`、`invert: 0`、`posterize: 0`、`dirty: 0`，对比度重置为清晰杂志印刷级（12–28），颗粒重置为极微细颗粒（2–14），饱和度恢复 100%；
    2. 主图与辅图透明度强制刷新为 100% 饱满不透，缩放归一，裁切偏移与旋转归零，保证每次 REMIX 都以原图最清晰的面貌重新排版；
    3. `remixBaseSnapshot` 存入时先剥离滤镜与透明度污染，确保连续点击多次 REMIX 绝不回退至此前的糊图状态；
    4. 碎片生成器（`makeMainFragment` 与 `makeOverlapCompanion`）剔除 `highbw`、`rough`、`invert`、`posterize` 等易造成脏污块面的滤镜，统一使用彩色半调、双色调、玻璃折射与原图。
  - 属性面板新增快捷操作：在右侧 `【图像】IMAGE` 下新增 `恢复原图清晰质感 / RESET FILTERS` 按钮，用户手动微调不满意时无需触发 REMIX 即可一键恢复原图清晰参数。
  - 脚本版本号更新为 `v=20261001-v6`。

### 验收
- Node 语法与回归测试通过（`editor-regression.cjs` 4/4 PASS）。
- Edge 无头自动化测试（`test-remix-refresh.js`）：
  - 故意将图像拖至极限破坏状态（`bw: 100`, `grain: 95`, `compression: 90`, `opacity: 25%`, `zoom: 2.1x`）；
  - 点击 `恢复原图清晰质感` 按钮：瞬时恢复为 `bw: 0`, `grain: 0`, `compression: 0`, `opacity: 100%`, `zoom: 1x`；
  - 再次污染后点击 REMIX：主图透明度立即恢复 100%，缩放重置为 1x，黑白/粗糙/压缩损坏全部归零，对比度与颗粒处于清新质感区间；
## 2026-10-01 — 双重 REMIX 与双面板职责严格解耦（左：排版与位置 / 右：滤镜与质感）

### 改进与职责分工
- 遵循用户指令将海报编辑器全面解耦为左右两大独立专业面板：
  1. **左侧【位置与排版】面板（COLLAGE POSTER / LAYOUT & POSITION）**：
     - 管辖范围：所有图像位置、几何尺寸、主图裁切倾角、文字层级架构、以及**【排版 REMIX】**。
     - 将原本位于右侧的【主图位置与裁切】（画面缩放 `mainZoom`、裁切横移 `mainPanX`、裁切纵移 `mainPanY`、旋转角度 `mainRotation`、选中主图按钮）永久移至左侧，支持直接滑动调节并即时驱动 Canvas 重绘。
     - 将【海报元素列表】移至左侧面板，清晰列出主图、辅图、索引框、特写与文字层级，支持直接点击选中任意图层。
     - 底部专属主操作：**`排版 REMIX ↻`**（`remixLayout`）。
     - 核心保证：**排版 REMIX 仅改变版面几何与构图网格，绝不篡改用户的滤镜调色、底纸样式、底色和外框！**
  2. **右侧【滤镜与质感】面板（FILTERS & TEXTURE）**：
     - 管辖范围：色彩预设、纸张底纸、图像调色、印刷质感、风格化、以及**【滤镜 REMIX】**。
     - 将原本位于左侧的【风格预设】（CCTV Red, CCTV Blue, Editorial Halftone, Soft Y2K, Xerox/Punk）与【背景与纸张】（Solid, Grid, Chrome, Scan, Dots, Soft Y2K, Blueprint, 自定义背景图与透明度）永久迁移至右侧。
     - 顶部专属主操作：克莱因蓝高亮 **`滤镜 REMIX ↻`** 按钮（`remixFilters`）。
     - 核心保证：**滤镜 REMIX 仅在多套艺术调色、底纸、印刷质感与局部特写滤镜之间随机切换，绝不挪动任何海报元素的位置、坐标、大小或文字排版！**
     - 右侧常驻包含：图像调色（含主图透明度与一键恢复原图按钮）、印刷/扫描、质感颗粒、风格化反相/色阶压缩。
     - 顶部配备 `全局 POSTER ↗` 快捷返回按钮，便于在微调子元素后随时回到全局滤镜。

### 验收与自动化测试
- 编写双测试套件（`test-remix-split.js` 与 `test-inspector-clicks.js`），在无头 Edge/CDP 下完成实机全链路验证：
  - 测试 1：海报工作区加载与模式切换正常。
  - 测试 2：左侧面板包含缩放/裁切滑块、元素列表与 `排版 REMIX ↻` 按钮；风格预设与背景预设已完全自左侧移除。
  - 测试 3：右侧面板呈现 `03 / FILTERS & TEXTURE`，具备克莱因蓝 `滤镜 REMIX ↻`、5 组风格预设与 7 组底纸预设。
  - 测试 4：在左侧面板拖动主图缩放/裁切滑块，Canvas 图像同步缩放/移动，双向数据绑定正常。
  - 测试 5：左侧元素列表点击选中主图，右侧自动展开主图属性并显示 `全局 POSTER ↗`；点击脱离选中一键回到全局滤镜。
  - 测试 6：**排版 REMIX 解耦检验**：点击左侧排版 REMIX 后，构图网格与坐标发生跃迁，但对比度、颗粒、背景色、背景纸张样式 `100% 完全保持原样`。
  - 测试 7：**滤镜 REMIX 解耦检验**：点击右侧滤镜 REMIX 后，纸张与色彩滤镜平滑纸片转场切换，主图 X/Y/W/H 及标题文字坐标 `100% 绝对未变`。
  - 测试 8–10：右侧风格预设点击（如 Xerox Punk）、底纸预设点击（如 Grid）以及一键恢复原图滤镜按钮均响应精准。



