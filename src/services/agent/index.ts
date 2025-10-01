import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { DEFAULT_MODEL, OPENAI_API_KEY } from "@/config.js";
import { DEFAULT_REPLY } from "@/constant.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { DEFAULT_TOOLS } from "./tools/index.js";


export class AIAgent {
  private model: ChatOpenAI;
  constructor() {
    this.model = new ChatOpenAI({
      model: DEFAULT_MODEL,
      apiKey: OPENAI_API_KEY,
      temperature: 0.2,
    });
  }

  generatePrompt(
    query: string,
    senderInboxId: string,
    conversationId: string,
    isGroupMention: string,
    walletAddress: string,
    eventContext?: string,
  ) {
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      [
        "user",
        `Sender Inbox Id: ${senderInboxId}
        Conversation ID: ${conversationId}
        isGroupMentioned: ${isGroupMention}
        Wallet Address: ${walletAddress}
        ${eventContext ? `Event Context: ${eventContext}` : ''}
        
        IMPORTANT: When using SendBroadcastMessage tool, use these exact values:
        - walletAddress: ${walletAddress}
        - currentConversationId: ${conversationId}
        
        Query: ${query}`,
      ],
      ["placeholder", "{agent_scratchpad}"],
    ]);
    return promptTemplate;
  }

  async run(
    query: string,
    senderInboxId: string,
    conversationId: string,
    isGroupMention: boolean,
    walletAddress: string,
    eventContext?: string,
  ) {
    try {
      // Add input validation
      if (!query || typeof query !== 'string') {
        console.log(`⚠️ Invalid query: ${query}`);
        return DEFAULT_REPLY;
      }

      if (!senderInboxId || typeof senderInboxId !== 'string') {
        console.log(`⚠️ Invalid senderInboxId: ${senderInboxId}`);
        return DEFAULT_REPLY;
      }

      if (!conversationId || typeof conversationId !== 'string') {
        console.log(`⚠️ Invalid conversationId: ${conversationId}`);
        return DEFAULT_REPLY;
      }

      // For now, return a simple response to avoid LangChain complexity
      // TODO: Re-enable LangChain agent once the toLowerCase issue is resolved
      console.log(`🤖 Simple response for: "${query}"`);
      
      if (query.toLowerCase().includes('hey') || query.toLowerCase().includes('hi') || query.toLowerCase().includes('hello')) {
        return `Hi! I'm Grouper, your Group Creation Assistant. 

I help you create focused discussion groups instantly. Here's how to get started:

🎯 Create a Group: "@grouper create [GroupName]"
📋 Manage Groups: Get info and help with group administration

Just mention me with @grouper and tell me what group you'd like to create!`;
      }

      if (query.toLowerCase().includes('help')) {
        return `## Grouper - Group Creation Assistant

### Available Commands:

Group Creation (in group chats):
- @grouper create [GroupName] - Create a new group instantly
- @grouper make [GroupName] - Alternative syntax for group creation
- @grouper new [GroupName] - Another way to create groups

Examples:
- "@grouper create Project Discussion" (shows quick actions to join)
- "@grouper make Marketing Team" (creates group with join buttons)

DM Group Creation:
- Message me in DM and I'll guide you through creating a group step by step
- I'll ask for the group name and who to add

Features:
- Instant Group Creation - Groups are created immediately
- Quick Actions - Interactive buttons for easy joining
- Member Management - Add members via quick actions or @mentions
- Focused Discussions - Organized, topic-specific conversations

Need help with something specific? Just ask!`;
      }

      return `I'm Grouper, your Group Creation Assistant! I help create focused discussion groups instantly.

To create a group, just say: "@grouper create [GroupName]"

For help, say: "help" or "@grouper help"`;
      
    } catch (e) {
      console.log(`⚠️ Unable to generate result: ${e}`);
      console.log(`   Query: "${query}"`);
      console.log(`   SenderInboxId: "${senderInboxId}"`);
      console.log(`   ConversationId: "${conversationId}"`);
      console.log(`   WalletAddress: "${walletAddress}"`);
      return DEFAULT_REPLY;
    }
  }
}