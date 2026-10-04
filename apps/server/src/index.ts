import {
  draftSchema,
  inspectFont,
  maxFontBytes,
  reportSchema,
  sha256,
  uploadSchema,
  type Account,
  type ExternalFontSource,
  type LibraryFont,
  externalFontDownloadUrl,
} from '@lipiflow/library';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Env {
  DB: D1Database;
  FONT_BUCKET: R2Bucket;
  APP_ORIGIN: string;
  APP_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  RATE_SALT?: string;
  LIPIFLOW_LOCAL?: string;
}
class Failure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new Failure(status, message);
}
const now = () => Date.now();
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
export function localAllowed(env: Pick<Env, 'LIPIFLOW_LOCAL'>, url: URL) {
  return (
    env.LIPIFLOW_LOCAL === '1' &&
    url.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname)
  );
}
export function requireOrigin(request: Request, env: Pick<Env, 'APP_ORIGIN' | 'APP_ORIGINS'>) {
  const allowed = env.APP_ORIGINS ?? env.APP_ORIGIN;
  if (
    !allowed
      .split(',')
      .map((origin) => origin.trim())
      .includes(request.headers.get('Origin') ?? '')
  )
    fail(403, 'This action must come from LipiFlow.');
}
function cookie(request: Request, name: string) {
  return (
    request.headers
      .get('Cookie')
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + '='))
      ?.slice(name.length + 1) ?? ''
  );
}
function cookieHeader(name: string, value: string, url: URL, seconds: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${url.protocol === 'https:' ? '; Secure' : ''}`;
}
async function localSession(request: Request, env: Env) {
  if (!localAllowed(env, new URL(request.url))) return null;
  const token = cookie(request, 'lipiflow_session');
  if (!token || !/^[a-f0-9-]{72,80}$/.test(token)) return null;
  const user = await env.DB.prepare(
    'SELECT users.*, sessions.csrf FROM sessions JOIN users ON users.id=sessions.userId WHERE tokenHash=? AND expires>?',
  )
    .bind(await sha256(token), now())
    .first<Account & { csrf: string }>();
  return user;
}
const firebaseKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);
async function firebaseAccount(request: Request, env: Env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const project = env.FIREBASE_PROJECT_ID;
  if (!project) fail(503, 'Firebase sign-in is not configured.');
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
      algorithms: ['RS256'],
      maxTokenAge: '1h',
      clockTolerance: '5s',
    });
    if (typeof payload.sub !== 'string' || !payload.sub) fail(401, 'Sign in again to continue.');
    return {
      id: payload.sub,
      name: typeof payload.name === 'string' ? payload.name.slice(0, 120) : 'LipiFlow member',
      role: payload.role === 'admin' ? ('admin' as const) : ('user' as const),
      email: typeof payload.email === 'string' ? payload.email.slice(0, 254) : '',
    };
  } catch {
    fail(401, 'Your sign-in expired. Sign in again.');
  }
}
async function authenticated(request: Request, env: Env, admin = false) {
  const user = (await firebaseAccount(request, env)) ?? (await localSession(request, env));
  if (!user) fail(401, 'Sign in to continue.');
  if (admin && user.role !== 'admin') fail(403, 'Admin access required.');
  if (
    user.id.startsWith('local-') &&
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('X-CSRF-Token') !== ('csrf' in user ? user.csrf : '')
  )
    fail(403, 'Refresh the page and try again.');
  return user;
}
async function startSession(user: Account, env: Env, url: URL) {
  const token = crypto.randomUUID() + crypto.randomUUID(),
    csrf = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users(id,name,role) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role',
    ).bind(user.id, user.name, user.role),
    env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now()),
    env.DB.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(
      await sha256(token),
      user.id,
      csrf,
      now() + 7 * 86400000,
    ),
  ]);
  return { cookie: cookieHeader('lipiflow_session', token, url, 7 * 86400), csrf };
}
async function limited(env: Env, key: string, maximum: number) {
  const period = Math.floor(now() / 86400000),
    id = await sha256(`${env.RATE_SALT ?? 'local'}:${period}:${key}`);
  await env.DB.prepare('DELETE FROM rateLimits WHERE expires<?').bind(now()).run();
  const row = await env.DB.prepare(
    'INSERT INTO rateLimits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
  )
    .bind(id, (period + 1) * 86400000)
    .first<{ count: number }>();
  if (row && row.count > maximum) fail(429, 'Daily limit reached. Try again tomorrow.');
}
async function body(request: Request) {
  const text = new TextDecoder().decode(await readLimited(request, 250000));
  try {
    return JSON.parse(text);
  } catch {
    return fail(400, 'Invalid request.');
  }
}
async function readLimited(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > maximum) {
      await reader.cancel();
      fail(413, 'This request is too large.');
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
function parsed<T>(result: {
  success: boolean;
  data?: T;
  error?: { issues: { message: string }[] };
}): T {
  if (!result.success) fail(400, result.error?.issues[0]?.message ?? 'Check the form fields.');
  return result.data as T;
}
type StoredFont = LibraryFont & { objectKey: string };
async function getFont(env: Env, id: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(id)) fail(404, 'Font not found.');
  return env.DB.prepare('SELECT * FROM fonts WHERE id=?').bind(id).first<StoredFont>();
}
const publicFont = ({
  objectKey: _key,
  permission: _permission,
  ownerId: _owner,
  reviewNote: _reviewNote,
  filename: _filename,
  ...font
}: StoredFont) => font;
async function route(request: Request, env: Env) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (!['GET', 'HEAD'].includes(method)) requireOrigin(request, env);
  if (path === '/api/config')
    return json({ local: localAllowed(env, url), loginAvailable: !!env.FIREBASE_PROJECT_ID });
  if (path === '/api/me' && method === 'GET') {
    const user = (await firebaseAccount(request, env)) ?? (await localSession(request, env));
    if (!user) return json({ user: null, csrf: '' });
    const favourites = user.id.startsWith('local-')
      ? await env.DB.prepare('SELECT fontId FROM favourites WHERE userId=?')
          .bind(user.id)
          .all<{ fontId: string }>()
      : { results: [] as { fontId: string }[] };
    return json({
      user: { id: user.id, name: user.name, email: user.email ?? '', role: user.role },
      csrf: 'csrf' in user ? user.csrf : '',
      favourites: favourites.results.map((x) => x.fontId),
    });
  }
  if (path === '/api/dev/sign-in' && method === 'POST') {
    if (!localAllowed(env, url)) fail(404, 'Not found.');
    const data = await body(request),
      role = data.role === 'admin' ? 'admin' : 'user';
    const suffix =
      typeof data.testId === 'string' && /^[a-z0-9-]{1,60}$/.test(data.testId)
        ? '-' + data.testId
        : '';
    const user: Account = {
      id: `local-${role}${suffix}`,
      name: role === 'admin' ? 'Local admin' : 'Local member',
      role,
    };
    const result = await startSession(user, env, url);
    return Response.json(
      { user, csrf: result.csrf },
      { headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } },
    );
  }
  if (path === '/api/auth/sign-out' && method === 'POST') {
    await authenticated(request, env);
    await env.DB.prepare('DELETE FROM sessions WHERE tokenHash=?')
      .bind(await sha256(cookie(request, 'lipiflow_session')))
      .run();
    return Response.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie': cookieHeader('lipiflow_session', '', url, 0),
          'Cache-Control': 'no-store',
        },
      },
    );
  }
  if (path === '/api/fonts' && method === 'GET') {
    const fonts = await env.DB.prepare(
      "SELECT * FROM fonts WHERE status='approved' ORDER BY createdAt DESC LIMIT 1000",
    ).all<StoredFont>();
    return json({ fonts: fonts.results.map(publicFont) });
  }
  if (path === '/api/source-fonts' && method === 'GET') {
    const sources = await env.DB.prepare(
      'SELECT sourceId,sourceNumericId,name,family,variant,sourceCategory,encoding,sourceUrl,reportedLicence,copyrightText,rightsStatus,assetStored,importedAt FROM externalFontSources ORDER BY name COLLATE NOCASE LIMIT 1000',
    ).all<ExternalFontSource>();
    return json({
      fonts: sources.results.map((font) => ({
        ...font,
        sourceUrl: externalFontDownloadUrl(font) ?? '',
      })),
    });
  }
  if (path === '/api/me/fonts' && method === 'GET') {
    const user = await authenticated(request, env);
    return json({
      fonts: (
        await env.DB.prepare(
          'SELECT * FROM fonts WHERE ownerId=? ORDER BY createdAt DESC LIMIT 100',
        )
          .bind(user.id)
          .all<StoredFont>()
      ).results.map(({ objectKey: _key, ...font }) => font),
    });
  }
  const asset = path.match(/^\/api\/fonts\/([a-z0-9-]+)\/file$/);
  if (asset && method === 'GET') {
    const font = await getFont(env, asset[1]);
    if (!font) fail(404, 'Font not found.');
    if (font.status !== 'approved') {
      let user: Account;
      try {
        user = await authenticated(request, env);
      } catch (error) {
        if (error instanceof Failure && error.status === 401) fail(404, 'Font not found.');
        throw error;
      }
      if (!user || (user.id !== font.ownerId && user.role !== 'admin'))
        fail(404, 'Font not found.');
    }
    const object = await env.FONT_BUCKET.get(font.objectKey);
    if (!object) fail(404, 'Font file unavailable.');
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${url.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${font.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'font'}.${font.filename.toLowerCase().endsWith('.otf') ? 'otf' : 'ttf'}"`,
    });
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    return new Response(object.body, { headers });
  }
  if (path === '/api/fonts' && method === 'POST') {
    const user = await authenticated(request, env);
    await limited(env, 'upload:' + user.id, localAllowed(env, url) ? 200 : 20);
    if (!user.id.startsWith('local-'))
      await env.DB.prepare("INSERT OR IGNORE INTO users(id,name,role) VALUES(?,?,'user')")
        .bind(user.id, 'Firebase account')
        .run();
    if (Number(request.headers.get('Content-Length')) > maxFontBytes + 20000)
      fail(413, 'Choose a font under 10 MB.');
    const payload = await readLimited(request, maxFontBytes + 20000);
    const form = await new Response(payload, {
        headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' },
      }).formData(),
      file = form.get('file');
    if (!(file instanceof File) || file.size > maxFontBytes)
      fail(400, 'Choose a font under 10 MB.');
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get('metadata') ?? '{}'));
    } catch {
      return fail(400, 'Check the upload details.');
    }
    const metadata = parsed(uploadSchema.safeParse(raw));
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM fonts WHERE ownerId=?')
      .bind(user.id)
      .first<{ n: number }>();
    if (count && count.n >= 50) fail(409, 'Your library is limited to 50 uploads.');
    const bytes = await file.arrayBuffer(),
      info = inspectFont(bytes),
      hash = await sha256(bytes);
    if (metadata.encoding === 'Unicode' && !info.unicodeMalayalam)
      fail(400, 'This font does not map Unicode Malayalam.');
    const id = crypto.randomUUID(),
      key = `fonts/${id}`;
    await env.FONT_BUCKET.put(key, bytes, { httpMetadata: { contentType: info.mime } });
    try {
      await env.DB.prepare(
        'INSERT INTO fonts(id,ownerId,name,family,description,variant,category,encoding,authorName,authorUrl,uploaderIsAuthor,licence,licenceUrl,permission,filename,sha256,objectKey,status,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
        .bind(
          id,
          user.id,
          metadata.name,
          metadata.family,
          metadata.description,
          metadata.variant,
          metadata.category,
          metadata.encoding,
          metadata.authorName,
          metadata.authorUrl,
          metadata.uploaderIsAuthor ? 1 : 0,
          metadata.licence,
          metadata.licenceUrl,
          metadata.permission,
          file.name.slice(0, 100),
          hash,
          key,
          'pending',
          now(),
        )
        .run();
    } catch (error) {
      await env.FONT_BUCKET.delete(key);
      throw error;
    }
    return json({ id, status: 'pending' }, 201);
  }
  const favourite = path.match(/^\/api\/favourites\/([a-z0-9-]+)$/);
  if (favourite && ['PUT', 'DELETE'].includes(method)) {
    const user = await authenticated(request, env),
      id = favourite[1];
    if (!user.id.startsWith('local-')) fail(404, 'Use the Firebase account library.');
    if (method === 'PUT') {
      const font = await getFont(env, id);
      if (
        !['noto-sans-malayalam', 'noto-serif-malayalam'].includes(id) &&
        font?.status !== 'approved'
      )
        fail(404, 'Font not found.');
      await env.DB.prepare('INSERT OR IGNORE INTO favourites VALUES(?,?)').bind(user.id, id).run();
    } else
      await env.DB.prepare('DELETE FROM favourites WHERE userId=? AND fontId=?')
        .bind(user.id, id)
        .run();
    return json({ ok: true });
  }
  if (path === '/api/drafts') {
    const user = await authenticated(request, env);
    if (!user.id.startsWith('local-')) fail(404, 'Use the Firebase account library.');
    if (method === 'GET')
      return json({
        drafts: (
          await env.DB.prepare(
            'SELECT id,title,text,updatedAt FROM drafts WHERE userId=? ORDER BY updatedAt DESC',
          )
            .bind(user.id)
            .all()
        ).results,
      });
    if (method === 'POST') {
      const data = parsed(draftSchema.safeParse(await body(request)));
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM drafts WHERE userId=?')
        .bind(user.id)
        .first<{ n: number }>();
      if (count && count.n >= 50) fail(409, 'You can save up to 50 drafts.');
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)')
        .bind(id, user.id, data.title, data.text, now())
        .run();
      return json({ id }, 201);
    }
  }
  const draft = path.match(/^\/api\/drafts\/([a-z0-9-]+)$/);
  if (draft && method === 'DELETE') {
    const user = await authenticated(request, env);
    if (!user.id.startsWith('local-')) fail(404, 'Use the Firebase account library.');
    await env.DB.prepare('DELETE FROM drafts WHERE id=? AND userId=?')
      .bind(draft[1], user.id)
      .run();
    return json({ ok: true });
  }
  if (path === '/api/reports' && method === 'POST') {
    if (!localAllowed(env, url) && !env.RATE_SALT) fail(503, 'Reports are not configured yet.');
    await limited(
      env,
      'report:' + (request.headers.get('CF-Connecting-IP') ?? 'local'),
      localAllowed(env, url) ? 100 : 5,
    );
    const data = parsed(reportSchema.safeParse(await body(request)));
    const font = await getFont(env, data.fontId);
    if (!font || font.status !== 'approved') fail(404, 'Published font not found.');
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO reports(id,fontId,name,email,details,evidenceUrl,createdAt) VALUES(?,?,?,?,?,?,?)',
    )
      .bind(id, data.fontId, data.name, data.email, data.details, data.evidenceUrl, now())
      .run();
    return json({ id }, 201);
  }
  if (path.startsWith('/api/admin/')) {
    const user = await authenticated(request, env, true);
    if (path === '/api/admin/library' && method === 'GET')
      return json({
        fonts: (
          await env.DB.prepare(
            'SELECT * FROM fonts ORDER BY createdAt DESC LIMIT 1000',
          ).all<StoredFont>()
        ).results.map(({ objectKey: _key, ...font }) => font),
        reports: (
          await env.DB.prepare('SELECT * FROM reports ORDER BY createdAt DESC LIMIT 1000').all()
        ).results,
      });
    if (path === '/api/admin/source-fonts' && method === 'GET')
      return json({
        fonts: (
          await env.DB.prepare(
            'SELECT * FROM externalFontSources ORDER BY name COLLATE NOCASE LIMIT 1000',
          ).all()
        ).results,
      });
    const review = path.match(/^\/api\/admin\/fonts\/([a-z0-9-]+)$/);
    if (review && method === 'PATCH') {
      const data = await body(request);
      if (
        !['approved', 'rejected', 'hidden'].includes(data.status) ||
        typeof data.note !== 'string' ||
        data.note.trim().length < 10 ||
        data.note.length > 5000
      )
        fail(400, 'Choose a status and include a review note.');
      if (data.status === 'approved' && data.rightsReviewed !== true)
        fail(400, 'Review redistribution permission before publishing.');
      if (!(await getFont(env, review[1]))) fail(404, 'Font not found.');
      await env.DB.batch([
        env.DB.prepare('UPDATE fonts SET status=?,reviewNote=? WHERE id=?').bind(
          data.status,
          data.note.trim(),
          review[1],
        ),
        env.DB.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').bind(
          crypto.randomUUID(),
          user.id,
          review[1],
          data.status,
          data.note.trim(),
          now(),
        ),
      ]);
      return json({ ok: true });
    }
    const report = path.match(/^\/api\/admin\/reports\/([a-z0-9-]+)$/);
    if (report && method === 'PATCH') {
      const data = await body(request);
      if (
        typeof data.resolution !== 'string' ||
        data.resolution.trim().length < 10 ||
        data.resolution.length > 5000
      )
        fail(400, 'Include a resolution note.');
      const saved = await env.DB.prepare('SELECT fontId FROM reports WHERE id=?')
        .bind(report[1])
        .first<{ fontId: string }>();
      if (!saved) fail(404, 'Report not found.');
      const statements = [
        env.DB.prepare("UPDATE reports SET status='resolved',resolution=? WHERE id=?").bind(
          data.resolution.trim(),
          report[1],
        ),
        env.DB.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').bind(
          crypto.randomUUID(),
          user.id,
          report[1],
          data.hideFont ? 'report-hide' : 'report-resolve',
          data.resolution.trim(),
          now(),
        ),
      ];
      if (data.hideFont === true)
        statements.push(
          env.DB.prepare("UPDATE fonts SET status='hidden',reviewNote=? WHERE id=?").bind(
            data.resolution.trim(),
            saved.fontId,
          ),
        );
      await env.DB.batch(statements);
      return json({ ok: true });
    }
  }
  return fail(404, 'Not found.');
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const origins = (env.APP_ORIGINS ?? env.APP_ORIGIN).split(',').map((x) => x.trim());
    const origin = request.headers.get('Origin');
    const addCors = (response: Response) => {
      const headers = new Headers(response.headers);
      if (origin && origins.includes(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-Token');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
        headers.append('Vary', 'Origin');
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/'))
      return addCors(new Response(null, { status: 204 }));
    let response: Response;
    try {
      if (url.pathname.startsWith('/api/')) response = await route(request, env);
      else response = json({ error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof Failure) response = json({ error: error.message }, error.status);
      else if (error instanceof Error && /font|cmap|character table/i.test(error.message))
        response = json({ error: error.message }, 400);
      else
        response = json({ error: 'The library could not complete this request. Try again.' }, 500);
    }
    return addCors(response!);
  },
};
