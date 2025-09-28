# Spinny Agent Dashboard

A web dashboard to monitor users, messages, and group activity for the Spinny XMTP agent.

## Features

- **User Management**: View all users who have interacted with the agent
- **Message History**: See recent messages and conversations
- **Real-time Stats**: Monitor active users and message counts
- **Username Resolution**: Track how usernames map to inbox IDs

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Add to your `.env` file:

```env
# PostgreSQL Database (for Railway)
DATABASE_URL=postgresql://username:password@host:port/database

# Existing XMTP variables
WALLET_KEY=your_wallet_key
DB_ENCRYPTION_KEY=your_encryption_key
XMTP_ENV=dev
# ... other existing variables
```

### 3. Run Locally

```bash
# Start the agent with dashboard
npm run dev

# Or start just the dashboard
npm run dev:dashboard
```

### 4. Deploy to Railway

1. **Add PostgreSQL Database**:
   - Go to your Railway project
   - Click "New" → "Database" → "PostgreSQL"
   - Copy the `DATABASE_URL` from the database service

2. **Set Environment Variables**:
   - Add `DATABASE_URL` to your Railway environment variables
   - Make sure all other XMTP variables are set

3. **Deploy**:
   - Push to your connected Git repository
   - Railway will automatically build and deploy

## Usage

### Accessing the Dashboard

- **Local**: http://localhost:3001
- **Railway**: https://your-app.railway.app

### Dashboard Features

1. **Users Table**:
   - Username (placeholder format: `user_12345678`)
   - Inbox ID (XMTP identifier)
   - Wallet Address (if available)
   - Message count
   - First/Last seen timestamps
   - Source (group_message, etc.)

2. **Messages Table**:
   - Recent messages from all conversations
   - Message content (truncated)
   - Conversation type (Group/DM)
   - Timestamp

3. **Statistics**:
   - Total users
   - Total messages
   - Active users today

### Username Resolution

The dashboard shows how usernames are mapped to inbox IDs:

1. **When a user sends a message**:
   - System creates a mapping: `user_12345678` → `inbox_id`
   - Stores in both SQLite and PostgreSQL

2. **When adding users to groups**:
   - System looks up username in database
   - Uses stored inbox ID to add user to group

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  inbox_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'group_message',
  message_count INTEGER DEFAULT 0
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  inbox_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_group BOOLEAN DEFAULT false
);
```

## API Endpoints

- `GET /api/users` - Get all users
- `GET /api/messages` - Get recent messages
- `GET /api/user/:username` - Get specific user
- `GET /health` - Health check

## Troubleshooting

### Database Connection Issues
- Check `DATABASE_URL` is correctly set
- Ensure PostgreSQL service is running in Railway
- Check database permissions

### Dashboard Not Loading
- Verify the dashboard server is running on port 3001
- Check Railway logs for errors
- Ensure all dependencies are installed

### Username Resolution Not Working
- Check if users have sent messages (creates mappings)
- Verify database is storing mappings correctly
- Check logs for resolution errors

## Security Notes

- The dashboard is read-only (no user modification)
- Username mappings are based on actual message interactions
- Only users who have messaged the agent can be added to groups
- Wallet addresses are stored for reference but not exposed in UI
