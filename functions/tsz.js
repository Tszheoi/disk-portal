// /tsz —— 链接列表后台（密码保护）
// 环境变量：ADMIN_PASSWORD、ADMIN_SECRET、GITHUB_TOKEN、GITHUB_REPO、GITHUB_BRANCH、GITHUB_FILE

const COOKIE = 'disk_admin';
const SESSION_DAYS = 30;

// ---------- 工具 ----------
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra),
  });
}
function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: Object.assign({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, extra),
  });
}
function b64decodeUtf8(content) {
  const bin = atob(String(content || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function makeSession(secret) {
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  return exp + '.' + await hmac(secret, String(exp));
}
async function verifySession(secret, token) {
  if (typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const exp = token.slice(0, dot), sig = token.slice(dot + 1);
  const expect = await hmac(secret, exp);
  if (sig.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
  if (diff !== 0) return false;
  return Number(exp) > Date.now();
}
function env(ctx) {
  const e = ctx.env || {};
  return {
    password: e.ADMIN_PASSWORD || '6966@Disk',
    secret: e.ADMIN_SECRET || (e.ADMIN_PASSWORD || '6966@Disk') + '::disk-portal',
    token: e.GITHUB_TOKEN || '',
    repo: e.GITHUB_REPO || '',
    branch: e.GITHUB_BRANCH || 'main',
    file: e.GITHUB_FILE || 'links.json',
  };
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------- GitHub ----------
const ghHeaders = (token) => ({
  Authorization: 'Bearer ' + token,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'disk-portal',
  'Content-Type': 'application/json',
});

async function ghRead(cfg) {
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.file}?ref=${cfg.branch}`, { headers: ghHeaders(cfg.token) });
  if (!r.ok) throw new Error('读取 links.json 失败: ' + r.status);
  const j = await r.json();
  return { data: JSON.parse(b64decodeUtf8(j.content)), sha: j.sha };
}
async function ghWrite(cfg, data, sha, message) {
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.file}`, {
    method: 'PUT',
    headers: ghHeaders(cfg.token),
    body: JSON.stringify({
      message: message || 'update links',
      content: b64encodeUtf8(JSON.stringify(data, null, 2) + '\n'),
      branch: cfg.branch,
      sha,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('写入失败: ' + r.status + ' ' + (j.message || ''));
  return j;
}

// ---------- 页面 ----------
const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#0f1218;color:#e6e8ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.6}
.wrap{max-width:720px;margin:0 auto;padding:24px 18px 60px}
h1{font-size:19px;margin:0}
.top{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid #1e2531;margin-bottom:18px}
.inp{width:100%;background:#151a23;border:1px solid #252c3a;color:#e6e8ee;border-radius:9px;padding:11px 13px;outline:none;font-size:14px}
.inp:focus{border-color:#3b82f6}
.btn{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:14px}
.btn.ghost{background:#1c232f;color:#c3cad8}
.btn.danger{background:#7f1d1d;color:#fecaca}
.btn.sm{padding:6px 12px;font-size:13px}
.row{display:flex;gap:10px;align-items:center}
.item{display:flex;align-items:center;gap:12px;background:#141922;border:1px solid #1e2531;border-radius:11px;padding:13px 15px;margin-bottom:9px}
.item .nm{font-weight:600;flex:0 0 180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .url{flex:1;color:#7dd3fc;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .acts{display:flex;gap:6px;flex:0 0 auto}
.note{color:#6b7488;font-size:12px;margin-left:4px}
.hint{color:#6b7488;font-size:12.5px;margin-top:10px}
.err{color:#fca5a5;font-size:13px;margin-top:10px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e293b;border:1px solid #334155;color:#e6e8ee;padding:9px 16px;border-radius:9px;font-size:13.5px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9}
.toast.on{opacity:1}
@media(max-width:560px){.item{flex-wrap:wrap}.item .nm{flex:1 0 100%}}
`;

const LOGIN = (err) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>链接管理</title>
<style>${STYLE}
.login{max-width:340px;margin:18vh auto;padding:0 18px}
.login h1{font-size:20px;margin-bottom:6px}
.login p{color:#8b93a7;font-size:13px;margin:0 0 20px}
</style></head><body><div class="login">
<h1>链接管理</h1><p>请输入密码</p>
<form method="POST" action="/tsz">
<input type="hidden" name="action" value="login">
<input class="inp" type="password" name="pw" placeholder="密码" autofocus autocomplete="current-password">
<div style="margin-top:12px"><button class="btn" type="submit" style="width:100%">进入</button></div>
${err ? `<div class="err">${esc(err)}</div>` : ''}
</form></div></body></html>`;

const ADMIN = (links) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>链接管理</title>
<style>${STYLE}</style></head><body><div class="wrap">
<div class="top"><h1>链接管理</h1>
<div class="row"><a class="btn ghost sm" href="/" target="_blank">看首页</a>
<button class="btn ghost sm" onclick="logout()">退出</button></div></div>

<div id="list">
${links.length ? links.map((l, i) => `
<div class="item">
  <span class="nm">${esc(l.name)}${l.note ? `<span class="note">${esc(l.note)}</span>` : ''}</span>
  <a class="url" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a>
  <span class="acts">
    <button class="btn ghost sm" onclick="moveUp(${i})">↑</button>
    <button class="btn ghost sm" onclick="moveDown(${i})">↓</button>
    <button class="btn danger sm" onclick="del(${i})">删除</button>
  </span>
</div>`).join('') : '<div class="hint">还没有链接，用下面的表单添加</div>'}
</div>

<h1 style="font-size:16px;margin:26px 0 12px">添加链接</h1>
<div class="item" style="background:#101722">
  <input class="inp" id="nm" placeholder="名称，如 夸克网盘" style="flex:1">
  <input class="inp" id="url" placeholder="https://…" style="flex:1.6">
  <button class="btn" onclick="add()">添加</button>
</div>
<div class="hint">左边名字，右边链接。链接必须带 https://</div>

<div class="toast" id="toast"></div>
</div>
<script>
var links = ${JSON.stringify(links)};
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.className='toast on';setTimeout(function(){t.className='toast'},1800);}
function save(next, msg){
  fetch('/tsz', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({action:'save', links: next})})
    .then(function(r){ return r.json(); })
    .then(function(j){
      if(!j.ok){ toast(j.error||'保存失败'); return; }
      links = next; location.reload();
    }).catch(function(){ toast('保存失败'); });
}
function add(){
  var n = document.getElementById('nm').value.trim();
  var u = document.getElementById('url').value.trim();
  if(!n || !u) { toast('名称和链接都要填'); return; }
  if(!/^https?:\\/\\//i.test(u)) { toast('链接要以 http:// 或 https:// 开头'); return; }
  save(links.concat([{name:n, url:u}]), '已添加');
}
function del(i){
  if(!confirm('删除「' + links[i].name + '」？')) return;
  var next = links.slice(); next.splice(i,1); save(next, '已删除');
}
function moveDown(i){
  if(i >= links.length - 1) return;
  var next = links.slice();
  var t = next[i+1]; next[i+1] = next[i]; next[i] = t;
  save(next, '已排序');
}
function moveUp(i){
  if(i<=0) return;
  var next = links.slice();
  var t = next[i-1]; next[i-1] = next[i]; next[i] = t;
  save(next, '已排序');
}
function logout(){ fetch('/tsz', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({action:'logout'})}).then(function(){ location.href='/tsz'; }); }
</script></body></html>`;

// ---------- 主处理 ----------
export async function onRequest(ctx) {
  const cfg = env(ctx);
  const { request } = ctx;
  const cookies = parseCookies(request.headers.get('cookie'));
  const loggedIn = await verifySession(cfg.secret, cookies[COOKIE]).catch(() => false);

  if (request.method === 'GET') {
    if (!loggedIn) return html(LOGIN(''));

    let links = [];
    try { links = (await ghRead(cfg)).data.links || []; }
    catch (e) { return html(LOGIN('读取数据失败：' + esc(e.message))); }

    return html(ADMIN(links));
  }

  if (request.method === 'POST') {
    let body = {};
    const ct = request.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) body = await request.json();
      else { const fd = await request.formData(); fd.forEach((v, k) => { body[k] = v; }); }
    } catch (e) { return json({ ok: false, error: '请求格式错误' }, 400); }

    const action = body.action;

    if (action === 'login') {
      if (String(body.pw || '') !== cfg.password) return html(LOGIN('密码不对'), 401);
      const token = await makeSession(cfg.secret);
      const cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
      if (ct.includes('application/json')) return json({ ok: true }, 200, { 'set-cookie': cookie });
      return new Response(null, { status: 303, headers: { location: '/tsz', 'set-cookie': cookie } });
    }

    if (action === 'logout') {
      return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
    }

    if (!loggedIn) return json({ ok: false, error: '未登录' }, 401);

    if (action === 'save') {
      const list = Array.isArray(body.links) ? body.links : [];
      const clean = list
        .map(x => ({ name: String(x.name || '').trim().slice(0, 60), url: String(x.url || '').trim(), note: String(x.note || '').trim().slice(0, 40) }))
        .filter(x => x.name && /^https?:\/\//i.test(x.url));
      try {
        const cur = await ghRead(cfg);
        await ghWrite(cfg, { links: clean }, cur.sha, '更新链接列表');
        return json({ ok: true, count: clean.length });
      } catch (e) {
        return json({ ok: false, error: String((e && e.message) || e) }, 500);
      }
    }

    return json({ ok: false, error: '未知操作' }, 400);
  }

  return json({ ok: false, error: 'Method Not Allowed' }, 405);
}
