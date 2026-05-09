export const ENV = {
  appId: process.env.VITE_APP_ID ?? "printportal",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  uploadsDir: process.env.UPLOADS_DIR ?? "./uploads",
};
