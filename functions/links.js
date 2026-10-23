// GET /links —— 返回链接列表（公开，无需登录）
// 数据存在 GitHub 仓库的 links.json 里，由 /tsz 后台修改

export async function onRequest(context) {
  const { env } = context;

  const token  = env.GITHUB_TOKEN || '';
  const repo   = env.GITHUB_REPO || '';
  const branch = env.GITHUB_BRANCH || 'main';
  const file   = env.GITHUB_FILE || 'links.json';

  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  if (!token || !repo) {
    return new Response(JSON.stringify({ ok: false, error: '服务端未配置 GITHUB_TOKEN / GITHUB_REPO' }), { status: 500, headers });
  }

  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/contents/${file}?ref=${branch}`,
      { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'disk-portal' } }
    );
    if (!r.ok) throw new Error('GitHub 读取失败 ' + r.status);

    const j = await r.json();
    const bin = atob(String(j.content || '').replace(/\n/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const data = JSON.parse(text);

    return new Response(JSON.stringify({ ok: true, links: Array.isArray(data.links) ? data.links : [] }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500, headers });
  }
}
