/**
 * Local auth routes: POST /api/auth/login, POST /api/auth/logout
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { bcrypt, createSessionToken } from "./_core/localAuth";
import { ENV } from "./_core/env";

export function createAuthRouter(): Router {
  const router = Router();

  router.post("/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "username and password required" });
      return;
    }

    if (username !== ENV.adminUsername) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, ENV.adminPasswordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = await createSessionToken(`local-admin-${username}`);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ success: true });
  });

  router.post("/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  return router;
}
