// This is the Next.js Proxy (formerly Middleware) for auth.
import { auth } from "@/auth";

export const proxy = auth;

export const config = {
    // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
    // we give a whitelist of paths that are not intercepted by the auth middleware, 
    // notice we use negative lookahead
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
