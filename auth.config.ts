import type { NextAuthConfig } from 'next-auth';
// For requests intercepted by auth middleware, should this request be allowed, blocked, or redirected?
export const authConfig = {
    pages: {
        // if not specified, the default is /auth/signin
        signIn: '/login',
    },
    callbacks: {
        // return values meaning:
        // true: allow the request
        // false: block the request and redirect to signIn
        // Response.redirect: custom redirect response
        // Response: custom response object
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            const isOnAuthPage =
                nextUrl.pathname === '/login' || nextUrl.pathname === '/signup';
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            }
            // Keep the home page public. Only redirect logged-in users away from auth pages.
            if (isLoggedIn && isOnAuthPage) {
                // if an absolute URL is provided, the pathname is replaced entirely
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;