[[English](./README.md)] | [简体中文]


# 游戏简介

人类正面临"吧唧嘴"（Byagee mouth）的严重威胁。当物种咀嚼时张嘴，核爆般的噪音会蒸发所有血液。

作为正义之士，你试图对抗这无尽的噪音。你将在公共场合维护社会秩序与安宁——但新的"吧唧嘴"仍会偶尔出现。你必须奋力战斗，确保自己咀嚼时嘴唇紧闭。

疯狂吧！奋力战斗！

# 部署

本文件夹包含 Civic Man 的预构建静态文件。无需后端，无需服务器端逻辑——只需将这些文件上传到任意静态托管服务即可。

## 文件结构

```
Deployment/
├── index.html          # 入口文件
├── manifest.json       # PWA 清单
├── favicon.svg         # 网站图标
├── icons.svg           # 图标精灵图
└── assets/
    ├── index-*.css     # 编译后的样式
    └── index-*.js      # 编译后的游戏（Three.js + React + Zustand）
```

所有路径均为相对路径（`./`）——可在域名根目录或任意子目录下运行。

## 快速部署

### 任意静态文件服务器

```bash
cd Deployment
npx serve .
# 或
python -m http.server 8080
```

### Nginx

```nginx
location /civic-man/ {
    alias /var/www/civic-man/;
    try_files $uri $uri/ /civic-man/index.html;
}
```

### Cloudflare Pages / Netlify / Vercel

上传 `Deployment/` 文件夹作为站点根目录即可。无需构建命令。

### Docker

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
```

## 运行要求

- HTTPS（部分浏览器需要以使用 TTS `speechSynthesis` API）
- 支持 WebGL 的现代浏览器
- 无需数据库，无需 API 密钥，无需环境变量

## PWA

游戏包含 `manifest.json`——用户可在移动端"添加到主屏幕"，或在桌面端 Chrome/Edge 上"安装"，以获得类似原生应用的体验。
