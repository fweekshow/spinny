import { Client, type Signer, type DecodedMessage, Group } from "@xmtp/node-sdk";
import { isMentioned, removeMention } from "./mentions.js";
import { AIAgent } from "./services/agent/index.js";
import { 
  handleSidebarRequest, 
  joinSidebarGroup, 
  declineSidebarGroup,
  addUsersToSidebarGroup,
  parseMentions,
  parseSidebarCommand,
  isSidebarRequest,
  createSidebarGroupInDM,
  getSidebarGroupInfo,
  listSidebarGroups,
  setSidebarClient
} from "./services/agent/tools/sidebarGroups.js";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "./services/helpers/client.js";
import { initDb, storeUsernameMapping, getInboxIdByUsername } from "./store.js";
import { initPostgresDb, createTables, storeUser, storeMessage } from "./database/postgres.js";
import { startDashboard } from "./dashboard/server.js";
import {
  DEBUG_LOGS,
  DB_ENCRYPTION_KEY,
  MENTION_HANDLES,
  SHOW_SENDER_ADDRESS,
  WALLET_KEY,
  XMTP_ENV,
} from "./config.js";
import { ActionsCodec, type ActionsContent, ContentTypeActions } from "./xmtp-inline-actions/types/ActionsContent.js";
import { IntentCodec, ContentTypeIntent } from "./xmtp-inline-actions/types/IntentContent.js";

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY is required");
}

if (!DB_ENCRYPTION_KEY) {
  throw new Error("DB_ENCRYPTION_KEY is required");
}

if (!XMTP_ENV) {
  throw new Error("XMTP_ENV is required");
}

const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(DB_ENCRYPTION_KEY);

console.log(`🚀 Starting Grouper Agent...`);

// Initialize databases
initDb(); // SQLite for backwards compatibility
initPostgresDb(); // PostgreSQL for dashboard
createTables(); // Create PostgreSQL tables

// Start dashboard server
startDashboard();

// Initialize AI agent
const agent = new AIAgent();

// Conversation memory storage (per user)
interface ConversationEntry {
  userMessage: string;
  botResponse: string;
  timestamp: Date;
}

const conversationHistory = new Map<string, ConversationEntry[]>();

// Helper functions for conversation memory
function addToConversationHistory(senderInboxId: string, userMessage: string, botResponse: string) {
  const history = conversationHistory.get(senderInboxId) || [];
  
  // Add new entry
  history.push({
    userMessage,
    botResponse,
    timestamp: new Date()
  });
  
  // Keep only last 3 exchanges
  if (history.length > 3) {
    history.shift();
  }
  
  conversationHistory.set(senderInboxId, history);
}

function getConversationContext(senderInboxId: string): string {
  const history = conversationHistory.get(senderInboxId) || [];
  
  if (history.length === 0) {
    return "";
  }
  
  let context = "Recent conversation context:\n";
  history.forEach((entry, index) => {
    context += `User: ${entry.userMessage}\nBot: ${entry.botResponse}\n`;
  });
  context += "Current message:\n";
  
  return context;
}

// Clean up old conversations (older than 1 hour)
function cleanupOldConversations() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [senderInboxId, history] of conversationHistory.entries()) {
    const recentHistory = history.filter(entry => entry.timestamp > oneHourAgo);
    
    if (recentHistory.length === 0) {
      conversationHistory.delete(senderInboxId);
    } else {
      conversationHistory.set(senderInboxId, recentHistory);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldConversations, 30 * 60 * 1000);

async function handleMessage(message: DecodedMessage, client: Client) {
  try {
    const messageContent = message.content as string;
    const senderInboxId = message.senderInboxId;
    const conversationId = message.conversationId;

    if (DEBUG_LOGS) {
      console.log(`📥 Received message:`, {
        id: message.id,
        senderInboxId,
        conversationId,
        content: messageContent,
      });
    }

    // Skip messages from ourselves
    if (senderInboxId === client.inboxId) {
      if (DEBUG_LOGS) {
        console.log("⏭️ Skipping own message");
      }
      return;
    }

    // Get conversation to check if it's a group
    const conversation = await client.conversations.getConversationById(conversationId);

    if (!conversation) {
      console.error("❌ Could not find conversation");
      return;
    }

    const isGroup = conversation instanceof Group;

    // Store username mapping for future handle resolution
    // This helps us resolve handles like @medusaxenon to inbox IDs
    try {
      // Try to get the sender's wallet address for mapping
      const inboxState = await client.preferences.inboxStateFromInboxIds([senderInboxId]);
      const senderAddress = inboxState[0]?.identifiers[0]?.identifier;
      
      // For now, we'll store a placeholder username based on the inbox ID
      // In a real implementation, you'd extract the actual username from the message or user profile
      const placeholderUsername = `user_${senderInboxId.slice(0, 8)}`;
      
      console.log(`💾 Storing username mapping: ${placeholderUsername} → ${senderInboxId}`);
      
      // Store in SQLite (for backwards compatibility)
      storeUsernameMapping(placeholderUsername, senderInboxId, senderAddress, 'group_message');
      
      // Store in PostgreSQL (for dashboard)
      await storeUser(placeholderUsername, senderInboxId, senderAddress, 'group_message');
      await storeMessage(senderInboxId, conversationId, messageContent, isGroup);
      
      // TODO: Extract actual username from message content or user profile
      // This would require parsing the message to find @mentions or usernames
      
    } catch (error) {
      console.log(`⚠️ Could not store username mapping:`, error);
      // Continue processing the message even if mapping fails
    }

    let cleanContent = messageContent;

    // Always respond to all messages, but clean mentions from groups
    if (isGroup && isMentioned(messageContent)) {
      cleanContent = removeMention(messageContent);
      if (DEBUG_LOGS) {
        console.log("👋 Mentioned in group, will respond");
      }
    } else if (!isGroup) {
      if (DEBUG_LOGS) {
        console.log("💬 DM received, will respond");
      }
    } else if (isGroup && !isMentioned(messageContent)) {
      if (DEBUG_LOGS) {
        console.log("⏭️ Not mentioned in group, skipping");
      }
      return;
    }

    // Get sender address for context
    let senderAddress = "";
    if (SHOW_SENDER_ADDRESS) {
      try {
        // Use the sender's inbox ID to get their address
        senderAddress = senderInboxId;
      } catch (error) {
        console.warn("⚠️ Could not get sender address:", error);
      }
    }

    try {
      console.log(`🤖 Processing message: "${cleanContent}"`);
      
      // Check for sidebar group creation requests (GROUPS ONLY)
      // Groups: requires @grouper mention and shows quick actions
      // DMs: handle via conversational flow (see below)
      if (isGroup && isSidebarRequest(cleanContent)) {
        const groupName = parseSidebarCommand(cleanContent);
        if (groupName) {
          console.log(`🎯 Processing sidebar group request in GROUP: "${groupName}"`);
          const sidebarResponse = await handleSidebarRequest(groupName, message, client, conversation);
          if (sidebarResponse && sidebarResponse.trim() !== "") {
            await conversation.send(sidebarResponse);
          }
          return; // Exit early, sidebar request handled
        }
      }

      // Check for @mentions in DMs and groups (for adding users to recently created groups)
      if (cleanContent.includes('@')) {
        const mentions = parseMentions(cleanContent);
        if (mentions.length > 0) {
          console.log(`🎯 Processing @mentions: ${mentions.join(', ')}`);
          
          // Use AI to analyze if this is about adding users to a private group
          const addUsersPrompt = `Does this message ask to add users to a private group? Look for:
- Requests to add people to a group
- Mentions of adding users
- References to inviting people
- Context about group membership

If it's about adding users to a group, respond with "ADD_USERS".
If not, respond with "NO".

Message: "${cleanContent}"

Respond with only "ADD_USERS" or "NO".`;

          const addUsersIntent = await agent.run(addUsersPrompt, senderInboxId, conversationId, isGroup, senderAddress);
          
          if (addUsersIntent.includes('ADD_USERS')) {
            console.log(`🤖 AI detected add users intent`);
            
            // Get conversation context to find recent group creation
            const conversationContext = getConversationContext(senderInboxId);
            const recentHistory = conversationHistory.get(senderInboxId) || [];
            
            // Look for recent group creation in conversation history
            let recentGroupId: string | null = null;
            console.log(`🔍 Looking for recent group creation in conversation history for user: ${senderInboxId}`);
            console.log(`📋 Recent history entries:`, recentHistory.length);
            
            for (let i = recentHistory.length - 1; i >= 0; i--) {
              const entry = recentHistory[i];
              console.log(`🔍 Checking entry ${i}: "${entry.botResponse.substring(0, 100)}..."`);
              
              if (entry.botResponse.includes('Created sidebar group') || entry.botResponse.includes('Is there anyone you would like me to add') || entry.botResponse.includes('Who would you like to add?') || entry.botResponse.includes('private sidebar group')) {
                console.log(`✅ Found group creation response in history`);
                // Find the most recent group created by this user
                const allGroups = listSidebarGroups();
                console.log(`📋 All groups:`, allGroups.map(g => ({ id: g.id, name: g.name, createdBy: g.createdBy })));
                const userGroups = allGroups.filter((group: any) => group.createdBy === senderInboxId);
                console.log(`👤 User groups:`, userGroups.map(g => ({ id: g.id, name: g.name, createdAt: g.createdAt })));
                
                if (userGroups.length > 0) {
                  // Get the most recent group
                  recentGroupId = userGroups.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())[0].id;
                  console.log(`🎯 Selected most recent group: ${recentGroupId}`);
                  break;
                }
              }
            }
            
            if (recentGroupId) {
              console.log(`🎯 Adding users to recent group: ${recentGroupId}`);
              const addResult = await addUsersToSidebarGroup(recentGroupId, mentions, senderInboxId);
              await conversation.send(addResult);
              addToConversationHistory(senderInboxId, cleanContent, addResult);
              return; // Exit early, mention handling completed
            } else {
              console.log(`⚠️ No recent group found for user ${senderInboxId}`);
              await conversation.send(`❌ No recent group found. Please create a group first or make sure you're responding to a group creation message.`);
              return;
            }
          } else {
            console.log(`🤖 AI did not detect add users intent, processing normally`);
          }
        }
      }
      
      // Get conversation context for this user
      const conversationContext = getConversationContext(senderInboxId);
      const messageWithContext = conversationContext + cleanContent;
      
      // Generate AI response for non-welcome requests
      const response = await agent.run(
        messageWithContext,
        senderInboxId,
        conversationId,
        isGroup,
        senderAddress,
      );

      if (response) {
        console.log(`🔍 AI Response: "${response}"`);
        await conversation.send(response);
        addToConversationHistory(senderInboxId, cleanContent, response);
      }
    } catch (error) {
      console.error("❌ Error generating or sending response:", error);
      
      // Send fallback message
      try {
        await conversation.send(
          "Sorry, I encountered an error while processing your request. Please try again later."
        );
      } catch (fallbackError) {
        console.error("❌ Error sending fallback message:", fallbackError);
      }
    }
  } catch (error) {
    console.error("❌ Error processing message:", error);
  }
}

async function main() {
  try {
    // Get and log current date/time for agent context
    const now = new Date();
    const currentDateTime = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
    console.log(`📅 Current Date/Time: ${currentDateTime}`);
    console.log(`📅 Agent Context: Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`);
    
    console.log("🔄 Initializing client...");
    const dbPath = getDbPath("grouper-agent");
    console.log("🔄 DB path:", dbPath);
    const client = await Client.create(signer, {
      dbEncryptionKey: encryptionKey,
      env: XMTP_ENV as "local" | "dev" | "production",
      dbPath,
      codecs: [new ActionsCodec(), new IntentCodec()],
    });
    
    // Register codecs for Quick Actions
    console.log("🔄 Grouper client initialized with Quick Actions codecs");
    await logAgentDetails(client);
    
    // Initialize sidebar client for sidebar groups
    setSidebarClient(client);
    
    // Handle process termination
    const cleanup = () => {
      console.log("🛑 Shutting down agent...");
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    console.log("👂 Listening for messages...");
    console.log("💬 Agent will only respond to:");
    console.log("  - Direct messages (DMs)");
    console.log(`  - Group messages when mentioned with @${MENTION_HANDLES.split(',')[0]}`);
    
    // Sync conversations before streaming
    console.log("🔄 Syncing conversations...");
    await client.conversations.sync();
    
    // Start streaming messages
    console.log("📡 Starting message stream...");
    const stream = await client.conversations.streamAllMessages();
    
    for await (const message of stream) {
      // Skip messages from ourselves
      if (message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
        continue;
      }

      // Debug: Log all message types
      console.log(`📨 Message received - Type: ${message?.contentType?.typeId}, Content: ${typeof message?.content}`);
      console.log(`📨 Expected intent type: ${ContentTypeIntent.toString()}`);
      
      // Debug intent messages specifically
      if (message?.contentType?.typeId === "intent") {
        console.log(`🎯 Intent message detected! Content:`, JSON.stringify(message.content, null, 2));
      }

      // Handle Intent messages (Quick Action responses)
      if (message?.contentType?.typeId === ContentTypeIntent.toString() || 
          message?.contentType?.typeId === "coinbase.com/intent:1.0" ||
          message?.contentType?.typeId === "intent") {
        const intentContent = message.content as any;
        const actionId = intentContent.actionId;
        
        console.log(`🎯 Received Quick Action intent: ${actionId}`);
        console.log(`🎯 Full intent content:`, JSON.stringify(intentContent, null, 2));
        
        // Get conversation to respond
        const conversation = await client.conversations.getConversationById(message.conversationId);
        if (!conversation) continue;
        
        // Handle different action IDs
        switch (actionId) {
          default:
            // Handle sidebar group actions with dynamic IDs
            if (actionId.startsWith('join_sidebar_')) {
              const groupId = actionId.replace('join_sidebar_', '');
              console.log(`🎯 User joining sidebar group: ${groupId}`);
              const joinResult = await joinSidebarGroup(groupId, message.senderInboxId);
              await conversation.send(joinResult);
              break;
            }
            
            if (actionId.startsWith('decline_sidebar_')) {
              const groupId = actionId.replace('decline_sidebar_', '');
              console.log(`🎯 User declining sidebar group: ${groupId}`);
              const declineResult = await declineSidebarGroup(groupId, message.senderInboxId);
              await conversation.send(declineResult);
              break;
            }
            
            
            // Default fallback for unrecognized actions
            await conversation.send("Thanks for your selection!");
        }
        continue;
      }
      
      // Skip non-text messages
      if (message?.contentType?.typeId !== "text") {
        continue;
      }
        
      await handleMessage(message, client as any);
    }

  } catch (error) {
    console.error("❌ Error starting agent:", error);
    process.exit(1);
  }
}

main().catch(console.error);
