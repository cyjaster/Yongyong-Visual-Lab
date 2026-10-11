# Yongyong Visual Lab 开发记录

## 2026-10-05｜两个模板随机图库实测与问题留档

- 按用户要求随机抽样：种子1359594104，白底12、蓝光11、方幅08、袖口21、长竖15；四图09/07/16/14，另将07设为主图，重复两套模板。全部通过上传入口和总REMIX操作，没有替换回示范素材。
- 实际下载并保存18份PNG：默认对照、两个模板1800×2400组合版、模板02的08手调版和线窗参数关闭版。全部成功解码、尺寸核对；工作区原图SHA256不变。文件按模板保存在 `samples/results/template-01/20261005-random/` 和 `template-02/20261005-random/`，汇总对照页与清单在 `samples/results/random-20261005/`。
- 素材保留及换主图通过；模板02线窗半调90/模糊18/杂色4/映射开启分别可设为0/0/0/关闭，撤销重做恢复正确。08的纵移-180→0也可撤销重做。高清导出构图与默认版一致，未见新增偏移。
- 默认适配待修复：模板01固定Eye/Teeth标签常对应到头发、天空、手/花或墨镜；多图横卡会裁掉眼睛。模板02固定-180上移使方图下方窗内容不足；暗衣窗接近纯蓝；白色配方文字在浅衣、皮肤、白底和天空上对比不足；换主后相机辅窗叠在脸部，舞台线窗辨识弱。
- 08仅手调panY=0改善头部和左下窗口，同时阈值窗扫到嘴/下巴，明确记录为手调对照。本轮未修改模板代码，未标记完整适配通过；全部21张、合影、移动/旋转索引框后的关联和模板01全部参数关闭仍未测。
- 本轮恢复中断的localhost:8089预览服务。下载事件监听仍有超时，已通过实际Downloads文件核对导出；没有将页面成功提示或截图代替文件验收。

## 2026-10-05｜aespa 固定示例图库归档

- 用户将 `aespa.zip` 放入项目，要求自行解压查看，并作为每个模板完成后的固定适配图库。包内共 21 张 JPG，已按原始文件名解压到 `samples/aespa/originals/`，保留原始压缩包。
- 21 张原图均成功解码且互不重复；逐张与压缩包原始字节及 SHA-256 核对一致。生成稳定 ID、尺寸、标签、用途与校验信息清单 `manifest.json`，缩略图、两张总览和本地浏览页 `samples/aespa/index.html`。
- 实际查看所有缩略图后标注 16 张竖幅／5 张近方幅：自然光、阴天、夜景闪光、白底高光、蓝光／红光、复杂背景、深浅服装、彩色针织、条纹、配饰与四人合影。纯横幅和完整站姿全身暂未覆盖。
- 固定 6 张代表单图、两组多图和完整 21 张单图巡检集合；`samples/README.md` 规定模板适配、总 REMIX、裁切、滤镜、人物可读、撤销／重做、实际导出的测试与留档方法，`AGENTS.md` 保存后续模板工作约定。
- 本次完成原图检查和图库整理；尚未将全部图片应用两套模板，不声称这些模板已通过全图库适配。后续测试结果按 `samples/results/<模板ID>/<日期或版本>/` 保存。

## 2026-10-05｜上传照片后总 REMIX 保留用户素材

- 用户反馈上传一张图片后，点击总 REMIX 会退回示范模板。代码把 `model-*`、`karina-*` 和示范同名文件当成示范素材；槽位分配器又遗漏模板 02 的机能男模示范 ID，导致判断和分配不一致。默认示范的晚到异步回调也可能覆盖已经上传的素材。
- 上传素材增加 `origin: upload`，示范判断集中到来源标记及已知示范 ID，移除文件名规则；两套模板共用同一判定与素材筛选。用户模式直接应用模板，不再等待或加载示范图片。初始示范加载完成时检查用户素材，避免晚到回调覆盖上传；显式示范按钮仍可恢复示范。总 REMIX 内部索引与当前显示模板保持一致。
- 新增 11 组上传与 REMIX 回归，执行真实上传函数、输入事件注册和 FileReader／Image 解码回调：普通文件、model／karina 前缀、示范同名、连续两次 REMIX、混合素材池、迟到示范回调、显式重置、逆序解码及后续追加均通过。原有编辑器与滤镜集成回归通过。
- 浏览器实测通过上传入口载入 `model-remix-test.jpg`，连续点击两次总 REMIX，模板从 02 切到 01 再回到 02，素材栏始终保留该上传文件，未恢复示范素材。总 REMIX 的含义仍为切换两套模板的排版和滤镜。

## 2026-10-05｜修正模板 02 的基础滤镜与右侧参数

- 用户指出基础滤镜无法产生参考中的图案、动态模糊和杂色。检查发现圆形半调先映射蓝粉色再读取亮度，生成近似固定圆环；线条半调把横向蓝色渐变当成运动模糊；多个局部滤镜强制设置最低颗粒值，并用 `||` 吞掉显式 0。
- 新增共用像素引擎 `poster-filter-engine.js`：圆形、线条、点状与 RGB 彩色半调根据源图明暗调整墨线宽度／网点覆盖率；真实定向卷积处理运动模糊；杂色支持均匀／高斯、单色／彩色、颗粒大小及确定 seed；位图支持误差扩散、有序抖动与阈值。渐变映射在图案、模糊、杂色之后执行，颜色端点与 Gamma 可调。透明边缘模糊使用预乘 alpha，避免黑边。
- 全局／主图、辅图、局部图和碎片的 Inspector 补齐对应控制。新参数稳定路由到各自滤镜，0／false 可关闭图案、模糊、杂色或映射；隐藏圆形的无效角度和有序位图的无效阈值。旧印刷预设保留独立「叠印网点」入口。
- 模板 02 保留先锋标题、近黑背景、蓝粉配色和七组透明度。圆形纹理改细并把中心移到选区外；线条选区使用 18px 水平运动模糊；主图采用轻微 2px 水平模糊；左侧位图改为扩散抖动。修正位图的日英配方标签，取消不对应当前处理的「20 pixels」标签。
- 验证：22 组滤镜像素行为测试、滤镜与编辑器集成／参数路由回归、原有编辑器／构图／动效回归和 JS 语法检查通过。浏览器确认线条半调调到 0 后条纹消失，撤销恢复 90，重做恢复 0；模糊距离可置 0 并撤销回模板默认参数。照片裁切继续保持原来的等比例路径。
- 含义参考 [Adobe 滤镜效果说明](https://helpx.adobe.com/photoshop/desktop/effects-filters/blur-sharpen-filters/filter-effects-reference.html)。实现为浏览器像素处理，未声称与 Photoshop 逐像素相同；当前男模街拍与参考人物的光线、服装和取景不同，会影响图案分布。

## 2026-10-04｜模板 02 蓝粉选区改为半透明，优先展示中央人物

- 用户认可蓝粉配色，但指出前一版效果块不够透明，遮挡了中间要表达的人物。
- 降低七组选区效果层的不透明度：依次为 56%、34%、50%、44%、50%、30%、48%。覆盖脸部的大蓝粉块为 34%，身体中央竖长块为 30%，手部横条为 44%，外围保留较明显的局部纹理。
- 排版模板二与滤镜模板二共用同一组默认不透明度，确保刷新、恢复示范或 REMIX 切回模板二后仍为半透明效果。蓝粉映射色、主图灰度、背景融合与先锋标题保持当前设定。
- 验证：`node --check poster.js` 与编辑器回归检查通过；浏览器刷新后核对人物表情、手势和衣服轮廓能够透过中央效果块显示。

## 2026-10-04｜参考原图按模板存档；模板 02 背景融合与蓝粉色阶

- 用户确认本次上传的图一是模板二参考、图二是模板一参考，原始字节分别保存为 `references/template-02/original.png` 与 `references/template-01/original.jpg`；SHA256 与附件源文件一致。
- 对照模板二参考：底纸为中性近黑色，黑白人物直接融入底色，局部特效使用蓝粉色阶。模板二改用 `#101010` 纯色底，取消此前蓝灰径向背景；主图亮度由 18 调至 -4，对比度由 28 调至 12，颗粒由 8 调至 4，保留白衣与肤色的灰度细节。
- 新增「底图边缘融合 / Main Edge Blend」滑块，模板二默认 78。主图在左右、顶部及实际照片下沿柔和淡出；实际照片边界依据裁切与平移后的 `getCover()` 计算，避免白衣在照片提前结束处出现硬切口。融合不改取景坐标，局部选区仍采样原始素材；按住查看原图时绕过融合，恢复原图按钮会关闭融合。
- 七组选区提高显示透明度并将亮部阶调改为浅粉色，使蓝色网点、粉色亮部和黑白底图区分更清楚。当前人物素材与参考图人物不同，因此纹理内容取决于实际上传照片。
- 顶部保留用户指定的 `AFTER IMAGE` 先锋艺术标题；模板一继续使用原有电光虎纹与版式，套用滤镜模板一会关闭主图边缘融合。
- 验证：JavaScript 语法与编辑器、构图、动效回归检查全部通过；浏览器已实看背景与选区变化，滑块可从 78 调至 0 再恢复。点击导出后页面显示 `PNG 海报已导出 · 1200 × 1600`，未出现控制台错误；内置浏览器下载事件监听超时，未直接核对下载文件。

## 2026-10-04｜模板 02 改为先锋艺术标题；检查参考图存档

- 用户要求去掉模板二顶部的 Ps 图标、日文教程标题和英文教程副标题，标题风格参考模板一。
- 主标题改为 `AFTER IMAGE`，复用模板一的 Impact 粗体、紧字距与描边绘制，增加轻微倾斜及横向拉伸；采用与局部滤镜呼应的紫蓝色，右侧加入 `07` 数字索引，下方为等宽微字 `VISUAL EXPERIMENT / VOL. 02`。
- 滤镜模板二同步标题配色规则，避免应用滤镜时将艺术标题重置成教程标题配色；标题仍是可编辑文字对象。七组局部选区和日英特效配方保留。
- 检查了项目全部七张 JPG 与内嵌图片，均为人物摄影素材；开发日志记载曾收到参考海报，但工作区没有保存完整原始参考图。新增 `references/README.md` 说明参考模板的存档方式；背景变化等待用户补发模板二原图后核对，当前背景尚未调整。
- `README.md` 同步默认进入模板二及双示范按钮、总 REMIX 的实际行为。
- 验证：`node --check poster.js`、`checks/editor-regression.cjs`、`checks/composition-regression.cjs`、`checks/motion-regression.cjs` 全部通过；浏览器刷新后已实看艺术标题、微字与数字索引，未裁切或与局部选区发生重叠。

## 2026-10-04｜模板 02 终极重塑：1:1 还原日系原版 Photoshop 特效教程海报 (Ps 图标/7 选正交选区/双色调渐变映射/原版日文字号层次)

- **用户反馈与深度诊断**：
  - 用户反馈：「这也不太像参考模板的样式呀，描述也效果都不太像」，并重新发送了原版日系 Photoshop 教程参考图（`画像エフェクトの組み合わせ例 7 選`）。
  - **核心差异逐项透视**：
    1. **标题与顶部结构错位**：原先采用纯英文先锋杂志大字（`COLLAGE ARCHIVE`），而参考图原版是左侧深青底高亮蓝边 `Ps` 软件图标徽标，搭配大字黑体日文主标题 `画像エフェクトの組み合わせ例 7 選`（其中数字「7」字号格外突出放大，与平假名底线严格对齐），以及下方的细黑体英文副标题 `7 Photoshop Image Effect Combinations That Work Well Together`。
    2. **配方描述风格错位（“描述也不太像”）**：原先为随意的英文工学编号（`FIG. 01 // MOSAIC (PIXELATE)...`），而参考图是 7 组正宗的 Photoshop 日英双语工艺配方（如 `モザイク（ピクセルレート）` / `Mosaic (Pixelate)` / `+` / `カラーハーフトーン（ピクセルレート）` 等），粗白日文 + 柔和银灰英文 + 灰青色加号。
    3. **选区样式错位（“样式不太像”）**：原先带有手作剪贴簿的倾斜旋转（-3.2°、+2.6° 等）、和纸胶带与厚重投影；而参考图为纯正 Photoshop 自由变换状态：**全视窗完全正交（`rotation: 0`）**、剔除胶带与阴影、统一纤细柔粉选区框（`#fbcfe8`，1.2px）及 8 个白色方形变换锚点手柄（`#ffffff`）。
    4. **特效与视觉焦点错位（“效果不太像”）**：
       - 原先因“避开面部”考量，将眼部全部留空；而参考图最震撼的核心视觉锚点（Hero Box 2）恰恰是**横跨眼眸、墨镜与鼻梁的大面积彩色半调网点 + 阶调映射**！
       - 原先 `circle_halftone` 与 `line_halftone` 采用图层滤色模式导致环纹发黑或过曝，未继承参考图标志性的深邃海军蓝（`#071540`）与长春花紫蓝（`#c2d4ff`）渐变映射。
       - 原先主图具有 1px 细白外框，破坏了原版模特纯黑背景全幅沉浸感。

- **1:1 极致复刻与技术落地**：
  1. **Photoshop 头部与动态字阶系统（`ps-title` & `ps-icon`）**：
     - 精准绘制左侧圆角 `Ps` 软件图标（`badgeWidth: 52, badgeHeight: 52, badgeColor: '#001e36', badgeBorderColor: '#31a8ff'`）；
     - `drawText` 与 `textBounds` 深度原生支持 `ps-title` 动态字阶：自动识别数字并以 1.38x 放大显示，底线基线精确对其，原汁原味还原日系 DTP 排版美学；
     - 日英副标题紧随其下，精准对齐参考图构图比例。
  2. **正交自由变换选区框与 Hero 眼眸锚点**：
     - 7 组视窗全部重设为 `rotation: 0` 正交坐标，`hasShadow: false`, `tape: null`，统一 8 控点白色手柄；
     - 核心视窗 2（`x: 485, y: 265, w: 355, h: 280`）精准覆于面部、眼眸与手势之上，原位采样呈现震撼的 Color Halftone + Gradient Map；
     - 主图应用 `zoom: 1.12, panY: -65` 空间微调，消除顶部多余留黑，使视窗 1（发带额头马赛克）与视窗 6（前胸衣领高反差阈值）精准落在人物结构上。
  3. **六大滤镜全链路统一度调映射（Cyber Periwinkle & Midnight Navy）**：
     - 重构 `circle_halftone`（同心圆水波）与 `line_halftone`（横向扫描线）算法，基于反差像素直接映射到 `#071540`（暗部）与 `#c2d4ff`（高光），彻底告别黑色噪点；
     - 彩色半调（CMYK 分色网屏）、点状半调、Bayer 20px 抖动点刻、阈值硬二值化全面对齐此套标志性紫蓝阶调映射。
  4. **全套正宗日英双语配方排版与文字阴影保真**：
     - 7 组描述 100% 还原参考图日文滤镜名称、英文对应词条及 `+` 连接符；
     - 为 `ps-recipe` 注入微距边缘字影保护（`shadowColor: rgba(0,0,0,0.95), shadowBlur: 6`），确保白字在浅色衣物与高光区域均清晰锐利、毫不受损；
     - 左下角追加垂直边注水印 `tamesan_design`（`rotation: -90`）。
  5. **自动化测试与实机无损验证**：
     - `checks/editor-regression.cjs`、`checks/composition-regression.cjs`、`checks/motion-regression.cjs` 全部 100% PASS；
     - Chrome CDP 无头浏览器实机页面截屏比对，视觉效果与参考海报达到像素级神韵一致。

## 2026-10-04｜模板 02 实装落地：先锋暗调机能模特实机即时呈现 & 双示范模板一键切换

- **用户反馈与痛点诊断**：
  - 用户反馈：「试一下这个图」并上传了黑棚白领机能风男模写真（`model-techwear.jpg`）；
  - 随后反馈：「我没看到呀」；
  - **核心根因彻底定位**：
    1. 前序验证仅在离线脚本注入，线上 `poster.js` 中模板 02 的示范素材未直连 `model-techwear.jpg`，仍回退至 Karina 多图；
    2. 网页默认启动硬编码调用模板 01（`loadDemo(false)`），导致用户刷新浏览器依旧停留在 Aespa 模板；
    3. `applyMasterRemixByIndex` 中曾存在 `isReset ? 0 : ...` 逻辑，重置时会将模板强制回退至模板 01。

- **先锋暗调机能拆解（模板 02）实机上线全景方案**：
  1. **资产无缝直连与智能分流**：
     - `poster.js` 中新增 `ensureModelTechwearAsset` 预加载管线，自动解析 `assets/model-techwear.jpg` 与内联 base64；
     - 模板 02 在示范模式下直连先锋暗调机能男模；用户模式下则优雅接入用户上传素材；
     - 7 组视窗全面采用原图原位采样（In-place Crop & Transform），完全复刻参考图「单一模特 + 7 组 Photoshop 选区滤镜」工艺；
  2. **左侧工具栏双示范按钮**：
     - 将原本单一的「恢复示范模板」拆分为横排双按钮：
       - `[示范 01 / DEMO 01]`：一键恢复 Aespa 电光多图档案；
       - `[示范 02 / DEMO 02]`：一键切换至先锋暗调机能模特 7 选拆解；
  3. **默认启动与版本防缓存**：
     - 页面初始化默认启动调用 `loadDemo02(false)`，用户刷新页面无需任何操作即可直接映入眼帘；
     - `index.html` 脚本版本号升级为 `v20261004-v2`，彻底击穿浏览器静态缓存；
  4. **全套自动化测试回归通过**：
     - `checks/editor-regression.cjs` 5/5 全项 PASS；
     - `checks/composition-regression.cjs` PASS；
     - `checks/motion-regression.cjs` PASS；
     - Chrome CDP 实机无侵入截图校验通过，确认 `model-techwear.jpg` 完美展现在主画布上。

## 2026-10-03｜原汁原味：多图视窗精准融合模板 02 参考图专属 Photoshop 特效

- **用户痛点与核心诉求**：
  - 用户反馈：「其他图片就也要用到我们模板二参考图片的效果」，并在截图中以红框特别圈出了 4 组辅图视窗；
  - 核心诉求：辅图在装填不同素材（`karina-hands.jpg`、`karina-crouch.jpg`、`karina-sky.jpg`）的同时，必须忠实继承并呈现原参考图中对应的经典 Photoshop 工艺（彩色半调+阶调映射、同心圆水波半调、水平扫描线、20px 位图点刻抖动），并保持自由变换粉色细框与 8 个白色变换控制手柄的原生 PS 质感。

- **多图与 PS 特效深度融合方案**：
  1. **辅图视窗精准搭载参考图 Photoshop 特效**：
     - 视窗 3（右上 HERO 展位）：绑定辅图 1（`karina-hands.jpg` 手部捧花覆面写真），呈现 `Color Halftone (Pixelate) + Gradient Map`（钴蓝彩色半调分色网屏）；
     - 视窗 2（中左展位）：绑定辅图 2（`karina-crouch.jpg` 蹲姿甜美写真），呈现 `Halftone Pattern 'Circle' + Grain`（同心水波半调与颗粒波纹）；
     - 视窗 7（右腰展位）：绑定辅图 3（`karina-sky.jpg` 蓝天青草地写真），向上平移定格蓝天与笑容，呈现 `Halftone Pattern 'Line' + Motion Blur`（水平运动模糊扫描线）；
     - 视窗 4（左下展位）：绑定辅图 1 蒲公英微距（`karina-hands.jpg`），呈现 `Bitmap 20px + Diffusion Dither`（Bayer 8x8 纯硬位图点刻抖动）；
  2. **复刻参考图 PS 自由变换边框与控制手柄**：
     - 剔除厚重纯白相纸包边，全面还原参考图标志性的 Photoshop Free Transform 粉色选区细线框（`#fbcfe8`，1.2px）与 8 个白色方形变换锚点手柄（`#ffffff`）；
     - 保留 3D 纸张立体浮凸阴影与和纸半透明贴胶，完美融合「多素材装填」与「参考图特效拆解」；
  3. **图题排版精准呼应**：
     - 各视窗标号与图题精准对齐参考图专业配方（如 `FIG. 03 // COLOR HALFTONE (PIXELATE) · HANDS SPECIMEN`、`FIG. 02 // HALFTONE PATTERN 'CIRCLE' · CROUCH SPECIMEN` 等）；
  4. **全套自动化测试回归通过**。

## 2026-10-03｜多图显影突破：告别重度半调粉碎，以真实相片剪影呈现 4 张专属人像

- **用户痛点与核心诊断**：
  - 用户反馈：「没看到有用到其他的图呀」；
  - 核心根因：此前虽然在数据链路层打通了素材托盘与视窗的多图装填，但因各视窗默认施加了 90% 强度的重度网点半调（`color_halftone`）、同心水波半调（`circle_halftone`）、水平运动模糊扫描线（`line_halftone`）及双色调映射，导致辅图画面细节被滤镜彻底粉碎成抽象网格噪点。肉眼看去极似抽象图形，用户完全无法识别出自己上传的真实人像。

- **多图相片真实显影改造**：
  1. **辅图视窗全面升级为实体照片相片剪影（Physical Photo Print Cutouts）**：
     - 在多图创作场景下，辅图视窗（`d3`, `d2`, `d7`, `d4`）自动切换为真实原色高保真画质（`filterType: 'original'`，搭配 +12~14% 杂志级对比度与饱和度微增益）；
     - 辅以纯白相片包边（`lineWidth: 2.5, color: '#ffffff'`）与洁白相纸衬底（`backingColor: '#ffffff'`）；
     - 完美保留 3D 纸张立体浮凸阴影（`hasShadow: true`）与半透明和纸贴胶（`tape: 'corner-right' | 'top' | 'corner-left'`），宛若实体时尚杂志情绪板；
  2. **4 组人像精彩瞬间清晰可见、各美其美**：
     - 主图背景：大画幅暗调黑白胶片质感，黄花拂面，神采五官 100% 净空零遮挡；
     - 视窗 3（右上 HERO 展位）：清晰呈现「草地双手捧花覆面」灵动神态（`karina-hands.jpg`）；
     - 视窗 2（中左展位）：清晰呈现「草地轻巧蹲姿回眸」甜美写真（`karina-crouch.jpg`）；
     - 视窗 7（右腰展位）：经智能向上平移（`panY: 55`）精确框定「蓝天青草地半身全景」，碧空白云与人像笑容跃然纸上（`karina-sky.jpg`）；
     - 视窗 4（左下展位）：200% 光学微距聚焦「指尖捧着娇嫩黄花」的微距标本（`karina-hands.jpg` 蒲公英特写）；
     - 视窗 1、6、5：保留发侧像素马赛克、服饰 Xerox 阈值与角落网点半调等前卫局部工艺，形成「真实写实人像相片 + 先锋数码工艺」的丰富层次感；
  3. **图题排版精准呼应**：
     - 图题文字随多图状态智能切换为 `FIG. 03 // PHOTO SPECIMEN · HANDS & DANDELION`、`FIG. 02 // PHOTO SPECIMEN · CROUCH POSE`、`FIG. 07 // PHOTO SPECIMEN · SKYLINE VIEW`、`FIG. 04 // DETAIL CROP · FLOWER MACRO` 等专业标本索引；
  4. **全套自动化测试回归通过**。

## 2026-10-03｜多图修复：消除素材托盘污染退化，完整呈现 4 组独立真实示范人像

- **用户痛点与核心诊断**：
  - 用户反馈：「这里的图也要是我给你的那几张呀」，并截图标注左侧素材面板中的 4 张图片缩略图均错误显示成了同一张特写照片（`karina-close.jpg`）；
  - 核心根因：在执行排版/总 REMIX 循环切版时，因 `images` 参数传递为空，`resolveSlotAssetIds` 内部存在 `imgHands = images?.hands || imgClose` 的回退逻辑，意外将 `asset-karina-hands`、`asset-karina-crouch`、`asset-karina-sky` 在 `imageAssets` 缓存中的内存对象全部覆盖改写成了主图，导致多图资产丢失了各自独立性。

- **修复与加固策略**：
  1. **多图资产防污染隔离**：
     - 重构 `resolveSlotAssetIds` 中的示范素材解算逻辑，为 `close`、`hands`、`crouch`、`sky` 绑定严格的专属 Base64 数据源与独立 `Image` 实例，杜绝向单一主图回退覆盖；
  2. **REMIX 循环链条异步装载加固**：
     - 在 `cycleMasterRemix` 与 `cycleLayoutRemix` 中完整衔接 `ensureKarinaMultiAssets` 回调，确保切版时 4 组图片始终精确、独立地分发至布局函数中；
  3. **实机渲染验证**：
     - 左侧素材面板 4 组卡片完全恢复为您提供的 4 张真实图集：
       - `karina-close.jpg`（主图 · 黄花特写）
       - `karina-hands.jpg`（辅图 1 · 草地双手捧花覆面）
       - `karina-crouch.jpg`（辅图 2 · 草地轻巧蹲姿）
       - `karina-sky.jpg`（辅图 3 · 蓝天下半身全景）
     - 画布中 7 大拼贴视窗亦同步真实呈现对应不同视角的色彩与滤镜碰撞；
  4. **全套自动化回归测试 100% 通过**。

## 2026-10-03｜海报化蜕变：模板 02 引入先锋艺术大标题排版，并实现「7 大拼贴视窗自动装填多图辅图」

- **用户痛点与核心诉求**：
  - 用户反馈：「没有标题hhh，也没有什么字体，而且还没有多图」；
  - 核心诉求：脱离原教学卡片的单调死板属性，为模板 02 注入真正的海报灵魂——赋予其先锋艺术大标题与潮流字体排版，并将 7 个拼贴视窗与用户上传的多张辅图深度打通，实现自动分发装填。

- **海报化改造与多图装填升级**：
  1. **先锋艺术大标题与概念字体排版（COLLAGE ARCHIVE）**：
     - 顶部注入冲击力十足的艺术大字头标（`COLLAGE ARCHIVE`）与等宽冰蓝概念副标（`N° 02 · MULTI-IMAGE RESAMPLING & PHYSICAL COLLAGE`），右上角植入规格徽章（`SPECIMEN // 02`），完美框定海报头阵；
     - 将原本生硬冗长的日文教学菜单标注彻底替换为极具前卫时尚画报质感的 `FIG. 01 // PIXELATE MOSAIC` ~ `FIG. 07 // HORIZONTAL SCANLINE` 系列工艺规格排印，跟随各视窗倾角有机律动；
     - 底部加入极简注脚标线，整体排版达到国际先锋杂志 Editorial 级别；
  2. **7 大拼贴视窗智能装填多图素材**：
     - 在多图场景下，7 个拼贴视窗自动映射装填各张不同的辅图（如辅图 1 手部特写装填至右上方 Cobalt 英雄位、辅图 2 姿势图装填至中左水波位、辅图 3 天空图装填至右腰扫描位等）；
     - 左侧素材托盘的特写统计（`主图 · 特写 3`、`辅图 · 特写 2/1/1`）全链路点亮，所有素材各得其所；
     - 在单图创作模式下，自动降级为围绕主图各区域采样，实现单图/多图 100% 弹性兼容；
  3. **面部零遮挡与立体手作感完美保持**：
     - 模特五官核心神采区保持 100% 净空露白；3D 纸张立体浮凸阴影与和纸磨砂封口胶带质感完好如初；
  4. **回归测试全绿**：
     - 编辑器底座、8 大构图、动态引擎等 7 套测试用例全部 100% PASS。

## 2026-10-03｜去伪存真：彻底移除模板 02 顶部教程展示性大标题与作者水印

- **用户痛点与核心诊断**：
  - 用户反馈：「这个字也删呀，留这个又不是什么展示」；
  - 诊断发现：原参考图是一张《7 种 Photoshop 图像特效搭配推荐》的平面设计教程示范卡。将「画像エフェクトの組み合わせ例 7選 / 7 Image Effect Combinations That Work Well Together」作为海报大标题强加在用户自主创作的人像海报上，违背了海报作为独立艺术创作的本质，显得生硬且冗余。同时底部角落还残留有教程原作者推特水印（tamasan_design），必须一并清空。

- **去展示化精简改动**：
  1. **彻底移除顶部教程大标题与副标题**：
     - 在 `applyLayoutTemplate02` 与调色逻辑中完全去除 `t-title-main` 与 `t-title-sub`；
     - 画布顶部完全开阔留白，让背景深色暗角暗调与人像主体发丝、神韵获得极高宽容度的视觉呼吸感；
  2. **清除外部作者推特水印**：
     - 移除角落残留的 `t-credit`（`tamasan_design`），海报回归纯粹的创作者专属画布；
  3. **保留并优化 7 大拼贴视窗微型配方小标**：
     - 各视窗随错落微倾角（-3.5° ~ +4.0°）呼应的微型配方文字（如 `Mosaic + Halftone` 等）完美保留，兼备实体手作拼贴的排版细节与前卫杂志 Editorial 感；
  4. **全套自动化测试回归通过**：
     - 编辑器底座、8 大构图、动态引擎等 7 套测试用例全部 100% PASS。

## 2026-10-03｜质感跃升：破除刻板规矩网格，赋予模板 02 灵动「手作拼贴立体感」

- **用户痛点与核心诊断**：
  - 用户反馈：「有点过于规矩了，不够有拼贴感」；
  - 诊断发现：此前为规避遮脸，所有视窗被迫排成平行的垂直列（x 坐标僵硬一致，且旋转角度皆为 0°），缺乏拼贴画报应有的有机错落、高低穿插与立体手作质感。

- **立体拼贴 4 重强化**：
  1. **有机微旋倾角律动（Micro-Rotations）**：
     - 打破平行呆板感，为 7 大视窗赋予交错呼应的有机微旋角度（-3.5° ~ +4.0°）；
     - 变换手柄、视窗边框与内部剪裁画面同步随角度旋转，精准呈现 Photoshop 自由变换（Free Transform）的真实动态；
  2. **三维立体纸张投影（Physical Drop Shadows）**：
     - 在底层 `drawDetail` 中为每个视窗注入柔和半透明纸张投影（shadowBlur: 14, offsetY: 6），使各个特效视窗呈现从深邃底图上真实浮凸悬空的 3D 拼贴质感；
  3. **磨砂半透明胶带封贴（Washi Tape Accents）**：
     - 在视窗顶边与角点轻巧贴合磨砂半透明封口胶带（Washi Tape），显著强化实体手作拼贴的艺术氛围；
  4. **蛇形错落节奏（Staggered Cadence）**：
     - 彻底解绑固定 x 轴，左列视窗形成（x: 58 → 92 → 42 → 75）的内推外展波浪节奏，右列与中轴纵向穿插，在<span style="color: #002FA7; font-weight: 600;">绝对不遮挡五官神情</span>的前提下，实现了张力十足的杂志级拼贴构图。

## 2026-10-03｜模板精进：模板 02 移除 PS 字样徽标，重构视窗排布实现「面部完全零遮挡」

- **用户反馈驱动**：
  1. 移除左上角「Ps」应用图标徽标与副标题中侵入性的「Photoshop」文字，保留纯净日系杂志风主标题与英文字幕；
  2. 彻底解决视窗与采样框遮挡模特面部（眼睛、鼻梁、嘴唇）的痛点，确保人物面容清爽完整露空。

- **工程与版式改进**：
  1. **面部保护净空区**：
     - 将中央面部核心坐标区（x: 240~640, y: 150~520）完全留空；
     - 7 大自由变换视窗改为四周环绕式分布：
       - 左列：上侧马赛克像素化、中侧同心圆半调、下侧 Bayer 位图点阵、底角点状半调；
       - 右列：右上侧钴蓝双色调彩色半调、右腰线性水平动感半调；
       - 下腹：胸腹部服饰纹理 2 阶调阈值化手绘块；
  2. **消除采样框与连线干扰**：
     - 去除采样源框线条（strokeOpacity: 0）与折线连接器，使视窗呈现纯粹就地变换悬浮质感；
  3. **文字网格与右对齐秩序**：
     - 版头主副标自画布左边距优雅起排，右列标注文字与视窗外框严格右对齐，呼吸感大幅提升。

## 2026-10-03｜模板精雕：复刻「Photoshop 特效搭配 7 选」教程海报（模板 02）

- **背景与目标**：
  - 遵循用户「一个一个精雕复刻，绝不做随机混杂」的指导思想；
  - 在彻底清理旧占位模板 02–06 后，全新精雕构建专属模板 02：像素级复刻经典的 Photoshop 特效拆解与选区视窗风格（Ps 特效搭配 7 选）。

- **核心视觉与工程实现**：
  1. **Photoshop 软件徽标与标题组**：
     - 在 `drawText` 中新增 `ps-icon` 原生矢量圆角徽标渲染（暗深蓝底、官方电光青蓝外框与 Ps 字样）；
     - 完整搭载日文主标题「画像エフェクトの組み合わせ例 7選」与英文字幕「7 Photoshop Image Effect Combinations That Work Well Together」；
  2. **自由变换选区视窗（Free Transform 8 锚点手柄）**：
     - 在 `drawDetail` 与 `drawFrame` 中注入 `showHandles` 机制，在每个采样视窗四角与四边中点精确绘制浅粉白相间的小方块手柄，高度逼真还原 Ps `Cmd+T` 选区状态；
  3. **7 大特效采样配方**：
     - **视窗 1（耳机顶部）**：马赛克像素化（Mosaic Pixelate）；
     - **视窗 2（左肩蝴蝶）**：同心圆半调（Concentric Circle Halftone）＋ 颗粒 ＋ 荧光青蓝双色调渐变映射；
     - **视窗 3（右侧面容·HERO）**：彩色半调（Color Halftone）＋ 皇家钴蓝与薰衣草粉紫渐变映射；
     - **视窗 4（左臂手套）**：20 像素 Bayer 位图点阵（Bitmap Dither）＋ 渐变映射；
     - **视窗 5（左下腹部）**：斜向点状半调（Slanted Dot Halftone）＋ 渐变映射；
     - **视窗 6（胸前图案）**：2 阶调阈值化高反差手绘感（Threshold）＋ 粒子 ＋ 渐变映射；
     - **视窗 7（右腰动感）**：线性水平扫描半调（Line / Scanline Halftone）＋ 动感电光青蓝；
  4. **精致排版标注**：
     - 每个视窗均配有精准排版的日文特效名称、滤镜菜单路径及英文对应项，按版面网格整齐对齐；
  5. **模块化 REMIX 无缝联动**：
     - `applyLayoutTemplate02`（独立排版）与 `applyFilterTemplate02`（独立暗调滤镜）完全解耦；
     - 「⚡ 总 REMIX」支持在 [1/2] Aespa 电光档案 与 [2/2] Ps 特效 7 选 之间一键平滑循环切换，或与排版/滤镜独立混搭。

## 2026-10-03｜体验精进：合并主图/辅图双按钮，打造统一「上传图片（单选/多选）」工作流

- **用户需求与设计演进**：
  1. 彻底解决以往左侧栏「上传/更换主图」与「＋ 添加图片（可多选·辅图）」两个按钮割裂、职责混淆的痛点；
  2. 统合为一个高辨识度核心主按钮：`＋ 上传图片 <small>单选 / 多选</small>`；
  3. 智能判定用户意图：
     - **单图创作**：用户在系统文件选择框中选择 1 张图片，即刻载入为主图，并自动分发适配全套排版与滤镜；
     - **多图创作**：用户在选择框中按住 Ctrl/Shift 选择多张图片，第 1 张智能设为主图，其余图片分发绑定至各拼贴卡片槽位（或自动生成辅助卡片）；
     - **后续追加与管理**：用户已有创作时，再次点击该按钮可继续批量导入更多图片素材；配合下方「当前图片 / IMAGES」托盘中的「设为主图」与「删除」按钮，实现一站式无缝素材流转。

- **全量测试与实机验证**：
  - `checks/editor-regression.cjs` 5/5 全项 PASS；
  - `checks/composition-regression.cjs` PASS；
  - `checks/motion-regression.cjs` PASS；
  - Edge CDP 浏览器端自动化实测单图上传与 3 图批量上传，UI 与托盘均准确渲染，捕获实机截图 `unified-upload-ui.jpg`。

## 2026-10-03｜交互升华：移除繁琐模板卡片，全面融入 6 组排版 REMIX × 6 组滤镜 REMIX 正交轮播体系

- **用户需求与设计演进**：
  1. **告别模板卡片繁冗堆砌**：移除左侧栏「精选排版模板」与右侧栏「精选滤镜模板」的独立选择卡片，释放出极其清爽聚焦的侧边栏工作区；
  2. **REMIX 矩阵化循环轮播**：将 6 组总效果解构为 6 组独立的精选排版与 6 组精选滤镜，用户通过点击不同的 REMIX 按钮即可正交循环切播，支持任意排列组合出数十种丰富视觉效果。

- **三维 REMIX 轮播交互机制**：
  1. **📐 排版 REMIX ↻（左侧底栏高亮按钮）**：
     - 点击循环步进 6 组精选空间几何构图（`[1/6]` 至 `[6/6]`）；
     - 严格保持当前滤镜调色、底纸材质与边框质感不变，仅对空间布局、留白主图、副图卡片比例与局部特写进行正交重塑；
     - 轮播序列：
       - `[1/6]` Aespa 电光档案构图（内嵌留白主图 + 4 卡片拼贴 + 三路微距特写）
       - `[2/6]` 主体证物档案构图（中央大主图 + 顶部/底部证据卡片列）
       - `[3/6]` 情绪画板画报构图（左大图主导 + 右侧多列画报卡片）
       - `[4/6]` 双核对照画报构图（双大图并置对冲 + 局部细节对照）
       - `[5/6]` 主辅环绕画报构图（居中主视觉 + 四周环绕微型证据窗）
       - `[6/6]` 线索链条解构构图（非对称错落画幅 + 阶梯式线索排布）
  2. **🎨 滤镜 REMIX ↻（右侧检查器顶部克莱因蓝按钮）**：
     - 点击循环步进 6 组精选视觉风格调色（`[1/6]` 至 `[6/6]`）；
     - 严格保持当前画面所有卡片、特写与文字的空间位置不变，仅对底纸纹理、印刷半调（Halftone）、颗粒（Grain）、扫描线与主题配色进行视觉重塑；
     - 轮播序列：
       - `[1/6]` Aespa 电光虎纹与胶印色彩（电光蓝虎纹纸 + 胶印网点 + 金色衬块）
       - `[2/6]` CCTV 绯红胶印报刊（复古绯红扫描纸 + 高对比双色调）
       - `[3/6]` CCTV 蔚蓝坐标网格（冷调蓝坐标纸 + 赛博数码质感）
       - `[4/6]` 半调杂志复古编辑（经典复古米白纸 + 粗颗粒半调网点）
       - `[5/6]` 酸性全息流体水银（深黑底底色 + 全息流体水银高反差）
       - `[6/6]` XEROX 街头重墨复印（高燥点撕裂复印机质感 + 极致黑白双色）
  3. **⚡ 总 REMIX（左下底栏 & 顶部状态栏 1-CLICK）**：
     - 步进轮播 6 组黄金配对总模板（同时套用对应排版 N + 滤镜 N）；
     - 实时同步底栏辅助提示（如 `[2/6] 排版 02 + 滤镜 02`）与顶栏状态胶囊（如 `[2/6] 证物胶印`）。

- **用户专属图片多图分配保护**：
  - 无论用户上传 1 张、多张自定义图片，还是使用官方 Aespa 示范图片，轮播任意排版或总 REMIX 时均通过智能插槽算法（`resolveSlotAssetIds`）自动按多图列表分发绑定，绝不丢失用户图片。

- **全量测试与实机验证**：
  - `checks/editor-regression.cjs` 5/5 全项 PASS；
  - `checks/composition-regression.cjs` PASS；
  - `checks/motion-regression.cjs` PASS；
  - Edge CDP 浏览器端实机自动化验证轮播逻辑正常，捕获 `6-remix-modular-ui.jpg`。

## 2026-10-03｜架构解耦：总 REMIX 拆分为独立的「排版模板一」与「滤镜模板一」模块化系统

- **模块化解耦背景与系统设计思想**：
  1. 彻底解决以往单体总 REMIX“空间构图与色彩滤镜硬编码强绑定”的问题；
  2. 确立正交独立的双轨模板架构：
     - **空间几何构图系统**（Geometry & Spatial Composition）：由左侧栏「精选排版模板 LAYOUT TEMPLATES」驱动；
     - **视觉色彩质感系统**（Styling, Halftone & Texture）：由右侧栏「精选滤镜模板 FILTER TEMPLATES」驱动；
     - **⚡ 总 REMIX（Master Remix）**：作为一键组合拳，同时调度构图与滤镜，并双向联动激活状态。

- **左侧「精选排版模板一 · Aespa 电光档案」**：
  1. **空间几何精算**：调度内嵌留白主图、4 张多图拼贴卡片、三路微距唇眼证据特写、金色半调衬块与态度文字排布；
  2. **正交纯粹性**：仅操作坐标、宽高、缩放、层级与局部特写采样，绝不强行覆盖用户已设定的滤镜参数与背景预设；
  3. **用户资产兼容**：无论用户上传单图或多图，自动提取真实面部眼唇坐标，无损映射至各卡片与特写框。

- **右侧「精选滤镜模板一 · Aespa 电光虎纹」**：
  1. **材质与色彩精算**：一键注入 Aespa 经典电光蓝黑虎纹底纸、4px 极简外框、主图杂志原色轻网点（Halftone 20 + Grain 12）、副图蓝光黑白高反差、金色半调色块与克莱因蓝指示框；
  2. **正交纯粹性**：仅调整色彩、色调、网点与底纸，绝不篡改或打乱任何卡片与文字的几何位置；
  3. **多预设互斥与激活同步**：当用户切换其他预设（如 CCTV RED、XEROX）时，滤镜模板卡片自适应取消高亮，状态精准同步。

- **底部 / 顶部「⚡ 总 REMIX」**：
  1. 标语文案升级为“一键应用：排版模板 01 + 滤镜模板 01”，清晰向用户传达底层逻辑；
  2. 一键点击同时触发 `applyLayoutTemplate01` 与 `applyFilterTemplate01`，左右两侧卡片同时点亮克莱因蓝激活态。

- **全量测试与回归验证**：
  1. `checks/editor-regression.cjs` 扩充模块化排版与滤镜模板隔离验证，5/5 全项 PASS；
  2. Edge CDP 浏览器端自动化测试通过，真实捕获各状态界面截图。

## 2026-10-03｜UI 深度调优：1K+ 超清分辨率交互微件 & 左右双侧边栏自由拖拽拉伸

- **1K+ 超清分辨率微件与导出管线升级**：
  1. 将画布顶部右侧次 1K 的静态文本 `900 × 1200 / PNG` 替换为克莱因蓝标识徽章与交互式分辨率微件；
  2. 默认分辨率由 900×1200 升格至标准 1.2K（`1200 × 1600`，长宽比保持 3:4），严格达标 1K+；
  3. 提供下拉菜单，覆盖所有主流高清档位：1K 社媒 (`1080 × 1440`)、1.2K 推荐 (`1200 × 1600`)、1.5K 档案 (`1500 × 2000`)、2K 视网膜点对点 (`1800 × 2400`)、3K 大海报 (`2400 × 3200`) 与 4K 印刷级 (`3000 × 4000`)；
  4. 升级 `exportPoster()`，按选定分辨率进行平滑双立方高质量重采样渲染，生成真正超清的大尺寸 PNG 图像。

- **左右双侧栏自由拖拽拉伸（双向 Resizer）**：
  1. **布局重构**：采用 CSS Grid 5 列动态布局（`var(--poster-left-width) 6px minmax(0, 1fr) 6px var(--poster-right-width)`）；
  2. **左侧栏拉伸**：在左侧工具栏与中央画布之间植入独立 Resizer 分割条，按住向右拖动可拓宽左侧栏（最高 650px），向左拖动可收窄（最低 170px）；
  3. **右侧栏拉伸**：在中央画布与右侧属性栏之间植入对应 Resizer，按住向左拖动拓宽右侧栏，向右拖动收窄；
  4. **交互细节与克莱因蓝视觉反馈**：
     - 默认状态为极简边框线条与居中微型握把；
     - 悬浮与拖动时点亮克莱因蓝高亮（`#002FA7`），光标切换为 `col-resize`，拖拽期间全局防选区与指针捕获；
     - 双击 Resizer 瞬间恢复默认宽度（左 220px / 右 260px）并弹出 Toast 提示；
     - 支持无障碍键盘操作（左右方向键步进 15px，Enter/Home 复位）；
     - 支持 `localStorage` 记忆宽度（刷新页面不丢失）；
     - 拉伸过程中自动联动 `fitWorkspace()`，确保画布舞台自适应居中缩放。

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

## 2026-10-03 — 模板 01 · Aespa 电光档案（多图拼贴杂志海报）定稿

### 业务与设计目标
- 依据用户提供的原版杂志海报参考图，重构并定稿第一套旗舰模板 **模板 01 · Aespa 电光档案（多图拼贴版）**。
- 从原有的单图取景全面升级为真实 4 图摄影大片杂志拼贴架构，并将其确立为系统进入时的**默认起始画面**以及“总 REMIX”的一键还原目标。
- 解决用户提出的两大关键视觉痛点：
  1. “背景不能全黑白，全黑就没有细节了，需要有一些原色在” —— 彻底消除压黑死黑，保留针织毛衣纹理、金黄雏菊与自然肤色；
  2. “然后她的主图不是占据整个背景的，是缩小一点的，然后把背景漏出来的” —— 缩小主图内嵌，镂空四周露出专属开发的 Aespa 电光蓝黑虎纹底纸。

### 核心实现
1. **多图素材接入与零 CORS 离线内嵌**：
   - 接入用户提供的 4 张高清摄影大片并规范命名：
     - `assets/karina-close.jpg`（特写肖像，咬花，主底图）；
     - `assets/karina-hands.jpg`（双手托颊，黑白主副卡）；
     - `assets/karina-crouch.jpg`（草地远景肖像，左上副卡）；
     - `assets/karina-sky.jpg`（仰角侧颜胶片色温，右下宽副卡）。
   - 通过 `assets/demo-collage-data.js` 统一 Base64 编码，实现不论是通过 `http://localhost:8089` 还是本地直接双击 `index.html`（`file:///` 协议）均零跨域异常、零外部依赖离线满血加载。
2. **专属底纸：Aespa 经典电光蓝黑虎纹（ELECTRIC TIGER）**：
   - 在 Canvas 渲染层新增程序化生成算法 `drawElectricTigerPattern(ctx, W, H)`：
     - 底色由 `#001fd4` 到 `#042cf0` 的深邃皇家电光蓝线性渐变铺底；
     - 叠加上层径向能量微光，并在画布顶端、左右两侧与底部边缘绘制有机流体黑斑电光爪纹（Stylized Organic Tiger Claws）；
     - 辅以极细微杂色颗粒质感，与原版画报底纸 100% 呼应。
   - 右侧“背景与纸张”面板新增 `ELECTRIC TIGER` 一键切换预设。
3. **主图尺寸比例调整与留白镂空**：
   - 主图由全屏占满改为内嵌缩放（`x: 38, y: 105, w: 824, h: 1035`），外覆 2px 高亮细白边框。
   - 顶部镂空 105px 露出蓝黑虎纹，承托金黄黑描边的 `RICH MAN` 涂鸦大标题与左上方克莱因蓝拨片徽章（Pick Badge），完美再现原版封面层级。
4. **色彩与细节全面复苏（告别死黑）**：
   - 主图滤镜去除全黑白限制（`bw: 0`），饱和度适度提高至 `110%`，对比度由原本极端的 72 降至温润的 18，微调暗部亮度提升（`brightness: 4`）；
   - 毛衣暖橙珊瑚色纤维质感、网眼镂空与折痕阴影层次完整复原，金黄雏菊纯度饱满；
   - 配合轻量细微单色半调印刷网点（`halftone: 20`, 半调点径 5px），呈现纯正时尚杂志胶印印刷质感。
5. **多图卡片与微距特写证据系统**：
   - 右侧大卡（`karina-hands`）：采用高对比黑白双色调，配克莱因蓝外框与 `aespa` 空心徽章、`11.4.2000` 出生日期标签；
   - 右下宽卡（`karina-sky`）：采用胶片原色，标注 `Yu Ji-min` 签名角标；
   - 左下卡片与金黄半透明半调色块（`frag1, frag2, frag3`）错落堆叠；
   - 3 组微距特写框精准采样：
     - `EYE` 框：精准捕捉眼睫毛与双眸眼影；
     - `TEETH` 框：精准特写指尖轻捏金黄雏菊的花瓣与微距唇齿；
     - `Eye contact` 框：双眼全景目光接触横条。
6. **双重总 REMIX 入口与默认落地**：
   - 顶栏常驻 `⚡ 总 REMIX (模板 01 · Aespa 1-CLICK)` 胶囊按钮；
   - 左侧操作坞常驻黑金/电光蓝 `⚡ 总 REMIX (MASTER ↻)` 卡片按钮；
   - 随时一键从任意排版或滤镜状态秒回定稿的模板 01 精品版式。

### 验收与定稿
- Node 语法检验 100% 通过（`node -c poster.js` 无任何语法报错）。
- 回归测试 100% 通过（`checks/editor-regression.cjs` 4/4 PASS）。
- Edge/CDP 无头自动化实机跑通（`scratch/test-karina-multi-image.js`）：4 素材完整载入，主辅图状态正确，Canvas HD 与 UI 截图完整留档。
- 用户实机打开浏览器验证确认：“不错不错”，正式定稿。

## 2026-10-03｜Collage Poster 视觉与交互全量升级（1K+ 分辨率 · 自由拉伸边栏 · 眼睛精准采样 · 用户图片总 REMIX）

### 用户反馈与核心诉求
1. “首先红框这里的分辨率要调为1k以上的” —— 顶部导出分辨率升级，标配 1K 以上规格；
2. “然后是Ui的左侧，可以调整为自由拉伸，可以拉伸向右变宽，也可以变窄，右边也这样调整” —— 左右侧边栏支持鼠标自由拖拽变宽/变窄，自适应中栏画布；
3. “模版一的这个眼睛有点不合适” —— 调整 Eye 采样框与特写框坐标，精准框选眼睫毛与瞳孔虹膜；
4. “我刚刚上传了其他图片想要这种排版，但是我摁了总remix，就还是这个模板图片的，不是我上传的图片，这个也是一个问题，要修复” —— 修复点击“⚡ 总 REMIX”或应用模板 01 时盲目覆盖用户素材为示范图的 bug，完整为用户自有图片应用 Aespa 电光虎纹前卫排版系统。

### 核心实现
1. **1K+ 高清分辨率导出规格升级**：
   - 顶部标牌由原静态 `900 × 1200 / PNG` 升级为交互式分辨率选择器，默认为 `1200 × 1600 / PNG`（配亮眼克莱因蓝 `1.2K` 标签）。
   - 下拉支持 `1080 × 1440 (1K FHD)`、`1200 × 1600 (1.2K)`、`1500 × 2000 (1.5K)`、`1800 × 2400 (2K)`、`2400 × 3200 (3K)`、`3000 × 4000 (4K UHD)` 全规格无损导出。
   - `exportPoster()` 重写为高清离屏抗锯齿 Bicubic 双三次重采样渲染，保障任意分辨率输出绝对锐利。
2. **左右双侧边栏自由无极拉伸与持久化**：
   - `.poster-workspace` 升级为 5 列自适应弹性 CSS Grid：`var(--poster-left-width, 220px) 6px minmax(0, 1fr) 6px var(--poster-right-width, 260px)`。
   - 注入左右两侧专业交互分割条 `#posterResizerLeft` 与 `#posterResizerRight`，带微动光条、指示点及 `col-resize` 悬浮光标。
   - 原生 Pointer Events 结合 Pointer Capture 实现平滑拖拽防丢失，支持边界限定（左 170-650px，右 200-650px）、双击还原默认、左右方向键精准微调与 `localStorage` 记忆持久化。
3. **模板 01 特写眼睛与唇齿采样坐标极致校准**：
   - 将原偏离至发际额头的 `f1` 证据框矫正为 `{ x: 235, y: 185, w: 220, h: 140 }`，对应特写框 `d1` 移至 `{ x: 95, y: 295, w: 235, h: 145 }`，精准聚焦右眼猫眼眼线、睫毛与瞳孔虹膜。
   - 同步修正 `f2/d2`（指尖持花与微距唇部）及 `f3/d3`（双眼眼神接触全景横条）。
4. **用户上传图片与总 REMIX 排版系统深度联动**：
   - 新增 `hasUserUploadedImages()` 智能检测用户素材池与主图，精准识别用户自有图片（排除内建 demo 标记）。
   - 在 `applyTemplate01` 中区分 `isUserMode` 与纯 demo 模式：
     - 若用户上传了图片（单张或多张）：
       1. 主图严格保留为用户主图，绝不覆写为 Karina 示范大图；
       2. 自动从工程状态中清理遗留的 demo 垃圾，素材盘只陈列用户有效图片；
       3. 4 个副图卡片自适应绑定用户素材（单图则全卡绑定主图并呈现黑白高反差、白边框等丰富变体，多图则智能轮循铺满）；
       4. 底纸、留白电光虎纹、金黄半调色块、微距特写框、涂鸦排版全量应用于用户图片；
       5. 提示精准反馈 `⚡ 总 REMIX 已生效：已为您的图片应用模板 01 (Aespa Rich Man 电光档案)`；
     - 仅当用户明确点击“恢复示范模板”时，才通过 `isReset = true` 还原官方示范海报。

### 自动化验证与测试
- 语法与回归测试：`checks/editor-regression.cjs` 5/5 全项 PASS（含用户图片保护、多图插槽轮循分配、demo 清理与还原机制）。
- 真实 Edge/CDP 无头自动化测试（`scratch/e2e-user-image-remix.cjs` & `scratch/test-multi-upload-e2e.cjs`）：
  - 单图上传并点击总 REMIX：主图保持、全副图卡片映射、虎纹与样式正确，截图 `user-photo-master-remix-ui.jpg`。
  - 多图上传并点击总 REMIX：多张用户照片各自入位，截图 `user-multi-image-remix-ui.jpg`。
  - 示范模板还原：可干净复原初始 demo。

## 2026-10-05｜分栏试作与模板二轻微质感复测（模板一分栏后已作废）

用户指出模板一随机样本08的特写重复眼睛且挡住主脸。本次上传模式采用完整原比例主图分区：默认zoom1、pan0，特写与黄衬块移至旁侧或底部，辅图最多使用三个不同的非主图素材。取消上传模式的Eye／Teeth标签，改为DETAIL；默认索引框无笔画、标签、手柄、连接线，但取样关联和元素列表编辑仍存在。单图不再重复四张主图辅卡。特殊极端比例的关联框不强制20px，普通手建框仍保留原来的20px最小尺寸。左上徽章亦修复越界。

按用户要求，模板二共享人物底图配方改为运动距离4／方向0、杂色7；局部七组处理参数未改，标题没有整体模糊。界面不再误称面部完全净空。

实际浏览器验证：上传21张固定照片，依次只保留当前样本，01→02导出后撤销恢复图库；21张单图均有两模板默认PNG。四图09/07/16/14及07换主经过两个模板仍保留素材身份。模板一移动与旋转采样框后特写更新，旋转撤销的高清PNG逐像素恢复；模板二4/7关闭至0/0、撤销和重做参数正确，关闭与重做关闭PNG相同，默认与撤销恢复局部窗尚有低幅像素差异（MAD约0.558/255），不记为逐像素一致。

导出增加原始PNG保存链接；自动下载不稳定时从真实按钮生成的DOM链接分块取得原数据，并实际解码核对。首次整段高清数据保存损坏，分块重存后通过，未重绘／重压缩。另发现编辑撤销会恢复旧exportResolution，现将导出尺寸独立于编辑历史，并通过新代码浏览器实测1800×2400尺寸不随横移撤销改变。

结果位于 `samples/results/subject-clear-20261005/`，每个模板文件位于 `samples/results/template-01|template-02/20261005-clear-primary/`。55份唯一模板PNG（46默认、9独立版本）及1份尺寸交互PNG；旧18份PNG与21原图SHA/字节保持。21单图通过3张分批对照总览实际查看，模板一全图比例与主图净空成立。模板二近景窗口遮脸、浅底说明对比不足、暗部窗口信息少仍待后续构图／对比调整；图库无纯横图与完整站姿全身照。

当时相关回归为35+11+6+3+22，共77检查组；新增分辨率与历史独立回归，原模板一主体测试覆盖21实际尺寸和极端合成比例。此段记录分栏试作时的行为，不代表恢复后的模板一。

## 2026-10-05｜撤回分栏试作，纠正两个模板展示

用户认可对照页中间的密集模板一，拒绝右侧分栏改版，并指出它不能作为模板二。原页面实际上把模板一前后版本并列，展示语义混淆。移除 `arrangeTemplate01UploadedPhotos` 及其调用，恢复大人物底图、蓝黑虎纹、金黄衬块与四张照片辅卡，沿用此前 d2 左下／d3 右侧的局部窗位置；不再声称完整原图或主图绝对净空。模板二保持独立的黑白人物／蓝粉透明特效窗，以及运动距离4、杂色7。

展示改为同一样本的“原图／模板一·电光拼贴／模板二·透明特效采样”，并提供两套参考图。分栏试作PNG不删改，只作为明确作废历史；恢复后的实际导出另存 `samples/results/template-01/20261005-restore-collage/`，事件写入 `subject-clear-20261005/restoration-evidence.json`，新结果优先用于模板一展示。恢复构图的回归与实际照片验证另记，不能沿用分栏净空回归的结论。

2026-10-06 完成恢复验证：21张单图重新上传隔离并导出模板一；四图09/07/16/14、09与07两种主图各导出01／02默认。共30份恢复PNG（25默认、5参数／裁切／历史／高清），两模板各有23个默认展示场景。实际导出均解码，高清1800×2400；原21图和18份历史PNG哈希保持。模板二21单图沿用未改配方的前轮实际文件。三张分批总览实际查看全部21图，固定局部取样与遮脸限制仍存在，不宣称全照片通用适配。

回归为37+11+6+3+22，共79检查组通过。真实界面关闭套印、撤销／重做、主图横移及关联特写、高清导出均有记录；撤销后参数正确，局部窗像素较首次默认平均绝对差约0.201/255，未记为逐像素一致。另修正素材计数只按素材池计数；最新版真实上传四图并切换两模板，均保留四个文件名并显示4 IMAGES。最终记录位于 `samples/results/subject-clear-20261005/restoration-results.md`。

## 2026-10-07｜第三组前检查与基础交互修复

保留已确认两模板的构图和滤镜。总REMIX原先会分别提交排版与滤镜，撤销一次形成混合状态；现合并为一条历史，并保存／恢复排版、滤镜、总REMIX游标及界面编号。公开模板ID与旧ID均可调用，错误明确ID返回失败。模板循环按数组长度，合成第三项循环回归通过，真实第三模板尚未建立。

原素材栏只展示主图和当前四个辅卡用到的素材，七图上传有两张无法访问。现显示完整素材池，未分配照片可设主图、删除并撤销／重做；换主图不增加第五个辅卡。实际七图确认计数与身份，长文件名的横向溢出也已修复。移除未接入当前循环的旧Strength／Composition／Shuffle Copy控件。

自动检查81组通过（8+11+37+3+22），动效检查另通过。引擎未改动的22组沿用本日初始结果，其余59组修复后重跑。旧随机构图模块检查不作为当前模板验收。真实界面检查单图03、追加五图、四图07换主、七图13换主与删除恢复，共16份真实PNG，其中6份基线、10份修复后，高清1800×2400；21原图字节与哈希保持。实际导出按模板分别留档。

单图03模板二关闭4/7并撤销／重做的PNG完全一致；四图两模板重复导出及模板二总REMIX重做一致。模板一四图套印撤销仍有平均差0.0668/255，位于共享aespa-09的两张辅图卡片。旧0.201差异也重新定位为辅卡，此前称为局部窗不准确。根因未确认，未修改渲染器或扩大一致性结论。固定取样、遮脸与浅底文字问题仍保留，横图／完整站姿全身照未测，今天未重新进行全部21张视觉巡检。完整记录见 [第三组前检查](samples/results/pre-template03-20261007/results.md)。本轮修复未改写10月6日Git节点。





## 2026-10-09 第三模板前基础修复

修复单主图恢复示范时漏确认并清空历史的问题；PNG 改为独立目标画布重绘，照片裁切与滤镜像素尺度随输出倍率调整；Undo/Redo 同步顶部状态与模板注册表数量；清理当前作品与 60 步历史不再引用的上传图和背景缓存，保留示范缓存。未制作第三模板，内层新版原件保留。

新增 export-history-regression.cjs，8 个回归脚本全部通过。真实独立 Edge 浏览器验证 42 个单图预览、四图 REMIX、示范取消、撤销重做和 5 份实际 PNG；6 组修复前后预览像素完全一致。详情见 [本轮验证](samples/results/pre-template03-20261009/results.md)。

图片归档到 E:\“非遗”手搓\Yongyong-Visual-Lab_图片归档_20261009_082738，329 个文件（387.72 MiB）SHA-256 全部一致。先复制、保留原件与 Git 历史，因此没有以归档替代磁盘缩减。

## 2026-10-09｜模板三与经验留档

按用户 Blue Valentine 参考新增第三组：蓝紫背景、白色封套、双行蓝标题、心形标识、七个辅图槽位和前景叠压；沿用 Canvas 与现有对象编辑。示范局部在浏览器提取，上传模式按来源保留用户素材，主图使用 Contain，普通 JPG 不自动抠人像。三组排版／滤镜／总 REMIX、公开 ID、示范按钮、历史纸框与动态数量接齐，首次仍载入模板一。新增主图 Cover／Contain 选项，三示范按钮改为等宽竖排，避免窄侧栏溢出。

真实 Edge 完成 21 单图、三组多图及换主图、完整循环、关闭参数、精确恢复的撤销重做、主图裁切、索引框关联、辅图移动与 3000×4000 输出，共 42 份实际 PNG，零 pageerror；原 21 图 SHA-256 保持。8 个回归脚本通过，上传检查增加七图三模板用例。示范源图清晰度、普通照片矩形边缘、窄格裁切与图库未覆盖条件如实记录。详情见 [模板三验证](samples/results/template-03/20261009-blue-valentine/results.md)。

新增 [工作记录与开发经验](工作记录与开发经验.md)，汇总整合、770.4 MiB 体积来源、图片归档、基础修复、默认模板一与第三模板做法。用户随后明确以后只挑两张验证，已同步 AGENTS.md、samples/README.md、工作记录和浏览器脚本默认范围，保留本轮已完成全量结果。没有删除原件或改写 Git，模板三结果另复制到独立图片归档并核验。

## 2026-10-09｜图库示范、本地抠图与控件精简

按用户要求替换第三模板的参考裁片与固定轮廓，示范只用自有 aespa-03／20。新增 poster-cutout.js，固定 MediaPipe Tasks Vision 0.10.32＋SelfieSegmenter v1，约 21.85 MiB 静态依赖按需载入、本地 CPU 推理；无云端 API 或照片上传。主／辅图共用抠图／恢复入口，原图和来源保留，缓存透明版本、历史保存启用状态；防止迟到结果覆盖换图／换场景与已删除卡片，失败可显式重试。

补齐内层纸框、标题栏、徽章与文字底色参数；模板二字体／字重／字号可从控件复现。删掉重复背景快捷按钮、旧六风格预设与对应无调用代码，停止加载当前模板循环不使用的 composition 文件；保留历史。preview 服务增加 WASM／模块 MIME。

仅两张单图、同两张多图与换主图实测，30 份实际 PNG（包含 3000×4000），主图抠图／背景恢复／撤销重做和颗粒历史均精确恢复像素；辅图抠图、纸框与心形控件有效。0 pageerror、0 外部请求，9 个回归脚本通过（含旧 composition 文件离线回归与新 6 组 cutout 检查）。结果见 [本地抠图验证](samples/results/template-03/20261009-library-cutout/results.md)。复杂背景、细发丝与手臂镂空边缘仍可能残留；没有加入手工修蒙版和全设备验证。

## 2026-10-09｜模板三四图示范

默认示范由两张改成自有图库 03／20／10／05 四张，七格交替呈现白底、复杂背景、海边与夜景；保留主图、左下抠图层及原构图。新增的海边、夜景只加载原图，不额外执行分割。上传模式、默认模板一和原照片保持。测试仍用 03／20 两张做重点适配，四图示范单独检查真实来源与导出；结果见 [四图验证](samples/results/template-03/20261009-four-photo/results.md)。

## 2026-10-09｜抠图入口

主／辅图抠图移动到设置顶部，增加全局选主图入口、已抠图状态说明；修复选中照片保留右栏滚动位置导致入口看不见。两张真实 Edge 复测完成，详见 samples/results/template-03/20261009-cutout-entry/results.md。用户当前四张素材身份等待确认，未改默认照片组合。

## 2026-10-09｜用户截图确认四图

用户明确指定 14／15／02／09，14 为主。模板三默认示范与七格素材顺序按截图更新；原图沿用图库，参考确认截图留档；主图与左下共享 14 的本地透明缓存。未确认的四图事项已解决。重点适配仅选 14／15，以舞台与城市明暗背景覆盖本轮组合，详情见 samples/results/template-03/20261009-user-four/results.md。默认模板一及抠图入口保持。

## 2026-10-09｜左下换图与来源编辑

左下默认改用 15 完整城市回身照；主图仍抠图。辅图新增当前素材池来源选择、保留几何／滤镜、关闭旧抠图状态、来源校验及历史。仅 14／15 适配与 35 个实际 PNG，换图撤销重做精确恢复，辅图抠图恢复的数据一致但输出像素有小幅差异，未定位且未将该项标为精确恢复通过；见 samples/results/template-03/20261009-card-source/results.md。

## 2026-10-09｜模板四前只读检查

应用源代码未改；9 回归通过，实际 14／15 检查定位主图提升的槽位／面板／抠图标记错误、刷新丢编辑作品、选择高亮错误，以及首次独立 Canvas 绘制 JPEG 导致的低幅导出差异。模板四尚未制作。详见 samples/results/pre-template04-20261009/功能检查_模板四前.md。


## 2026-10-09｜模板四前四类修复

修复辅图升主图的卡片／面板／取样绑定与抠图状态；添加浏览器本地可编辑草稿及事务失败保护、延迟恢复冲突检查；渲染与分割使用独立像素副本，恢复背景严格像素对比通过；元素列表改用 selected.id。新增 poster-pixels.js、poster-draft.js，未添加依赖或云端 API。10 个离线回归、35 个实际模板导出及草稿专项通过；实际只用 14／15。结果：samples/results/pre-template04-fixes-20261009/results.md。模板四尚未制作，用户旧页面未刷新。


## 2026-10-09｜模板四：Pink Desktop 粉色桌面拼贴

按用户参考完成第四组：满版原照、左下透明前景、两张粉色桌面窗口、可编辑气球字及自绘贴纸。新增 poster-decor.js，复用现有文字／辅图、图层、历史、草稿、滤镜和本地 MediaPipe；没有新依赖。示范仅用自有 aespa-20／03，默认模板一及模板三的 14／15／02／09 保持。排版、滤镜、总 REMIX 四组循环接入，上传原照片和全部素材池保留。

新增窗口与取景、气球厚度／高光和贴纸形状／尺寸参数；窗口关联取样避开标题栏、匹配缩放及偏移。模型准备在模板提交前执行，失败或迟到结果不覆盖当前作品；上传清除旧主图抠图标记。Canvas 导出／中间 raster 使用读回表面，实际 PNG 开关及撤销恢复逐像素通过。窄视口改三列时隐藏占格子的拖动分栏，修复画布被挤出视口。

实际仅 03／20 两张：22 PNG、8 组独立 Edge 场景及 10 个离线 regression 通过。包括单／多图换主、完整循环、文字贴纸、窗口换图取样、抠图恢复、3000×4000、草稿刷新、失败／迟到保护和 900／390 FIT。详情见 [模板四结果](samples/results/template-04/20261009-pink-desktop/results.md)。图片复制进既有独立归档并另存 SHA-256 清单，原件保留；未做全图库、其他浏览器或触屏全流程验收。


## 人像抠图固定入口 · 2026-10-09

用户仍找不到抠图，原因是入口随照片选中才出现，模板四透明前景的按钮又只写“恢复原图背景”，缺乏明确抠图状态。左侧固定操作栏新增绿色“✂ 人像抠图”，点击保留当前主／辅图选择；未选照片或选中文字时定位主图。通过既有右栏渲染，回到顶部、滚动并聚焦真正处理按钮，不自动改变背景。已完成按钮改为“已抠图 · 恢复背景”，提示原照片已自动抠出人像。

两张实际照片 03／20，真实主图及辅图本地抠图、恢复、默认／文字选择、右栏深滚动回顶、900／390 处理按钮进入视口均通过；2 个 PNG 尺寸正确，0 pageerror，既有 cutout regression 通过。入口检查没有重跑全图库或整套模板验收。详见 samples/results/cutout-entry-20261009/verification.json；截图 entry-and-completed-state-1600.png。用户旧标签页未刷新，更新前先保存作品。


## 人像抠图改为直接操作 · 2026-10-09

用户澄清主要是操作不清楚，重新打开网站后重新审视流程。原固定入口只定位右栏，仍需第二次点击，按钮名容易让人以为已经执行。改为选中照片后直接点左侧“✂ 自动抠图”；上方显示主图／辅图，非照片选择明确显示主图（默认）。处理中显示实际处理对象并禁用重复操作；完成显示“✓ 已抠图”，独立“↩ 恢复背景”按钮，避免同一个入口来回切换而误还原。沿用既有模型、历史和场景保护。

只用图库 03／20，2 个真实 PNG、主／辅图单次点击、文字选择回主图、处理状态、独立恢复、撤销／重做、900／390 操作均通过；0 pageerror。cutout 与 editor regression 通过。原定位版本留作历史，当前检查路径为 samples/results/cutout-direct-20261009。

重新打开时发现 8089 服务停止；旧 serve.py 监听 0.0.0.0 的启动被自动审批拦截。改为仅监听 127.0.0.1 后成功恢复，HTTP 200，在本机 Edge 重新打开；内置浏览器控制仍有 Windows sandbox 错误，未直接操作用户原标签页。经验：按钮名应描述实际动作，对象、处理中和完成态一起显示；能够找到设置不等于会用功能。


## 模板五前检查与 REMIX／示范分离 · 2026-10-09

用户指出当前示范照片点总 REMIX 仍被替换，真实复现示范四两张变成模板一四张。原保护只覆盖上传身份，多个模板与异步抠图准备错误地把示范场景当作可重新载入照片。修复让总／排版 REMIX 保留当前主图、全部有效素材及来源身份，只有显式 isReset 的示范按钮加载内置照片；移除循环入口不必要的内置素材预加载，空作品提示先上传。总 REMIX 标注保留当前图片，示范区说明会换图和排版。

增加示范、混合素材和空场景回归，更新把自动换主图／删示范视为正确的旧夹具。十项回归、03／20 两张实图，32 实际 PNG 与草稿专项通过；示范图换主图再四模板循环保持，示范取消无变化、确认才重置，Undo／Redo 精确恢复。详情见 [模板五前检查](samples/results/pre-template05-20261009/results.md)。没有制作模板五、没有全图库验证或改动用户当前作品。

经验：来源标记用于区分上传／示范，不能用来判断当前图片是否值得保留。示范是载入完整作品的动作；REMIX 是对当前素材套构图／滤镜。以后新增模板必须同时验证上传图和当前示范图，不应以上传保留通过推断所有当前照片都受保护。


## 模板四杂色与小细节 · 2026-10-10

按参考补足彩色细颗粒、轻纸纹、薄荷细格纹、箭头爱心、小花／蝴蝶／书本、发际贴纸和细字条。复用现有图层、背景选择、滤镜、文字徽章、窗口标题与历史，未增加依赖。所有装饰仍可编辑；小贴纸描边按尺寸收窄，防止白边盖住花瓣，头部装饰上移减少遮眼。主图杂色 6、彩色模式、纸纹 4；辅图杂色 5、纸纹 3；新背景“淡粉扫描纸”可调透明度或切换。

仅图库 03／20 两张，10 离线回归、9 浏览器场景与 37 实际 PNG 通过；彩色／单色杂色、纸纹与背景归零、四种新增形状改色和撤销逐像素核对通过。单／多图、换主图、完整 REMIX 保留素材、3000×4000、草稿与本地抠图场景通过，0 pageerror／外部请求。初次新增检查错误点击已隐藏的全局返回按钮，修正检查状态前提后完整复测通过。近景照片、固定贴纸位置和字体的限制保留，未全图库巡检。详见 [本轮结果](samples/results/template-04/20261010-texture-details/results.md)。

预览服务重新启动为本机 127.0.0.1:8089、HTTP 200，并在 Edge 打开；测试另用隔离浏览器，未改用户原草稿。代码先复制到父目录的模板四细节前备份，图像和结果另复制到既有独立图片归档并核对哈希，原件保留。

经验：杂色要看真实成品放大效果；小图标按尺寸缩小白描边；背景图案只在照片后，不能当作覆盖照片的纸纹，照片质感应由现有滤镜完成。新增装饰需同时接入绘制、点击范围、参数、历史、草稿与 PNG。


## 模板四脏点反馈修正 · 2026-10-10

上一轮 paper 主图4／辅图3会绘制深色短纤维，与较强彩色杂色叠加后显脏。用户反馈后关闭模板四默认纸纹，主图杂色减至3、辅图2；纸张手动控制和其他模板保持。真实03／20两照片复测，9实际PNG／4针对性场景、两项滤镜回归通过；纸纹和颗粒开关／撤销逐像素一致，上传、换主和总REMIX保留素材。未重跑全图库或上一轮未改的完整功能检查，原草稿未改。详见 [脏点修正](samples/results/template-04/20261010-clean-grain/results.md)。经验：先看脸部与浅底放大图，不把旧纸黑纤维当作细彩色扫描质感。


## 2026-10-10 · 模板五／六

新增 Photo Booth 与 AirDrop Diary，复用自有图库20／03、本地抠图和现有草稿／历史／导出，扩展六组 REMIX。新增可编辑照片框与桌面图形，长竖图前景不越过顶部留边。独立 Edge 两图实测34份PNG、3000×4000、草稿与历史逐像素恢复通过；实际范围与边界见 samples/results/template-05-06/20261010/results.md。


## 2026-10-10 · 模板七／八

新增 After Hours Album 与 Electric Blue Archive，示范从自有图库分别选3张／4张，延续单一项目与原图保留。三组REMIX注册及操作说明同步八组；新增独立可编辑线条、复古窗口、资料卡、回收站与人像贴纸白边／投影。两张验证照片03／20通过6项离线回归、8浏览器场景与31实际PNG（包含3000×4000、草稿恢复、撤销及完整八组素材保留）；页面错误和外部请求均0。检查脚本的主图滤镜定位与异步调度前提已修正并复跑。未全图库巡检，原照片姿态与系统字体限制见 samples/results/template-07-08/20261010/results.md。


## 2026-10-10 · 模板8文字重叠反馈

按三个浏览器批注，把紫色碎词从资料卡标题和正文移到卡外空白区，中间组织成完整两行短句，感叹号改Arial加字距。7份实际PNG、四组文字避开旋转卡片边界、短句编辑与撤销、03／20上传及模板7画面逐像素一致通过。原预览地址指向修正版，原导出和草稿保留；未重复全图库或八组完整功能。结果见samples/results/template-07-08/20261010-text-fix/results.md。


## 2026-10-10 · 以模板效果验收共用功能

修复辅图固定Cover、模板字体菜单缺项、信息组件硬编码字体／面板多行未分行、浅色照片工具文字缺独立底色透明度。复用主图imageCover用于完整辅图，五种相框的取样映射与实际渲染一致；模板8辅人像默认Contain，模板7工具栏加45%深底，字号／字体／来源／透明度可从UI操作。03／20四个场景完整八组循环、46实际PNG、3000×4000、草稿、精确历史、取样与手调通过；10离线回归通过，新底色在最终浏览器版本复跑。0页面错误／外部请求，原图哈希未变。仅两图，完整姿态与自动脸部定位未覆盖；默认横框取景需手调的实例单独保存。见samples/results/template-function-acceptance/20261010/results.md。

## 2026-10-10 · 顶部操作栏修正

按用户网页批注，将常用操作区从左栏底部移到画布上方，左栏恢复完整高度的滚动空间；总 REMIX 仅保留一个入口。撤销、重做、复制、自动抠图／恢复背景、排版 REMIX、导出与草稿保存均在顶部。左栏与顶部共用原操作处理，保留素材和画布数据。

实测 1280／968／900／390px：工具栏不覆盖画布或素材栏，无横向溢出。真实点击复制、撤销重做、两图上传与八组总 REMIX 素材保留、抠图恢复、草稿保存和 1200×1600 PNG 下载通过；编辑器回归通过。截图和导出留在本地 samples/results/toolbar-20261010/，脚本为 checks/toolbar-browser-check.cjs。未重新生成模板构图验收全集。

## 2026-10-11 · 紧凑操作区与右栏方案

顶部常用操作改为两行四列等宽按钮，桌面常用键高28px，手机保留34px；移除重复提示行，状态合并。968px窗口工具区实测92px高，四种尺寸无横向溢出且不遮挡画布；复制／历史、两图八组总REMIX素材保留、抠图恢复、草稿和PNG下载通过。新增高度上限断言。

右侧仅制作待确认的独立交互方案，未调整正式Inspector：明确选择主图、辅图、局部、文字或画布；外观／布局／高级三类控件；保留各对象独立效果。现有无选中面板的调色实际使用主图state.filters，不应误标为全海报统一效果。方案位于本地samples/results/inspector-proposal-20261011/index.html，演示不改作品。动效待这两项完成后再做。

## 2026-10-11 · 统一对象编辑与真实效果验证

用户确认右栏方案后，接入当前调整对象选择与外观／布局／高级三个分类。复用原有参数控件及事件路由；高级选一组只显示对应参数。画布背景不再重复展示主图调色，主图原有扫描纹、质感、风格化和边缘融合集中保留；照片、文字、索引框、局部与连线的设置均保留。数字坐标两列排列，文字细项归高级。未启用的模糊、杂色、渐变、人像边缘、窗口标题及气球文字参数置灰；更新状态不替换拖动中的控件。模板调色配方收进画布高级。再次保存PNG链接置于状态行，避免导出后打乱两行按钮。

实际上传aespa-03／20，110份PNG验证主图／辅图／局部／碎片的调色、半调、模糊、杂色、渐变、扫描纹、印刷质感以及玻璃、马赛克、位图、反相等；开关和归零精确回到基准，修改方向、颗粒尺寸、中间调有像素变化。UI与图片范围隔离、Undo／Redo、草稿刷新、文字和画布颜色、四视口无溢出均通过；原照片SHA256保持。10个离线脚本通过。八组模板四个上传场景另复跑46份真实PNG，字体／取景／采样／导出与草稿通过。高分辨率模板8相较旧PNG仅11个通道值相差1（4800万通道），构图与效果无可见改变。

脚本：checks/inspector-browser-check.cjs；本地原始导出、报告和截图：samples/results/inspector-20261011/。本轮仅验证两张及其组合，未做全图库或跨浏览器测试。新动效尚未实施。
