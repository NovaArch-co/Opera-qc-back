# Complete Analysis: Transcription Storage and Call Checking

## 🎯 **MAIN FINDINGS**

### ✅ **Transcripts ARE Stored in Database**
Based on my comprehensive code analysis:

1. **Database Schema**: The `SessionEvent` table has a `transcription` field (JSON type)
2. **Processing Flow**: Calls go through transcription queue → AI service → database storage
3. **API Response**: The `/api/event` endpoint returns transcription data
4. **Storage Location**: Transcriptions stored as JSON with `Agent` and `Customer` speech

### 🔄 **How Transcription Works**
```
Call Received → Sequential Queue → Audio Download → MinIO Storage → 
Transcription Queue → AI Service (31.184.134.153:8003) → Database Update
```

## 🚀 **BEST APPROACH TO CHECK CALLS FOR 01-07-1404**

### **Option 1: Use the Efficient API (RECOMMENDED)**
The `/api/event` endpoint is much better than `/api/audio/sessions` because:
- ✅ Fast pagination (not bulk streaming)
- ✅ Only returns processed calls (with transcriptions)
- ✅ Supports filtering
- ✅ Reasonable response times

**Endpoint**: `http://31.184.134.153:8081/api/event`

### **Step-by-Step Process**

#### 1. **Login to Get JWT Token**
```bash
curl -X POST "http://31.184.134.153:8081/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
```

#### 2. **Search for Calls (with pagination)**
```bash
# Page 1
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://31.184.134.153:8081/api/event?page=1&limit=50"

# Page 2
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://31.184.134.153:8081/api/event?page=2&limit=50"
```

#### 3. **Look for These Filename Patterns**
- `14040701` (YYYY-MM-DD format)
- `14040107` (YYYY-DD-MM format) 
- `140407` or `140401` (partial matches)

## 📊 **WHAT YOU'LL FIND IN THE RESPONSE**

### **Call Data Structure**
```json
{
  "id": 123,
  "filename": "14040701-143022-09123456789-101",
  "date": "2025-09-23T14:30:22.000Z",
  "type": "incoming",
  "sourceNumber": "09123456789",
  "destNumber": "101",
  "duration": "00:03:45",
  "transcription": {
    "Agent": "سلام، خوش آمدید به مرکز تماس...",
    "Customer": "سلام، من یک مشکل دارم..."
  },
  "explanation": "مکالمه در مورد مشکل فنی مشتری...",
  "category": "پشتیبانی فنی",
  "emotion": "نگران",
  "keyWords": ["مشکل", "فنی", "راه حل"],
  "forbiddenWords": {"آره": 2}
}
```

### **Key Fields to Check**
- **`transcription`**: `null` = no transcription, `{...}` = transcription available
- **`explanation`**: AI analysis of the call content
- **`category`**: Call categorization
- **`emotion`**: Detected emotional state
- **`keyWords`**: Important words extracted from conversation

## 🛠 **TOOLS I'VE CREATED FOR YOU**

### 1. **JavaScript Search Script**
- File: `check_calls_practical_api.js`
- Features: Automated login, pagination, pattern matching
- Usage: Update credentials and run `node check_calls_practical_api.js`

### 2. **Curl Commands Guide**
- File: `check_calls_curl_commands.sh`
- Features: Step-by-step manual commands
- Usage: Follow the instructions in the script

### 3. **Database Query Script** (if you have DB access)
- File: `check_calls_1404_07_01.sh`
- Features: Direct database queries
- Usage: Run on server with database access

## 🔍 **EXPECTED RESULTS FOR 01-07-1404**

### **If Calls Exist and Are Transcribed:**
```
✅ Found 5 calls for 01-07-1404
📊 Transcription Statistics:
   - Calls with transcription: 5/5 (100%)
   - Calls with explanation: 5/5 (100%)
   - Calls with category: 4/5 (80%)
   - Calls with emotion: 5/5 (100%)
```

### **If No Calls Found:**
Possible reasons:
- No calls were made on that date
- Date format is different than expected
- Calls exist but haven't been processed yet
- Date is outside current database range

## ⚠️ **IMPORTANT NOTES**

### **API Limitations**
- `/api/event` only shows calls WITH transcription data
- If calls exist but aren't transcribed, they won't appear
- Requires JWT authentication (email/password)

### **Date Format Considerations**
- Persian date 01-07-1404 = approximately September 23, 2025
- Filename format: YYYYMMDD-HHMMSS-PHONE-EXT
- Could be stored as 14040701 or 14040107 depending on interpretation

### **Server Configuration**
- Main server: `http://31.184.134.153:8081` (corrected port)
- AI service: `http://31.184.134.153:8003/process/`
- Database: PostgreSQL at `5.202.171.177:5432`

## 🎯 **NEXT STEPS**

1. **Update credentials** in the provided scripts
2. **Test the API connection** with a simple login
3. **Search for the specific date** using pagination
4. **Analyze the results** to confirm transcription status
5. **If no results found**, check broader date ranges or different patterns

## 📞 **QUICK TEST COMMAND**

To quickly test if the API works:
```bash
# Replace with your actual credentials
curl -X POST "http://31.184.134.153:8081/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your_email","password":"your_password"}'
```

If this returns a token, the API is working and you can proceed with the search.

---

**The bottom line**: Your system DOES store transcriptions in the database, and you have the tools to check for calls on any specific date. The `/api/event` endpoint is your best option for efficient searching.



