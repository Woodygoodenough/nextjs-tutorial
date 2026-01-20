// this is the middleware for the auth
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
    // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
    // we give a whitelist of paths that are not intercepted by the auth middleware, 
    // notice we use negative lookahead
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};