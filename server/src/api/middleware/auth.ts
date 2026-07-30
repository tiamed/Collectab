import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';

export type AuthEnv = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' });
  }

  try {
    const token = header.slice(7);
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
    c.set('userId', decoded.sub);
    c.set('userEmail', decoded.email);
    await next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new HTTPException(401, { message: 'Token expired' });
    }
    throw new HTTPException(401, { message: 'Invalid token' });
  }
}
