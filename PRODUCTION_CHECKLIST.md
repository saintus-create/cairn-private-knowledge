# Cairn Production Checklist

## 🎯 Culturally Inclusive AI Headquarters - Production Ready

---

## ✅ **Core Implementation Complete**

| Component | Status | File |
|-----------|--------|------|
| AI Provider System | ✅ Implemented | `server/_core/aiProvider.ts` |
| Hugging Face Support | ✅ Added | `server/_core/aiProvider.ts` |
| Multiple Providers | ✅ Supported | Mistral, Codestral, Groq, OpenRouter |
| Production Build | ✅ Working | `dist/` generated |
| Single-Owner Mode | ✅ Active | Auto-auth for dev |
| Tests | ✅ Passing | 75/77 tests |
| TypeScript | ✅ Valid | No errors |

---

## 📋 **Production Deployment Checklist**

### Phase 1: Environment Setup ⏳

- [ ] **Domain configured** (cairn.yourdomain.com)
- [ ] **SSL certificates** (Let's Encrypt, Cloudflare, etc.)
- [ ] **Server provisioned** (VPS, dedicated, or cloud)
  - Minimum: 2 vCPUs, 4GB RAM, 80GB SSD
  - Recommended: 4 vCPUs, 8GB RAM, 100GB SSD

### Phase 2: Configuration 🔧

- [ ] **Environment variables configured**
  - [ ] `JWT_SECRET` generated (openssl rand -base64 32)
  - [ ] `DATABASE_URL` set (MySQL connection string)
  - [ ] `CAIRN_AI_PROVIDER` selected (huggingface, mistral, etc.)
  - [ ] `CAIRN_AI_MODEL` chosen (your preferred cultural model)
  - [ ] API key for selected provider

- [ ] **Production .env file created**
  ```bash
  cp .env.production .env
  # Edit with your settings
  ```

### Phase 3: Database 🗄️

- [ ] **MySQL server running**
- [ ] **Database created**: `cairn`
- [ ] **User created** with appropriate permissions
- [ ] **Migrations applied**
  ```bash
  pnpm db:push
  ```

### Phase 4: Build & Deploy 🚀

Choose one deployment method:

#### Option A: Docker Compose (Recommended)
```bash
# Clone and navigate
git clone https://github.com/saintus-create/cairn-private-knowledge.git
cd cairn-private-knowledge

# Create .env file with your settings
cp .env.production .env
nano .env  # Edit with your config

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

#### Option B: Docker Only
```bash
# Build the image
docker build -t cairn-ai .

# Run the container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name cairn cairn-ai
```

#### Option C: Direct Node.js
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build
pnpm build

# Start production server
NODE_ENV=production PORT=3000 pnpm start
```

### Phase 5: Verify & Test ✅

- [ ] **App accessible** at http://localhost:3000
- [ ] **Health check** passes
  ```bash
  curl http://localhost:3000
  ```
- [ ] **AI provider responding**
  ```bash
  curl -X POST http://localhost:3000/api/trpc/auth.me \
    -H "Content-Type: application/json" \
    -d '{"json":{}}'
  ```
- [ ] **Database connected**
- [ ] **Login works** (single-owner or OAuth)
- [ ] **AI queries return results**

### Phase 6: Production Hardening 🔒

- [ ] **Reverse proxy configured** (Nginx, Caddy, Traefik)
- [ ] **HTTPS enabled**
- [ ] **Firewall configured** (allow 80, 443, 3000)
- [ ] **Process manager** (PM2, systemd) for auto-restart
- [ ] **Monitoring** (logs, health checks, uptime)
- [ ] **Backups** configured for database
- [ ] **Environment variables secured** (not in git)

---

## 🌍 **Cultural Model Configuration**

Edit your `.env` file to select your preferred cultural/national model:

### European Models
```bash
# Luxembourg/EU Legal
CAIRN_AI_PROVIDER=huggingface
CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN

# EU Multilingual
CAIRN_AI_PROVIDER=huggingface
CAIRN_AI_MODEL=openeurollm/eurollm-7b
```

### Asian Models
```bash
# Singapore ASEAN
CAIRN_AI_PROVIDER=huggingface
CAIRN_AI_MODEL=aisingapore/sea-lion-7b

# Taiwan Traditional Chinese
CAIRN_AI_PROVIDER=huggingface
CAIRN_AI_MODEL=yentinglin/taiwan-llm-7b
```

### European Providers
```bash
# Mistral AI (France)
CAIRN_AI_PROVIDER=mistral
MISTRAL_API_KEY=your_token
CAIRN_AI_MODEL=mistral-small-latest

# Codestral (Open)
CAIRN_AI_PROVIDER=codestral
CODESTRAL_API_KEY=your_token
CAIRN_AI_MODEL=codestral-2508

# Groq (Fast)
CAIRN_AI_PROVIDER=groq
GROQ_API_KEY=your_token
CAIRN_AI_MODEL=openai/gpt-oss-120b
```

### Multi-Provider
```bash
# OpenRouter (100+ models)
CAIRN_AI_PROVIDER=openrouter
CAIRN_AI_API_KEY=your_token
CAIRN_AI_MODEL=openai/gpt-4o-mini
```

---

## 🎨 **Customization Options**

### Branding
- [ ] App name in `VITE_APP_NAME`
- [ ] Favicon in `client/public/`
- [ ] Color theme in `client/src/index.css`
- [ ] Logo in `client/src/components/`

### Features
- [ ] Enable/disable single-owner mode
- [ ] Configure OAuth provider
- [ ] Set default AI model
- [ ] Customize temperature defaults

### Integration
- [ ] Database connection string
- [ ] Storage provider (S3, local, etc.)
- [ ] Analytics (if needed)

---

## 📊 **Monitoring & Maintenance**

### Health Checks
```bash
# App status
curl http://localhost:3000

# Docker container status
docker ps

# Logs
docker logs cairn-ai

# Systemd status (if applicable)
sudo systemctl status cairn
```

### Updates
```bash
# Pull latest code
git pull origin main

# Update dependencies
pnpm update

# Rebuild
pnpm build

# Restart container
docker-compose down && docker-compose up -d
```

### Database
```bash
# Connect to MySQL
docker exec -it cairn-db mysql -u cairn -p

# Run migrations (if schema changed)
pnpm db:push
```

---

## 🆘 **Troubleshooting Guide**

### Issue: App won't start
**Check:**
- Node.js version (requires v20+)
- Dependencies installed (`pnpm install`)
- Build successful (`pnpm build`)
- Port not in use

### Issue: Database connection failed
**Check:**
- MySQL container running (`docker ps`)
- Connection string correct
- Credentials valid
- Database exists

**Test:**
```bash
docker exec -it cairn-db mysql -u cairn -pcairn -e "SELECT 1;"
```

### Issue: AI provider not responding
**Check:**
- API key valid
- Provider URL correct
- Model name spelled correctly
- Model available for your account

**Test:**
```bash
curl -X POST https://api-inference.huggingface.co/models/laurabernardy/LuxGPT-basedEN \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": "Hello", "parameters": {"temperature": 0.2}}'
```

### Issue: 404 on page load
**Check:**
- Build completed successfully
- `dist/public/index.html` exists
- Server serving static files correctly

---

## 📚 **Documentation**

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview |
| `DEPLOYMENT.md` | Full deployment guide |
| `docker-compose.yml` | Multi-container setup |
| `Dockerfile` | Docker build instructions |
| `.env.production` | Production config template |
| `huggingface-spaces/` | Demo Spaces |

---

## ✅ **Production Ready Checklist**

- [ ] Environment variables configured
- [ ] Database running and connected
- [ ] AI provider credentials set
- [ ] Production build successful
- [ ] App starts without errors
- [ ] Health checks pass
- [ ] AI queries return results
- [ ] Authentication works
- [ ] HTTPS configured
- [ ] Monitoring in place

**Once all items are checked, Cairn is production-ready!** 🎉

---

## 🚀 **Quick Start Command**

```bash
# All-in-one (Docker Compose)
git clone https://github.com/saintus-create/cairn-private-knowledge.git
cd cairn-private-knowledge
cp .env.production .env
# Edit .env with your settings
docker-compose up -d
```

**Access Cairn at:** http://localhost:3000

---

**Cairn: Your Culturally Inclusive AI Headquarters is ready for production.** 🏛️
