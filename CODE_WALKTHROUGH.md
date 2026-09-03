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
