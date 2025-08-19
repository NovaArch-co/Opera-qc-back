# Opera QC Demo Instance Setup

This setup allows you to run a separate demo instance of the Opera QC backend alongside your production instance without conflicts.

## 🚀 Quick Start

1. **Create environment file:**
   ```bash
   cp env.demo.sample .env.demo
   ```

2. **Start demo instance:**
   ```bash
   ./start-demo.sh
   ```

3. **Test voice folder processing:**
   ```bash
   curl -X POST http://localhost:8082/api/event/processVoiceFolder \
     -u tipax:opera-qc-2024 \
     -H 'Content-Type: application/json'
   ```

## 📋 Port Mappings

| Service | Production | Demo | Description |
|---------|------------|------|-------------|
| **API Server** | 8081 | **8082** | Main application |
| **PostgreSQL** | 5432 | **5433** | Database |
| **Redis** | 6379 | **6380** | Queue & cache |
| **MinIO API** | 9000 | **9002** | Object storage |
| **MinIO Console** | 9001 | **9003** | MinIO web UI |
| **Debug Port** | 5555 | **5556** | Node.js debug |

## 🔧 Service URLs

- **API Documentation:** http://localhost:8082/docs
- **API Base:** http://localhost:8082/api
- **MinIO Console:** http://localhost:9003
- **Voice Folder Processing:** `POST http://localhost:8082/api/event/processVoiceFolder`

## 📂 Key Features

### Voice Folder Processing
The demo instance includes enhanced folder processing capabilities:

- **Default Voice Folder:** `/home/afeai/VOICE-2channel`
- **Auto-detection:** Finds audio pairs (r/t files)
- **AI Processing:** Full transcription & analysis pipeline
- **Sequential Processing:** Prevents AI service overload

### API Endpoints
- `POST /api/event/processVoiceFolder` - Process default voice folder
- `POST /api/event/processFolderAudio` - Process custom folder
- `GET /api/audio/sessions` - View processed sessions (streaming)

## 🗃️ Database

The demo uses a separate database (`opera_qc_demo`) on port 5433:

```bash
# Connect to demo database
psql -h localhost -p 5433 -U postgres -d opera_qc_demo
```

## 📊 Monitoring

### Check logs:
```bash
docker-compose -f docker-compose.demo.yml logs -f
```

### Check specific service:
```bash
docker-compose -f docker-compose.demo.yml logs -f app-demo
```

### View running containers:
```bash
docker-compose -f docker-compose.demo.yml ps
```

## 🛑 Management

### Stop demo instance:
```bash
./stop-demo.sh
```

### Restart demo instance:
```bash
./start-demo.sh
```

### Remove demo data (⚠️ Destructive):
```bash
docker-compose -f docker-compose.demo.yml down -v
```

## 🔐 Authentication

Same credentials as production:
- **Username:** `tipax`
- **Password:** `opera-qc-2024`

## 🧪 Testing

### Process Voice Folder:
```bash
curl -X POST http://localhost:8082/api/event/processVoiceFolder \
  -u tipax:opera-qc-2024 \
  -H 'Content-Type: application/json'
```

### Check Sessions:
```bash
curl -X GET http://localhost:8082/api/audio/sessions \
  -u tipax:opera-qc-2024
```

### Process Custom Folder:
```bash
curl -X POST http://localhost:8082/api/event/processFolderAudio \
  -u tipax:opera-qc-2024 \
  -H 'Content-Type: application/json' \
  -d '{"folderPath": "/path/to/custom/folder"}'
```

## 🔧 Configuration

Edit `.env.demo` to customize:
- Database settings
- API ports
- File paths
- Authentication keys
- External service URLs

## 🐳 Docker Network

The demo instance uses its own isolated network (`app-demo-network`) to prevent conflicts with the production instance.

## 📝 Notes

- Demo instance has its own data volumes
- Voice folder is mounted read-only
- Conversation folder is shared (read-only)
- All services run independently of production
- Can run simultaneously with production instance