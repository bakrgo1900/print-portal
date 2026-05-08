# DevOps Guide — Print Portal

دليل تثبيت المشروع، متطلبات السيرفر، وتفاصيل الوصول.

---

## معلومات السيرفر

| البند | التفاصيل |
|-------|----------|
| **المزود** | DigitalOcean |
| **IP** | `46.101.235.161` |
| **نظام التشغيل** | Ubuntu 22.04 LTS |
| **المعالج** | 1 vCPU |
| **الذاكرة** | 1 GB RAM |
| **التخزين** | 25 GB SSD |
| **الدومين** | `enoota.com` |
| **SSL** | Let's Encrypt (تجديد تلقائي) |

---

## بيانات الدخول

### SSH
```bash
ssh root@46.101.235.161
# Password: [محفوظة بشكل آمن — لا تُشارَك في الكود]
```

### MySQL
```
Host:     localhost:3306
Database: printportal_db
User:     printportal_user
Password: [محفوظة في /root/printportal/.env]
```

> **تحذير:** لا تضع كلمات المرور الحقيقية في ملفات Git. استخدم `.env` دائماً.

---

## البنية على السيرفر

```
/root/
├── printportal/           # تطبيق Print Portal (port 3002)
│   ├── dist/              # الكود المُجمَّع (production build)
│   ├── node_modules/      # الحزم
│   ├── .env               # متغيرات البيئة (لا يُرفع لـ Git)
│   └── package.json
│
├── otager/                # مشروع آخر (port 3000)
└── arrowapp/              # مشروع آخر (port 3001)
```

---

## الخدمات الشغالة

```bash
pm2 list
# ┌─────┬──────────────┬──────┬─────────┐
# │  0  │ otager       │ 3000 │ online  │
# │  1  │ arrowapp     │ 3001 │ online  │
# │  5  │ printportal  │ 3002 │ online  │
# └─────┴──────────────┴──────┴─────────┘
```

---

## متطلبات السيرفر

### البرامج المطلوبة
```bash
# Node.js 22+
node --version   # v22.x.x

# npm
npm --version    # 10.x.x

# PM2 (process manager)
npm install -g pm2

# Nginx
nginx -v         # nginx/1.18.x

# Certbot (SSL)
certbot --version

# MySQL 8
mysql --version
```

### تثبيت المتطلبات من الصفر
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Install Nginx
apt install -y nginx

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Install MySQL 8
apt install -y mysql-server
mysql_secure_installation
```

---

## إعداد قاعدة البيانات

```sql
-- إنشاء قاعدة البيانات والمستخدم
CREATE DATABASE printportal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'printportal_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON printportal_db.* TO 'printportal_user'@'localhost';
FLUSH PRIVILEGES;
```

### تطبيق الـ Schema
```bash
cd /root/printportal
# الـ schema موجود في drizzle/schema.ts
# تطبيق الـ migrations يدوياً من ملفات drizzle/
```

---

## ملف البيئة (.env)

```env
# Database
DATABASE_URL=mysql://printportal_user:PASSWORD@localhost:3306/printportal_db

# Security
JWT_SECRET=your_very_long_random_secret_here

# OAuth (للأدمن)
VITE_APP_ID=printportal
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_NAME=Admin
OWNER_OPEN_ID=your_manus_open_id

# Manus APIs
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_key
VITE_FRONTEND_FORGE_API_KEY=your_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# App
VITE_APP_TITLE=enoota
NODE_ENV=production
PORT=3002
```

---

## إعداد Nginx

ملف الإعداد: `/etc/nginx/sites-available/enoota.com`

```nginx
server {
    listen 80;
    server_name enoota.com www.enoota.com;
    return 301 https://enoota.com$request_uri;
}

server {
    listen 443 ssl;
    server_name enoota.com www.enoota.com;

    ssl_certificate /etc/letsencrypt/live/enoota.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/enoota.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }
}
```

```bash
# تفعيل الموقع
ln -sf /etc/nginx/sites-available/enoota.com /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

---

## إعداد SSL

```bash
# الحصول على شهادة SSL
certbot --nginx -d enoota.com -d www.enoota.com \
  --non-interactive --agree-tos --email admin@enoota.com

# التجديد التلقائي (يعمل أوتوماتيك عبر cron)
certbot renew --dry-run
```

---

## إعداد Cloudflare DNS

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | `@` | `46.101.235.161` | DNS only (رمادي) |
| A | `www` | `46.101.235.161` | DNS only (رمادي) |

> **مهم:** يجب أن يكون الـ Proxy **DNS only** (ليس Proxied) حتى يعمل SSL من Let's Encrypt بشكل صحيح.

---

## نشر تحديث جديد

```bash
# 1. على جهازك المحلي — بناء المشروع
cd printportal
pnpm build

# 2. رفع الملفات للسيرفر
scp -r dist/ root@46.101.235.161:/root/printportal/
scp package.json root@46.101.235.161:/root/printportal/

# 3. على السيرفر — تثبيت الحزم الجديدة (إن وُجدت)
ssh root@46.101.235.161
cd /root/printportal
npm install --legacy-peer-deps --no-package-lock

# 4. إعادة تشغيل التطبيق
pm2 restart printportal

# 5. التحقق
pm2 logs printportal --lines 20
curl -s -o /dev/null -w 'HTTP:%{http_code}' https://enoota.com/
```

---

## أوامر PM2 المفيدة

```bash
pm2 list                          # قائمة التطبيقات
pm2 logs printportal              # عرض الـ logs
pm2 logs printportal --lines 50   # آخر 50 سطر
pm2 restart printportal           # إعادة التشغيل
pm2 stop printportal              # إيقاف
pm2 delete printportal            # حذف من PM2
pm2 startup                       # تشغيل تلقائي عند إعادة تشغيل السيرفر
pm2 save                          # حفظ قائمة التطبيقات
```

---

## مراقبة السيرفر

```bash
# حالة الخدمات
pm2 list
systemctl status nginx
systemctl status mysql

# استخدام الموارد
htop
df -h          # مساحة القرص
free -h        # الذاكرة

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# MySQL
mysql -u root -p
SHOW DATABASES;
USE printportal_db;
SHOW TABLES;
```

---

## استكشاف الأخطاء

### التطبيق لا يعمل
```bash
pm2 logs printportal --lines 30
# تحقق من .env
cat /root/printportal/.env
# تحقق من الـ port
ss -tlnp | grep 3002
```

### Nginx لا يعمل
```bash
nginx -t                    # فحص الإعداد
systemctl status nginx
journalctl -u nginx -n 50
```

### مشكلة SSL
```bash
certbot certificates         # عرض الشهادات
certbot renew --force-renewal
nginx -s reload
```

### قاعدة البيانات
```bash
systemctl status mysql
mysql -u printportal_user -p printportal_db
SHOW TABLES;
SELECT COUNT(*) FROM printJobs;
```

---

## النسخ الاحتياطي

```bash
# نسخ احتياطي لقاعدة البيانات
mysqldump -u printportal_user -p printportal_db > backup_$(date +%Y%m%d).sql

# نسخ احتياطي للملفات
tar -czf printportal_backup_$(date +%Y%m%d).tar.gz /root/printportal/ --exclude=node_modules
```

---

## معلومات الاتصال والدعم

- **GitHub Repository:** https://github.com/bakrgo1900/print-portal
- **الموقع:** https://enoota.com
- **لوحة الأدمن:** https://enoota.com/admin
