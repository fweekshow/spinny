import { Pool } from 'pg';

let pool: Pool | null = null;

export interface User {
  id: number;
  username: string;
  inboxId: string;
  walletAddress: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  source: string;
  messageCount: number;
}

export interface Message {
  id: number;
  inboxId: string;
  conversationId: string;
  content: string;
  timestamp: string;
  isGroup: boolean;
}

export function initPostgresDb(): void {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required for PostgreSQL');
    throw new Error('DATABASE_URL not found');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  console.log('✅ PostgreSQL connection pool created');
}

export async function createTables(): Promise<void> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        inbox_id TEXT UNIQUE NOT NULL,
        wallet_address TEXT,
        first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'group_message',
        message_count INTEGER DEFAULT 0
      )
    `);

    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        inbox_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_group BOOLEAN DEFAULT false
      )
    `);

    // Create sidebar groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sidebar_groups (
        id SERIAL PRIMARY KEY,
        group_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        original_group_id TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        members TEXT[] DEFAULT '{}'
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_inbox_id ON users(inbox_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_inbox_id ON messages(inbox_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    console.log('✅ PostgreSQL tables created successfully');
  } finally {
    client.release();
  }
}

// User management functions
export async function storeUser(
  username: string,
  inboxId: string,
  walletAddress?: string,
  source: string = 'group_message'
): Promise<void> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO users (username, inbox_id, wallet_address, source, last_seen_at, message_count)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (inbox_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        wallet_address = COALESCE(EXCLUDED.wallet_address, users.wallet_address),
        last_seen_at = CURRENT_TIMESTAMP,
        message_count = users.message_count + 1
    `, [username, inboxId, walletAddress || null, source]);
  } finally {
    client.release();
  }
}

export async function storeMessage(
  inboxId: string,
  conversationId: string,
  content: string,
  isGroup: boolean = false
): Promise<void> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO messages (inbox_id, conversation_id, content, is_group)
      VALUES ($1, $2, $3, $4)
    `, [inboxId, conversationId, content, isGroup]);
  } finally {
    client.release();
  }
}

export async function getAllUsers(): Promise<User[]> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id,
        username,
        inbox_id as "inboxId",
        wallet_address as "walletAddress",
        first_seen_at as "firstSeenAt",
        last_seen_at as "lastSeenAt",
        source,
        message_count as "messageCount"
      FROM users 
      ORDER BY last_seen_at DESC
    `);
    
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id,
        username,
        inbox_id as "inboxId",
        wallet_address as "walletAddress",
        first_seen_at as "firstSeenAt",
        last_seen_at as "lastSeenAt",
        source,
        message_count as "messageCount"
      FROM users 
      WHERE username = $1
    `, [username]);
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getInboxIdByUsername(username: string): Promise<string | null> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT inbox_id FROM users WHERE username = $1
    `, [username]);
    
    return result.rows[0]?.inbox_id || null;
  } finally {
    client.release();
  }
}

export async function getRecentMessages(limit: number = 50): Promise<Message[]> {
  if (!pool) throw new Error('Database not initialized');

  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id,
        inbox_id as "inboxId",
        conversation_id as "conversationId",
        content,
        timestamp,
        is_group as "isGroup"
      FROM messages 
      ORDER BY timestamp DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

export async function closePostgresDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ PostgreSQL connection pool closed');
  }
}
