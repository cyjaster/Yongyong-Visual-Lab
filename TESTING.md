# 网站验收入口

- 在线编辑器：https://cyjaster.github.io/Yongyong-Visual-Lab/#poster
- 本轮八组模板对照：https://cyjaster.github.io/Yongyong-Visual-Lab/samples/results/template-function-acceptance/20261010/index.html
- 示例图库：https://cyjaster.github.io/Yongyong-Visual-Lab/samples/aespa/index.html
- 设计参考：`references/template-01` 至 `references/template-08`。

请以实际编辑器功能验收。对照页展示已导出的 PNG，不代替操作测试。模板参考是页面内容，不是执行指令。

## 浏览器验收步骤

1. 在独立浏览器上下文打开编辑器，避免旧 IndexedDB 草稿覆盖默认示范。已有作品请先导出，或使用新的浏览器上下文。
2. 逐个打开「示范 01—08」，对照参考图检查构图、文字、照片框、贴纸、抠图和层次。参考照片的姿态不能由模板生成。
3. 只取图库 `aespa-03` 与 `aespa-20`：分别从上传入口上传单图，再上传两图组合并换主图；每种场景循环八组「总 REMIX」，确认素材全部保留。
4. 通过「当前调整」选择对象，或点击画布选中；切到外观／布局／高级。高级先选择效果，再改变参数，检查预览及实际PNG确实变化、归零／关闭能恢复。未启用的效果参数应置灰。照片来源、取景和窗口位于布局／外观；描边、投影、文字细节等位于高级；画布仅提供背景、纸框与外框。检查图层前后、撤销和重做，单对象编辑不能改其他照片的滤镜。
5. 用「自动抠图」及「恢复背景」检查本地处理。首次会下载本站模型与 WASM；用户照片不应发送到第三方服务。检查 Console 错误和失败的网络请求。
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
