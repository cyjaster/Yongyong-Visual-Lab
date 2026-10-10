# 本地人像分割依赖

固定版本：MediaPipe @mediapipe/tasks-vision 0.10.32；SelfieSegmenter square float16 模型版本 1。

- SDK：[npm 发布包](https://registry.npmjs.org/@mediapipe/tasks-vision/0.10.32)。下载 tarball 的 SHA-512 已与 npm integrity 核对一致。
- npm integrity：sha512-3tiAZnmKloYnRXYoO3dKltTUGnqeCwzC4lV03uY0vCsE+aveJTyEVQyZHOlQGQNsjK+gRHzkf9q08C99Qm2K0Q==
- 模型：[官方版本 1](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite)，249537 字节。
- 接入依据：[Google 官方 Web 指南](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js)与[模型说明](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)。实际本地模型返回一通道前景置信度，已在浏览器确认并处理。
- 许可：SDK 包声明 Apache-2.0；[LICENSE](LICENSE)来自 Google MediaPipe 项目。保留打包文件的许可证声明。

vision_bundle.mjs 原字节重命名为 vision_bundle.js，兼容旧本地预览服务的 JavaScript MIME；不改 SDK 内容。只取浏览器 bundle 和 SIMD／非 SIMD 两套 WASM，未放入源码映射或其他任务模型。

本目录依赖文件合计 21.85 MiB。两套 WASM用于兼容不同电脑，首次抠图仅加载可用的一套，后续复用。模型初始化由 poster-cutout.js 按需触发，CPU 推理，无云端 API、API Key 或照片上传。若网站发布到其他服务器，浏览器会从该网站下载静态模型与 WASM，但推理仍在访问者电脑上。

需要通过 HTTP 本地服务／网站打开；不支持在 file:// 下直接加载抠图模块。现有本地预览为 http://localhost:8089/#poster。失败只显示提示，不替换作品；再次点击可以重试，不自动循环调用模型。

## 文件校验

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| LICENSE | 12331 | 8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8 |
| package.json | 592 | 7e2b35c27840238235ae47abad63b5875fb1f8bf013ff4101a3595acea6f8682 |
| selfie_segmenter.tflite | 249537 | 191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b |
| vision_bundle.js | 137160 | de83c48ff329717a27aeb528d5ef5f47f077c628a5302dc483aca5b513e7464b |
| wasm/vision_wasm_internal.js | 204816 | 6f6b86509cf9e163ea1cfec7edc8cf53732699c04781e4c21c557c1ba402310e |
| wasm/vision_wasm_internal.wasm | 11453626 | cb3ec20026a9aecc2a81a93c25630ceb5389297ddb7a5f0bd61dd09cde606b9b |
| wasm/vision_wasm_nosimd_internal.js | 204669 | 9f8fc960e363f0fb2f42f7937b97ae9cf9a5630490f71031fa90caa9bb121938 |
| wasm/vision_wasm_nosimd_internal.wasm | 10647962 | 924274fcd5ac8985f6570a8573e7971b7bd2d580ba1b8f3beb0ba8f95db6347c |
