# 06 - Authentification & Sécurité

> **Document:** Authentication & Security
> **Version:** 2.0
> **Dernière mise à jour:** Décembre 2024

---

## 📚 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [NextAuth Configuration](#nextauth-configuration)
3. [Stratégies d'Authentification](#stratégies-dauthentification)
4. [Session Management](#session-management)
5. [Middleware Protection](#middleware-protection)
6. [Security Headers](#security-headers)
7. [Anti-Cheat Security](#anti-cheat-security)

---

## 🎯 Vue d'ensemble

Xkorienta utilise **NextAuth.js 4.24.13** pour l'authentification avec support de :
- **Credentials:** Email/Password (bcryptjs)
- **Google OAuth**
- **GitHub OAuth**

### Architecture de Sécurité

```
User Request
    │
    ↓
[Next.js Middleware] ────> Verify JWT Token
    │                      Check Role
    │                      Redirect if needed
    ↓
[NextAuth Session] ────────> Session enrichment
    │                         (user id, role, subSystem)
    ↓
[API Route Handler] ───────> Authorization check
    │                         (Chain of Responsibility)
    ↓
[Business Logic]
```

---

## 🔐 NextAuth Configuration

### Configuration Principale

**Fichier:** `/lib/auth.ts`

```typescript
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),

  // Session strategy
  session: {
    strategy: 'jwt',                  // Stateless JWT tokens
    maxAge: 30 * 24 * 60 * 60,        // 30 days
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60,        // 30 days
  },

  // Secret for signing tokens
  secret: process.env.NEXTAUTH_SECRET,

  // Authentication providers
  providers: [
    // Credentials (Email/Password)
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials');
        }

        // Find user in database
        const user = await User.findOne({ email: credentials.email });

        if (!user) {
          throw new Error('User not found');
        }

        // Verify password
        const isValid = await user.comparePassword(credentials.password);

        if (!isValid) {
          // Increment login attempts
          await user.incrementLoginAttempts();
          throw new Error('Invalid password');
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('Account is locked. Try again later.');
        }

        // Reset login attempts on successful login
        await user.updateOne({ loginAttempts: 0, lockedUntil: null, lastLogin: new Date() });

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          subSystem: user.subSystem,
          institution: user.institution
        };
      }
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    })
  ],

  // Custom pages
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    verifyRequest: '/verify-request',
    newUser: '/onboarding'  // Redirect after first sign up
  },

  // Callbacks
  callbacks: {
    // Called on successful sign in
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'github') {
        // Check if user exists in database
        let existingUser = await User.findOne({ email: user.email });

        if (!existingUser) {
          // Create new user for OAuth
          existingUser = await User.create({
            name: user.name,
            email: user.email,
            googleId: account.provider === 'google' ? profile?.sub : undefined,
            githubId: account.provider === 'github' ? profile?.id : undefined,
            emailVerified: true,
            isActive: true
          });
        } else {
          // Update OAuth IDs if missing
          if (account.provider === 'google' && !existingUser.googleId) {
            existingUser.googleId = profile?.sub;
          }
          if (account.provider === 'github' && !existingUser.githubId) {
            existingUser.githubId = profile?.id;
          }
          existingUser.lastLogin = new Date();
          await existingUser.save();
        }
      }

      return true;
    },

    // Called when JWT is created or updated
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.subSystem = user.subSystem;
        token.institution = user.institution;
      }

      // Update session after onboarding
      if (trigger === 'update') {
        const updatedUser = await User.findById(token.id);
        if (updatedUser) {
          token.role = updatedUser.role;
          token.subSystem = updatedUser.subSystem;
        }
      }

      return token;
    },

    // Called when session is checked
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.subSystem = token.subSystem as string;
        session.user.institution = token.institution as string;
      }

      return session;
    },

    // Called on redirect
    async redirect({ url, baseUrl }) {
      // Redirect to onboarding if user doesn't have a role
      if (url.includes('/api/auth/callback')) {
        const session = await getServerSession(authOptions);
        if (session?.user && !session.user.role) {
          return `${baseUrl}/onboarding`;
        }

        // Redirect based on role
        if (session?.user?.role === UserRole.STUDENT) {
          return `${baseUrl}/student`;
        } else if (session?.user?.role === UserRole.TEACHER) {
          return `${baseUrl}/teacher`;
        }
      }

      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;

      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;

      return baseUrl;
    }
  },

  // Events
  events: {
    async signIn({ user }) {
      console.log(`User signed in: ${user.email}`);
    },
    async signOut({ session }) {
      console.log(`User signed out: ${session?.user?.email}`);
    }
  },

  // Debug mode (development only)
  debug: process.env.NODE_ENV === 'development'
};

// Export handlers for App Router
export const handlers = NextAuth(authOptions);
export const { auth, signIn, signOut } = handlers;
```

---

## 🔑 Stratégies d'Authentification

### 1. Credentials Strategy

**Fichier:** `/lib/auth/strategies/CredentialsStrategy.ts`

```typescript
import bcrypt from 'bcryptjs';
import { User } from '@/models/User';

export class CredentialsStrategy {
  async authenticate(email: string, password: string) {
    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      return {
        success: false,
        error: `Account is locked. Try again in ${remainingTime} minutes.`
      };
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      await user.incrementLoginAttempts();
      return { success: false, error: 'Invalid password' };
    }

    // Reset login attempts
    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await user.save();

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }
}
```

---

### 2. Google Strategy

**Fichier:** `/lib/auth/strategies/GoogleStrategy.ts`

```typescript
export class GoogleStrategy {
  async authenticate(profile: any) {
    let user = await User.findOne({ email: profile.email });

    if (!user) {
      // Create new user
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.sub,
        emailVerified: true,
        metadata: {
          avatar: profile.picture
        }
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = profile.sub;
      await user.save();
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }
}
```

---

### 3. GitHub Strategy

**Fichier:** `/lib/auth/strategies/GitHubStrategy.ts`

```typescript
export class GitHubStrategy {
  async authenticate(profile: any) {
    let user = await User.findOne({ email: profile.email });

    if (!user) {
      user = await User.create({
        name: profile.name || profile.login,
        email: profile.email,
        githubId: profile.id.toString(),
        emailVerified: true,
        metadata: {
          avatar: profile.avatar_url
        }
      });
    } else if (!user.githubId) {
      user.githubId = profile.id.toString();
      await user.save();
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }
}
```

---

### Strategy Manager (Singleton)

**Fichier:** `/lib/auth/strategies/AuthStrategyManager.ts`

```typescript
export class AuthStrategyManager {
  private static instance: AuthStrategyManager;
  private strategies: Map<string, any> = new Map();

  private constructor() {
    this.registerStrategies();
  }

  static getInstance(): AuthStrategyManager {
    if (!AuthStrategyManager.instance) {
      AuthStrategyManager.instance = new AuthStrategyManager();
    }
    return AuthStrategyManager.instance;
  }

  private registerStrategies() {
    this.strategies.set('credentials', new CredentialsStrategy());
    this.strategies.set('google', new GoogleStrategy());
    this.strategies.set('github', new GitHubStrategy());
  }

  getStrategy(name: string): any {
    return this.strategies.get(name);
  }

  getEnabledProviders(): string[] {
    const enabled: string[] = ['credentials'];

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      enabled.push('google');
    }

    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      enabled.push('github');
    }

    return enabled;
  }
}
```

---

## 🔄 Session Management

### Accessing Session in Server Components

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

---

### Accessing Session in Client Components

```typescript
'use client';

import { useSession } from 'next-auth/react';

export function UserProfile() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <Spinner />;
  }

  if (status === 'unauthenticated') {
    return <LoginButton />;
  }

  return (
    <div>
      <img src={session.user.image} alt={session.user.name} />
      <p>{session.user.name}</p>
      <p>{session.user.role}</p>
    </div>
  );
}
```

---

### Updating Session

```typescript
// After onboarding, update session with new role
import { useSession } from 'next-auth/react';

const { update } = useSession();

// Trigger session refresh
await update();
```

---

## 🛡️ Middleware Protection

**Fichier:** `/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define protected routes
const protectedRoutes = ['/student', '/teacher', '/admin'];
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Not authenticated and trying to access protected route
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated but no role (needs onboarding)
  if (token && !token.role && !pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Authenticated and trying to access auth pages
  if (isAuthRoute && token) {
    // Redirect to appropriate dashboard
    if (token.role === 'STUDENT') {
      return NextResponse.redirect(new URL('/student', request.url));
    } else if (token.role === 'TEACHER') {
      return NextResponse.redirect(new URL('/teacher', request.url));
    }
  }

  // Role-based route protection
  if (pathname.startsWith('/student') && token?.role !== 'STUDENT') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (pathname.startsWith('/teacher')) {
    const teacherRoles = ['TEACHER', 'INSPECTOR', 'PRINCIPAL', 'DG_ISIMMA'];
    if (!teacherRoles.includes(token?.role as string)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return response;
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
};
```

---

## 🔒 Security Headers

**Fichier:** `/lib/security/headers.ts`

```typescript
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://accounts.google.com https://github.com",
    "frame-src 'self' https://accounts.google.com"
  ].join('; ')
};

export function applySecurityHeaders(response: Response): Response {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
```

---

## 🛡️ Anti-Cheat Security

### Exam Security Configuration

```typescript
interface AntiCheatConfig {
  fullscreenRequired: boolean;       // Force fullscreen mode
  disableCopyPaste: boolean;         // Prevent copy/paste
  trackTabSwitches: boolean;         // Monitor tab switches
  maxTabSwitches: number;            // Max allowed (default: 3)
  webcamRequired: boolean;           // Require webcam monitoring
  blockRightClick: boolean;          // Disable context menu
  preventScreenshot: boolean;        // Attempt to block screenshots
}
```

---

### Client-Side Anti-Cheat

```typescript
// hooks/useAntiCheat.ts
export function useAntiCheat(attemptId: string, config: AntiCheatConfig) {
  useEffect(() => {
    // Track visibility changes (tab switches)
    const handleVisibilityChange = () => {
      if (document.hidden && config.trackTabSwitches) {
        trackAntiCheatEvent('tab_switch');
      }
    };

    // Prevent copy/paste
    const handleCopy = (e: ClipboardEvent) => {
      if (config.disableCopyPaste) {
        e.preventDefault();
        trackAntiCheatEvent('copy_attempt');
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (config.disableCopyPaste) {
        e.preventDefault();
        trackAntiCheatEvent('paste_attempt');
      }
    };

    // Prevent right-click
    const handleContextMenu = (e: MouseEvent) => {
      if (config.blockRightClick) {
        e.preventDefault();
      }
    };

    // Fullscreen enforcement
    const checkFullscreen = () => {
      if (config.fullscreenRequired && !document.fullscreenElement) {
        trackAntiCheatEvent('fullscreen_exit');
        // Optionally force fullscreen again or warn user
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    const fullscreenInterval = setInterval(checkFullscreen, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(fullscreenInterval);
    };
  }, [config]);

  const trackAntiCheatEvent = async (type: string) => {
    await fetch(`/api/attempts/${attemptId}/anti-cheat-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, timestamp: new Date() })
    });
  };
}
```

---

### Server-Side Validation

```typescript
// Validate anti-cheat events before allowing submission
export async function validateAttemptSecurity(attemptId: string): Promise<boolean> {
  const attempt = await Attempt.findById(attemptId);

  if (!attempt) return false;

  const exam = await Exam.findById(attempt.examId);

  if (!exam) return false;

  // Check tab switch limit
  if (exam.config.antiCheat.trackTabSwitches) {
    if (attempt.tabSwitchCount > exam.config.antiCheat.maxTabSwitches) {
      attempt.suspiciousActivityDetected = true;
      await attempt.save();
      return false;
    }
  }

  // Additional checks...

  return true;
}
```

---

## 📝 Prochaines Étapes

Pour comprendre les services métier :

1. **[07_SERVICES.md](./07_SERVICES.md)** - Business services layer
2. **[03_DESIGN_PATTERNS.md](./03_DESIGN_PATTERNS.md)** - Chain of Responsibility for access control
3. **[08_DEPLOYMENT.md](./08_DEPLOYMENT.md)** - Environment configuration

---

**Dernière mise à jour:** Décembre 2024
