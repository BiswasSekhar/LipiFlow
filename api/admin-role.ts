import type { IncomingMessage, ServerResponse } from 'node:http';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

type Request = IncomingMessage & { body?: unknown; method?: string };
type Response = ServerResponse & { statusCode: number };

function json(response: Response, status: number, data: unknown) {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

export default async function handler(request: Request, response: Response) {
  const allowed = [
    process.env.LIPIFLOW_APP_ORIGIN,
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ].filter(Boolean);
  const origin = String(request.headers.origin ?? '');
  if (!origin || !allowed.includes(origin))
    return json(response, 403, { error: 'Origin not allowed.' });
  if (request.method !== 'POST') return json(response, 405, { error: 'Use POST.' });

  const rawToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const uid = (request.body as { uid?: unknown } | undefined)?.uid;
  const role = (request.body as { role?: unknown } | undefined)?.role;
  if (!rawToken || typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    return json(response, 400, { error: 'Enter a valid user ID.' });
  if (role !== 'user' && role !== 'admin')
    return json(response, 400, { error: 'Choose a valid role.' });
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson)
    return json(response, 503, { error: 'Firebase admin access is not configured.' });

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as Record<string, string>;
    const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    const firebaseAuth = getAuth(app);
    const actor = await firebaseAuth.verifyIdToken(rawToken, true);
    const bootstrapUid = process.env.FIREBASE_BOOTSTRAP_ADMIN_UID;
    const initialAdmin = actor.uid === bootstrapUid && uid === actor.uid && role === 'admin';
    if (actor.role !== 'admin' && !initialAdmin)
      return json(response, 403, { error: 'Admin access required.' });
    const target = await firebaseAuth.getUser(uid);
    const previousRole = target.customClaims?.role === 'admin' ? 'admin' : 'user';
    await firebaseAuth.setCustomUserClaims(uid, { ...target.customClaims, role });
    await firebaseAuth.revokeRefreshTokens(uid);
    await getFirestore(app).collection('roleChanges').add({
      actorUid: actor.uid,
      targetUid: uid,
      previousRole,
      role,
      changedAt: FieldValue.serverTimestamp(),
    });
    return json(response, 200, { ok: true, uid, role });
  } catch {
    return json(response, 400, { error: 'Role update failed. Check the user ID and try again.' });
  }
}
