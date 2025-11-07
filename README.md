# Bilibili Lottery Local Extension

本项目基于 `bilibili_dynamic_lottery` 的 Vue 前端，移除了 PHP 后端，改造成一个完全在本地运行的浏览器插件。插件直接调用哔哩哔哩公开接口（评论、转发、点赞等），所有请求都通过用户自己的登录态发出，不经过第三方服务器。

国内下载链接https://www.modelscope.cn/models/sakmist/Bilibili-Lottery-Local-Extension/resolve/master/Bilibili-Lottery-Local-Extension.zip
## 功能亮点

- 解析视频 / 动态链接，显示作者及互动数据。  
- 一键拉取评论列表，可选同步校验点赞、转发完成情况。  
- 内置抽奖与过滤器：等级、会员、评论时间段、是否原创评论、粉丝状态等。  
- “检测是否粉丝”功能会直接调用官方关系接口，需要你已登陆 B 站账号。  

## 开发环境

1. 安装依赖：

   ```bash
   npm install
   ```

2. 本地调试（Vite 开发服务器）：

   ```bash
   npm run dev
   ```

3. 构建插件发行包：

   ```bash
   npm run build
   ```

   构建完成后，`dist/` 目录即为可加载的浏览器扩展。`public/manifest.json`、`background.js`、图标等会自动被拷贝到 dist 中。

## 浏览器加载方式

1. 运行 `npm run build` 生成最新的 `dist/`。  
2. 打开 Chrome / Edge 扩展页面（`chrome://extensions` 或 `edge://extensions`）。  
3. 打开「开发者模式」，点击「加载已解压的扩展程序」，选择 `dist/` 目录。  
4. 在浏览器正常登录 B 站后，点击插件图标即可使用；如需要刷新登录状态，可点击右上角用户名。

## 版本校验与一键下载

- 插件启动后会访问 `VITE_VERSION_CHECK_URL`（默认指向 ModelScope 中的 `verson` 文件）同步远程版本号，并在页面底部展示当前版本与本地 MD5。  
- 若检测到远程版本不同，会弹出提示弹窗，请点击「立即下载」后手动在浏览器保存新版压缩包，并前往 `chrome://extensions` 替换。  
- 下载完成后会记录压缩包 MD5、体积与下载时间，方便复核；你也可以再次点击底部按钮重新拉取。  
- 需要自定义版本源或下载地址时，可在 `.env` 中调整 `VITE_VERSION_CHECK_URL`、`VITE_UPDATE_PACKAGE_URL` 与 `VITE_UPDATE_PACKAGE_FILENAME`。

## 注意事项

- 插件直接访问 `https://*.bilibili.com` 与 `https://passport.bilibili.com`，请确保扩展的 Host 权限已启用。  
- 自动更新功能会访问 `https://www.modelscope.cn` 获取版本号与最新安装包，请在浏览器中放行该域名。  
- 想要调用粉丝关系与评论等接口，必须保持浏览器处于登录状态。插件不会保存、转发或托管任何 Cookie。  
- B 站对接口有频率限制，请避免在短时间内反复抓取大量数据，以免触发风控。  

## 参考

- 原项目：`bilibili_dynamic_lottery-master`
