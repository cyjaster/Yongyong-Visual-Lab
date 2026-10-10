# 怎么读懂这个 Demo

> 暂停使用：本文档对应第一版单图预览结构。2026-09-03 已改为“整张配方卡实时预览”，待新版排版确认后再重新编写教学版本。

不要试图从 `app.js` 第一行一路硬啃到最后一行。先建立一张“数据怎样流动”的地图：

```text
用户操作
   ↓
事件监听器（EVENTS）
   ↓
修改 state
   ↓
renderPreview / renderLayers（RENDER）
   ↓
Canvas 与页面更新
   ↓
需要时由 EXPORT 生成独立下载画布
```

## 第一遍：只读 HTML，认识零件

打开 `index.html`，先搜索这些 id：

- `previewCanvas`：滤镜实时预览画布。
- `layerList`：JavaScript 会把每一个图层塞进这里。
- `imageInput`：选择本地图片的隐藏输入框。
- `exportCardButton`：触发配方卡导出。

HTML 不知道滤镜怎样算，它只声明“这里有一个画布”“这里有一个按钮”。

## 第二遍：在 app.js 找到数据真相

搜索 `const state`。里面只有四类核心数据：

```js
const state = {
  name: "bloom study",
  image: null,
  showOriginal: false,
  layers: [...],
};
```

每一个颜色图层也是普通对象：

```js
{
  color: "#F58F9B",
  mode: "soft-light",
  opacity: 40,
  visible: true
}
```

这是整个项目最值得学习的设计：页面元素不是数据本身，`state` 才是。滑杆变化时先更新 `state`，然后重新渲染。

## 第三遍：理解 Canvas 混合

按下面顺序读四个函数：

1. `drawCover()`：计算图片怎样居中裁成指定比例。
2. `applyLayers()`：依次覆盖纯色，并设置混合模式与透明度。
3. `renderImage()`：先画照片，再决定是否调用 `applyLayers()`。
4. `renderPreview()`：把结果放到页面的预览画布。

其中真正完成滤镜计算的是：

```js
targetCtx.globalCompositeOperation = BLEND_MODES[layer.mode];
targetCtx.globalAlpha = layer.opacity / 100;
targetCtx.fillStyle = layer.color;
targetCtx.fillRect(x, y, width, height);
```

可以把它翻译成人话：

> 接下来的颜色块使用 Soft Light 等方式与下面的照片混合；透明度设成 0—1；最后铺满指定区域。

`save()` 和 `restore()` 很重要。它们像 Photoshop 中“只让本次设置作用于当前图层”，避免一个图层的透明度污染后面的绘制。

## 第四遍：挑一个交互追踪到底

建议从“不透明度滑杆”开始：

1. HTML 图层模板产生 `data-action="opacity"` 的滑杆。
2. `layerList.addEventListener("input", ...)` 捕获变化。
3. `updateLayer()` 找到对应图层并修改 `opacity`。
4. `renderPreview()` 重新绘制。

这叫事件委托：不是给每一个图层分别装监听器，而是只监听共同的父元素 `layerList`，再通过 `event.target` 判断是谁发生变化。动态添加的新图层也会自动生效。

## 第五遍：理解为什么导出不截图页面

搜索 `exportCardButton`。导出时会新建一张 1080 × 1440 的 Canvas：

```js
const card = document.createElement("canvas");
card.width = 1080;
card.height = 1440;
```

之后把原图、效果图、色块与文字重新画上去。这样导出分辨率不受电脑屏幕大小、浏览器缩放和 CSS 布局影响。它比“截网页”稳定得多。

## 代码里最应该注意的五件事

1. **图层顺序**：`state.layers` 是从底到顶；面板用 `reverse()` 仅反转显示，不能把原数组也反转。
2. **Canvas 状态隔离**：每次改变混合模式和透明度都要配对使用 `save()` / `restore()`。
3. **文件隐私**：照片通过 `FileReader.readAsDataURL()` 直接进入内存，没有上传请求。
4. **色彩差异**：Canvas 与 Photoshop 的色彩空间和伽马处理可能不同，不能承诺像素级一致。
5. **导出尺寸**：预览 Canvas 与导出 Canvas 是两个目标；共用 `renderImage()` 才能减少“两边效果不一致”的错误。

## 最适合你的三个小练习

1. 在 `BLEND_MODES` 和 `BLEND_LABELS` 中加入 `hard-light`。
2. 修改配方卡右栏的字体大小和间距，观察导出结果。
3. 给每个图层增加一个可编辑名称，例如“粉色柔光”，并把名称写进 JSON。

完成这三个练习，你就基本掌握了这个项目的数据结构、界面事件和 Canvas 输出链。


## 2026-10-09：像素源与可编辑草稿

poster-pixels.js 在照片首次渲染前缓存画布和首次解码像素；copyPixels 向分割提供独立 RGBA 副本，不能再次读共享渲染画布。poster-cutout.js 仍按需加载本地 MediaPipe CPU，分割使用独立画布。

poster-draft.js 只负责 IndexedDB current 记录事务；poster.js 复用 snapshot／restore 收集照片、正在使用的透明缓存、背景与导出尺寸，排队保存，并在事务成功后更新状态。commit／restore／分辨率编辑触发保存；失败保持 dirty 和 beforeunload 保护。initializePoster 校验并解码后恢复，snapshot 冲突保护新上传；无草稿回到模板一。只保存当前作品，刷新前的历史不序列化。


## 2026-10-09：第四组模板与装饰渲染

poster-decor.js 提供 PosterDecor.draw／bounds：特殊气球字与八种原生 Canvas 贴纸共用现有 Text 对象；badgeWidth／Height 决定图形大小，bounds 让点击图形本体能选中。普通文字仍走原渲染路径。poster.js 的 applyLayoutTemplate04 组织主图、三个辅图和装饰；applyFilterTemplate04 只设置调色，三个模板注册表均增加第四组。

preparePinkDesktop 按上传／示范身份加载主图并调用既有本地分割；前后比较 snapshot，准备成功才执行模板回调。示范 04 来源固定为自有图库 20／03；总 REMIX 保留上传素材，示范按钮显式重置。默认初始化仍为模板一，已有 IndexedDB 草稿优先恢复。

drawSecondaryImage 将 windowFrame 的标题栏从照片高度里扣除，按 zoom／pan 限制有效裁切，再画标题栏。sourceRect 为关联取样复用照片区域与裁切参数，旋转围绕完整卡片中心。Inspector 增加窗口／取景、气球字／高光及贴纸形状等现有字段控件，继续通过统一输入与历史保存。

renderExportCanvas 和 raster 的 2D 上下文使用 willReadFrequently，当前 Edge 实测避免局部窗口／渐变文字的重复导出差异。poster.css 的 1040px 三列断点隐藏两条分栏把手。真实行为检查在 checks/template04-browser-check.cjs，只上传 03／20 并下载 PNG；离线回归补窗口取样几何与四模板循环。


## 2026-10-09：当前素材与示范来源分开

cycleMasterRemix／cycleLayoutRemix 直接调用模板，不加载别组示范；resolveSlotAssetIds 及模板 02／03／04、第四模板准备改为按当前照片存在且非显式重置判断保留。hasUserUploadedImages 保留给真正的首次上传、启动保护等来源判断。旧变量 isUserMode 在排版分配中现在表示保留当前照片，不表示将示范标成上传。显式 loadDemo 的 isReset=true 才进入内置素材分配。checks/pre-template05-remix-browser-check.cjs 以示范四自身的 20／03 原照片执行循环、换主、取消／确认示范、导出和草稿检查。


## 2026-10-10：模板四细颗粒与新图形

poster-decor.js 的 shapes、sticker 与 bounds 接入 heart-arrow／flower／butterfly／book，poster.js 的徽章选择同步列出。checker 接收 badgeColor，burst 使用薄荷细格纹；图标白描边按 badge 尺寸缩小。applyLayoutTemplate04 更新装饰坐标、细字与窗口标题；applyFilterTemplate04 使用原噪声参数和彩色模式、轻纸纹。drawPosterBackground 新增 pink-paper 固定种子图案，复用 backgroundTextureOpacity 和 Inspector 背景选择。统一状态快照与草稿直接保存这些已有字段，不新增序列化分支。检查脚本输出改为日期目录 20261010-texture-details，并增加参数关闭与新图形改色的实际 PNG 断言。
