/**
 * Declaration Merging Example for ForgeTS Applications
 * 
 * Demonstrates how consumer applications and plugins augment core framework
 * contracts without modifying framework internals.
 */

import "@forge/core";

// 1. Augment the HttpContext with session and auth user properties
declare module "@forge/core" {
  interface HttpContext {
    /**
     * Session data attached by session middleware
     */
    session: {
      get<T = unknown>(key: string): T | undefined;
      set(key: string, value: unknown): void;
      flash(key: string, message: string): void;
      destroy(): Promise<void>;
    };

    /**
     * Authenticated user attached by auth middleware
     */
    user?: {
      id: string;
      email: string;
      role: "admin" | "user";
      permissions: string[];
    };
  }

  // 2. Augment ContainerBindings to provide type-safe container.make()
  interface ContainerBindings {
    "mail.mailer": {
      send(to: string, subject: string, body: string): Promise<boolean>;
    };
    "cache.redis": {
      get(key: string): Promise<string | null>;
      set(key: string, val: string, ttlSeconds?: number): Promise<void>;
    };
  }

  // 3. Augment AppConfig for strongly typed config("...") helper
  interface AppConfig {
    app: {
      name: string;
      env: "development" | "staging" | "production";
      debug: boolean;
      url: string;
    };
    database: {
      default: string;
      connections: Record<string, Record<string, any>>;
    };
  }
}

// 4. Augment global environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APP_KEY: string;
      APP_ENV: "development" | "production" | "test";
      DATABASE_URL: string;
    }
  }
}

export {};
