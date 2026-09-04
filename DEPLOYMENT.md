# Cairn Production Deployment Guide

## 🌍 Culturally Inclusive AI Headquarters

Cairn is a unified interface for accessing national supercomputer models and culturally-appropriate LLMs worldwide.

---

## 🚀 Quick Start (Production)

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/saintus-create/cairn-private-knowledge.git
cd cairn-private-knowledge

# Copy production environment template
cp .env.production .env

# Edit .env with your settings
nano .env  # or use your preferred editor
```

### 2. Configure Environment

Edit `.env` with your production settings:

```bash
# Required
JWT_SECRET=your_strong_secret_here
DATABASE_URL=mysql://user:password@host:port/database
CAIRN_AI_PROVIDER=huggingface  # or mistral, codestral, groq, openrouter
HUGGINGFACE_API_KEY=your_hf_token  # or appropriate key for your provider
CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN  # your preferred model

# OAuth (if not using single-owner mode)
OAUTH_SERVER_URL=https://your-oauth-server.com
VITE_APP_ID=your-app-id
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal.com
```

### 3. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 4. Build for Production

```bash
pnpm build
```

This creates optimized files in the `dist/` directory.

### 5. Start Production Server

```bash
NODE_ENV=production PORT=3000 pnpm start
```

Cairn will be available at `http://localhost:3000`

---

## 🌐 Production Deployment Options

### Option A: Docker Deployment (Recommended)

**Dockerfile** (create in project root):

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy application files
COPY . .

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
```

**Build and Run:**
```bash
# Build the Docker image
docker build -t cairn-ai .

# Run the container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_secret \
  -e DATABASE_URL=your_db_url \
  -e CAIRN_AI_PROVIDER=huggingface \
  -e HUGGINGFACE_API_KEY=your_token \
  -e CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN \
  --name cairn cairn-ai
```

### Option B: Systemd Service (Linux Server)

**Create service file:** `/etc/systemd/system/cairn.service`

```ini
[Unit]
Description=Cairn AI Headquarters
After=network.target

[Service]
User=node
WorkingDirectory=/opt/cairn-private-knowledge
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=your_strong_secret
Environment=DATABASE_URL=mysql://user:password@localhost:3306/cairn
Environment=CAIRN_AI_PROVIDER=huggingface
Environment=HUGGINGFACE_API_KEY=your_token
Environment=CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN
ExecStart=/usr/bin/node /opt/cairn-private-knowledge/dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=cairn

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**
```bash
# Copy your config to production location
cp -r cairn-private-knowledge /opt/
cd /opt/cairn-private-knowledge

# Install dependencies
pnpm install --frozen-lockfile
pnpm build

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable cairn
sudo systemctl start cairn

# Check status
sudo systemctl status cairn
```

### Option C: Vercel Deployment

**vercel.json** (already configured in project):

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist/public" }
    },
    {
      "src": "server/_core/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "server/_core/index.ts" },
    { "src": "/(.*)", "dest": "dist/public/index.html" }
  ]
}
```

**Deploy:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

---

## 🌍 Cultural Model Configuration

Cairn supports switching between different national and cultural models.

### Default Configuration (Hugging Face)

```bash
CAIRN_AI_PROVIDER=huggingface
CAIRN_AI_BASE_URL=https://api-inference.huggingface.co
CAIRN_AI_MODEL=laurabernardy/LuxGPT-basedEN
HUGGINGFACE_API_KEY=your_token
```

### Preset Configurations

Edit your `.env` file and uncomment the model you want:

| Region | Model | Configuration |
|--------|-------|----------------|
| 🇸🇬 Singapore | SEA-LION | `CAIRN_AI_MODEL=aisingapore/sea-lion-7b` |
| 🇪🇺 Europe | EuroLLM | `CAIRN_AI_MODEL=openeurollm/eurollm-7b` |
| 🇹🇼 Taiwan | Taiwan LLM | `CAIRN_AI_MODEL=yentinglin/taiwan-llm-7b` |
| 🇸🇮 Slovenia | GaMS3 | `CAIRN_AI_MODEL=cjvt/GaMS3-12B-Instruct` |
| 🇨🇿 Czech | Beryl | `CAIRN_AI_MODEL=Utkarsh/beryl-i7b-mistral` |

### Other Providers

**Mistral AI:**
```bash
CAIRN_AI_PROVIDER=mistral
MISTRAL_API_KEY=your_token
CAIRN_AI_MODEL=mistral-small-latest
```

**Codestral:**
```bash
CAIRN_AI_PROVIDER=codestral
CODESTRAL_API_KEY=your_token
CAIRN_AI_MODEL=codestral-2508
```

**Groq:**
```bash
CAIRN_AI_PROVIDER=groq
GROQ_API_KEY=your_token
CAIRN_AI_MODEL=openai/gpt-oss-120b
```

**OpenRouter:**
```bash
CAIRN_AI_PROVIDER=openrouter
CAIRN_AI_API_KEY=your_token
CAIRN_AI_MODEL=openai/gpt-4o-mini
```

---

## 📊 Database Setup

Cairn uses MySQL/Planetscale for storing user data and knowledge bases.

### MySQL (Self-hosted)

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE cairn CHARACTER SET utf8mb4;"

# Create user
mysql -u root -p -e "CREATE USER 'cairn'@'%' IDENTIFIED BY 'your_password';"

# Grant permissions
mysql -u root -p -e "GRANT ALL PRIVILEGES ON cairn.* TO 'cairn'@'%';"

# Configure in .env
DATABASE_URL=mysql://cairn:your_password@localhost:3306/cairn
```

### PlanetScale

1. Create a new database at [planetscale.com](https://planetscale.com)
2. Get the connection string from the dashboard
3. Configure in `.env`:

```bash
DATABASE_URL=mysql://username:password@host/database
```

### Run Database Migrations

```bash
pnpm db:push
```

This creates the necessary tables for users, projects, collections, and documents.

---

## 🔐 Authentication Options

### Option A: Single-Owner Mode (Simplest)

For personal or small team deployments:

```bash
CAIRN_SINGLE_OWNER_MODE=true
CAIRN_OWNER_OPEN_ID=admin
```

No OAuth required. The first user is automatically authenticated.

### Option B: OAuth Server (Recommended for Teams)

Set up an OAuth server (Manus or custom):

```bash
CAIRN_SINGLE_OWNER_MODE=false
OAUTH_SERVER_URL=https://your-oauth-server.com
VITE_APP_ID=your-app-id
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal.com
```

---

## 📁 Directory Structure

```
cairn-private-knowledge/
├── .env                    # Environment variables
├── .env.production         # Production template
├── client/                 # Frontend (React + Vite)
│   └── src/
│       └── pages/
│           └── Home.tsx   # Main application page
├── server/                 # Backend (Express + tRPC)
│   ├── _core/
│   │   ├── aiProvider.ts  # AI provider configuration
│   │   └── index.ts      # Server entry point
│   └── routers/
│       └── index.ts      # API routers
├── drizzle/                # Database schema and migrations
├── huggingface-spaces/     # Demo Spaces for HF models
└── DEPLOYMENT.md          # This file
```

---

## 🛠️ Monitoring and Maintenance

### Health Checks

```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check database connection
curl http://localhost:3000/api/db-status
```

### Logs

```bash
# Docker
docker logs cairn

# Systemd
sudo journalctl -u cairn -f

# Direct
node dist/index.js  # Outputs to console
```

### Updates

```bash
# Pull latest changes
git pull origin main

# Update dependencies
pnpm update

# Rebuild and restart
pnpm build
# Restart your server process
```

---

## 🎯 Performance Considerations

### Caching

- Enable CDN caching for static assets
- Consider Redis for session caching in production

### Scaling

- Use a process manager (PM2) for Node.js clustering
- Deploy behind a reverse proxy (Nginx, Caddy)

### Example Nginx Configuration

```nginx
server {
    listen 80;
    server_name cairn.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🆘 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
mysql -u user -p -h host database

# Check connection from Node.js
node -e "const mysql = require('mysql2/promise'); (async () => { const conn = await mysql.createConnection(process.env.DATABASE_URL); console.log('Connected!'); await conn.end(); })()"
```

### AI Provider Errors

```bash
# Test AI provider connection
curl -X POST http://localhost:3000/api/trpc/health.checkAI \
  -H "Content-Type: application/json" \
  -d '{"json":{}}'
```

### Build Failures

```bash
# Clear build cache
rm -rf dist node_modules/.vite

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild
pnpm build
```

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/saintus-create/cairn-private-knowledge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/saintus-create/cairn-private-knowledge/discussions)
- **Documentation**: [Project README](README.md)

---

**Cairn is ready to be your Culturally Inclusive AI Headquarters.** 🚀
