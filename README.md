# Disk Portal

网盘入口列表 + 后台管理。

- 首页 `https://disk.tszheoi-law.top` —— 左侧名称、右侧链接，点击跳转
- 后台 `https://disk.tszheoi-law.top/tsz` —— 密码登录，添加/删除/排序

## 架构

```
浏览器 → Cloudflare Pages（静态页 + Functions）
           ├── GET /       public/index.html（列表页，前端 fetch /links）
           ├── GET /links  functions/links.js（读 links.json）
           └── /tsz        functions/tsz.js（登录 + 增删改）
                                 ↓
                        GitHub 仓库的 links.json（数据源）
```

## 文件

```
links.json            链接数据（后台改这个文件）
public/index.html     列表页
functions/links.js    公开只读接口
functions/tsz.js      管理后台
```

## Cloudflare Pages 配置

- 构建命令：**留空**（纯静态，无构建）
- 构建输出目录：`public`
- Functions 目录：仓库根目录的 `functions/`（自动识别）

## 环境变量

| 变量 | 说明 |
|---|---|
| `ADMIN_PASSWORD` | 后台密码 |
| `ADMIN_SECRET` | 会话签名密钥（任意长随机串） |
| `GITHUB_TOKEN` | GitHub PAT（repo 权限） |
| `GITHUB_REPO` | `Tszheoi/disk-portal` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_FILE` | `links.json` |

## 数据结构

```json
{
  "links": [
    { "name": "夸克网盘", "url": "https://pan.quark.cn", "note": "Quark Disk" }
  ]
}
```
