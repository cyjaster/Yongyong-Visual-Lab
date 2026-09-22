# Yongyong Visual Lab — Demo 01

一个本地运行的滤镜配方卡生成器：上传照片、叠加纯色色层、套用调色灵感、调整错落排版、更换背景、保存 JSON 配方，并按多种比例与分辨率导出配方卡。

## Demo 02：Collage Poster（索引式拼贴海报）

顶部现在有两个不刷新页面的模式：`01 Filter Lab` 保留原有配方卡功能，`02 Collage Poster` 是新增的索引式拼贴海报工作区。它同样是纯前端 Canvas 实现，适合直接双击打开或部署到 GitHub Pages。

Collage Poster 初次进入会自动载入 `assets/demo-collage.jpg` 和一套完整的 `WILD SIGNAL` 示范版式，包含脸、手、花三组索引与局部放大。编辑后可用左栏“恢复示范模板”一键回到初始状态。

最短工作流：

1. 切到 `Collage Poster`，上传主图。
2. 添加索引框，拖动或拖右下角手柄调整取景；在右侧修改框线、标签和标签色。
3. 选中索引框后点击“由此框生成局部放大”。裁图会保持与原框的关系，移动局部图时连接线会自动跟随。
4. 添加主标题、副标题、小字说明或重复文字；选中后在右侧调整字体、字重、字距、行距、颜色、透明度与旋转。
5. 选中不同局部图，分别使用 Original、黑白、高对比黑白、半调、颗粒、轮廓、反相或色阶压缩；每张 Crop 的参数彼此独立。
6. 通过右栏全局滤镜调整半调网点、扫描纹、纸张、脏版与压缩质感，或直接应用 CCTV Red、CCTV Blue、Halftone Editorial、Soft Y2K、XEROX / PUNK。
7. 使用图层按钮控制 Frame、Crop、Text 与 Connector 的遮挡关系；可用 `Ctrl+D` 复制、`Delete` 删除、`Ctrl+Z` 撤销、`Ctrl+Shift+Z` 重做。
8. 在左栏选择 Light / Medium / Wild、Balanced / Experimental 后点击“随机排版 / REMIX”。系统会先选视觉锚点、再按混乱预算重新组织 Crop、Frame、Typography、Connector、图层和轻量风格参数；一次 REMIX 可用一次 `Ctrl+Z` 完整撤销。
9. 点击“导出海报 PNG”。导出为画布真实尺寸 900 × 1200 PNG，包含文字、外框、索引框、局部图和连接线；编辑视图 Zoom 不影响导出像素。

编辑视图支持 `− / + / 100% / FIT`，也可以按住 `Ctrl / Cmd` 滚动鼠标滚轮缩放；按住 Space 拖动可平移视图。缩放只影响工作区显示，不改变最终 PNG 尺寸。

右侧 Inspector 会按当前对象显示折叠属性组。文字对象支持横向/纵向缩放、激进字距、纵排、越界、图层前后排序；Repeat Text 支持双轴错位和逐次旋转，Micro Text 提供默认的数据索引样式。Frame 还支持虚线、透明度和 Corner Frame。

REMIX 不是无约束洗牌。每次会先从 Main Image Stable、Hero Title Stable、Detail Crop Stable、Quiet Space Stable 四种 Anchor Mode 中选择一个稳定核心，再从 15 套编辑型构图系统中选择骨架。Main、Hero、Crop、Frame、Fragment、Tertiary Type 与 Texture 会分别获得 Stable / Medium / Wild 混乱预算；锚点只允许轻微变化，重复字、微型字与噪点承担更活跃的节奏。Balanced 默认采用约 70% 清晰秩序与 30% 错位张力，Experimental 才开放更强的越界与实验骨架。

生成完成后还会执行可读性修复：主图与标题不会同时被强烈破坏，主图稳定时会清空碎片并为人物主体保留安全区；局部图稳定时会把一张 Crop 放大并保持清晰；留白稳定时会把主图与文字移出指定安静区域。强滤镜被限制为少数局部，Repeat / Micro Text 固定处于主图和主角层下方，避免所有元素同时争夺第一视线。

Index Frame 也会参与 REMIX，而不再只是被动跟随主图。每轮会保留一个稳定索引框，其余框依据原取景位置进行受控的方向偏移、缩放与旋转；移动幅度随 Light / Medium / Wild 和 Balanced / Experimental 改变。框仍限制在主图有效区域内，互相重叠过高时会自动错开，对应 Detail Crop 会立即改用新的框选内容，Connector 与标签关系保持不变。

Frame 的变化现在采用区域轮换，而不是只在脸部附近抖动。内置 Head / Sleeve / Garment、Hair / Hand / Lower、Shoulder / Face / Texture、Left Edge / Flower / Sleeve、Upper / Center / Hem、Cross Body 六组索引区域，每次 REMIX 排除上一组并重新分配取景重心。只有 Detail Crop 本身成为视觉锚点时，其对应 Frame 才保持低变化。

Detail Crop 同时按视觉角色分工。每轮从 Original、B&W、High Contrast、Halftone、Outline、Rough，以及 Experimental 下的 Posterize / Invert 中抽取互不重复的 Crop Profile，并配合横向、纵向、方形等不同图块比例。Balanced 默认可保留两个差异化强处理，Experimental 最多三个；全局滤镜很强时仍只保留一个强 Crop，避免重新回到全面混乱。

Index Frame 默认以“外围微型索引网”呈现：Light 约 5 个、Balanced / Medium 约 6 个、Experimental / Wild 最多 7 个。原有 Frame 会缩小并分配到主图四角、左右边缘和下缘；新增的 TRACE / AREA / SCAN / ID 小框只作为辅助索引，不强制生成 Detail Crop。若用户从辅助框手动生成 Crop，该框会自动转为普通可编辑 Frame，后续 REMIX 不会删除它。

默认开启的 `Shuffle Copy` 会从 14 组海报文案系统中同步替换 Hero、Subtitle、Caption、Micro 和 Repeated Text，例如 Signal Lost、Soft Evidence、After Image、Copy / Scan、Proof of Life、Beautiful Damage。关闭开关后，REMIX 会严格保留当前文字内容。连续点击始终从同一份基准版生成平行方案，不再把颗粒、半调、旋转等效果逐次叠加；手动编辑或应用预设后，当前版会自动成为下一组 REMIX 的新基准。

主图现在也是 REMIX 对象，而不是固定底图。系统会在 Full Base、Tight Crop、Offset Base、Floating Base + 1、Full Base + 2、Fragmented Base 六种主图模式中选择，并随机改变主图位置、尺寸、裁切缩放、裁切偏移和最多 ±4° 的旋转。Offset Base 内部还会选择 Left、Right 或 Low 三种重心。Fragmented Base 会把主图本身分成三条带有间隙和横向错位的图像带，再叠加独立 Fragment。新的锚点规则会把大 Fragment 限制为 Balanced 最多 1 个、Experimental 最多 2 个；当主图本身是锚点时不生成 Fragment。

Main Fragment 与索引系统的 Detail Crop 是两类独立对象：Fragment 是无连接线的主图切片，用于错位、重复、放大和局部风格化；Detail Crop 仍然由 Index Frame 产生并保留连接关系。主图与 Fragment 都能在画布中直接选择，右侧可继续调整位置、尺寸、旋转、Crop、滤镜、透明度和图层顺序，并会完整进入 Undo / Redo 与 PNG 导出。

新增文件的职责：

- `mode-switcher.js`：两种模式的无刷新显示切换。
- `poster.js`：海报编辑器的数据状态、Canvas 渲染、指针拖拽、局部裁切、像素滤镜和 PNG 导出。
- `poster.css`：三栏编辑器布局与响应式样式；原 `styles.css` 只增加顶部模式切换样式。

## 打开方法

直接双击 `index.html` 即可。照片处理与导出都发生在浏览器本地，不会上传到网络。

默认预设照片保存在 `assets/demo-karina.jpg`，不是网页程序生成图；点击“更换照片”后可换成自己的图片。

如果浏览器限制了本地文件的剪贴板权限，可以在此文件夹打开 PowerShell，用电脑上已有的 Python 运行：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

本机目前没有把 `python` 命令加入 PATH，但不影响直接双击使用。Codex 测试时使用的是其自带 Python 运行环境。

## 读代码的推荐顺序

1. `index.html`：先看页面有哪些区域和按钮。
2. `styles.css`：搜索某个 class，观察它如何控制布局与视觉。
3. `app.js`：按文件顶部标出的 `STATE → RENDER → EVENTS → EXPORT` 顺序阅读。

### 需要先理解的四个概念

- **state**：当前滤镜名称、照片和图层数组，是网页的“数据真相”。
- **renderPreview()**：把 state 重新画进预览 Canvas。
- **globalCompositeOperation**：Canvas 的混合模式，对应 Photoshop 的 Soft Light、Color Dodge 等。
- **事件监听器**：用户移动滑杆或换颜色时，先修改 state，再触发重新绘制。

## 当前 Demo 的边界

- 浏览器 Canvas 与 Photoshop / ibisPaint 的色彩管理并不完全相同，视觉会接近，但不能保证像素级一致。
- 照片内容与照片框位置是两套独立控制：前者负责裁切，后者负责错落排版。
- 背景支持 8 种预设（波点、渐变、棋盘、方格纸等）、自定义纯色和本地背景图片。
- Collage Poster 的海报纸层新增 Solid、Index Grid、Chrome、Scan Paper、Dot Matrix、Soft Y2K、Blue Print 七种程序化背景；它们不依赖外部图片，静态部署和 PNG 导出均可保留。
- Collage Poster 也支持上传本地背景图，并可在 Inspector 中调整透明度以及 Cover / Contain / Stretch 填充方式；图片只保存在当前浏览器会话内，不会上传到网络。
- REMIX 会根据 Visual Anchor、构图模板与强度选择相匹配的背景纸层，并避免连续重复同一背景；Light 使用克制背景池，Medium / Wild 才开放更强的 Scan、Dot Matrix、Blueprint 与 Chrome 变化。
- REMIX 的主图以稳定版心为优先：位置与尺寸变化收紧，构图张力主要来自 1–4° 的轻微倾斜，以及部分方案中位于主图背后的完整重叠副片；副片与 Detail Crop 分属不同语义。
- Typography REMIX 使用 Bottom Lock、Top Editorial、Side Spine、Split Axis、Image Overlap、Quiet Corner 六种整组排版骨架；主标题、副标题、说明、小字与重复文字共享轴线，不再各自随机散落。
- 画布支持 3:4、1:1、2:3、16:9；每种比例都有对应的社媒与 1K—4K PNG 尺寸。
- 原图、效果图、图层面板和箭头可分别移动，也可以随机排版或将原图/效果图上下对调。
- 图层区提供 Bloom、相机色彩灵感和参考图配方；应用后仍是普通图层，可以继续改颜色、混合模式和透明度。
- 整卡氛围滤镜支持运动模糊方向/强度与杂色强度/颗粒大小，最终覆盖背景、照片、文字、箭头和图层面板；运动模糊采用 0–10、步进 0.1 的细调量程。
- “版面占比”会从中心同时缩放原图与效果图的框体；“内容缩放”只改变照片在框内的裁切。
- 页面每次打开会从安全范围内随机生成一套错落排版；“恢复默认位置”可回到规整布局。
- 右侧设置按标题、背景、照片、排版、画布、调色、整卡氛围和颜色图层分组折叠；“全部随机”会同时抽取标题、背景、比例、配色、氛围效果与拼贴位置。
- 相机命名预设只是用纯色色层模拟色彩方向，不等同相机原生 Picture Style 或 Film Simulation。
- 暂未加入 Grain、Bloom Blur、曲线和 Gradient Map 等效果。

`CODE_WALKTHROUGH.md` 目前仍是第一版导读，已标记暂停；待新版配方卡排版确认后再重写。
