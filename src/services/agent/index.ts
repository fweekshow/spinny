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
        return `Hi! I'm Spinny, your Group Creation Assistant. 

I help you create focused discussion groups instantly. Here's how to get started:

🎯 Create a Group: "@spinny create [GroupName]"
📋 Manage Groups: Get info and help with group administration

Just mention me with @spinny and tell me what group you'd like to create!`;
      }

      if (query.toLowerCase().includes('help')) {
        return `## Spinny Group Creation Assistant - Help

### Available Commands:

Group Creation:
- @spinny create [GroupName] - Create a new group instantly
- @spinny make [GroupName] - Alternative syntax for group creation
- @spinny new [GroupName] - Another way to create groups

Private Groups (Groups Only):
- @spinny create private [GroupName] - Create a private group (no quick actions)
- @spinny make private [GroupName] - Alternative syntax for private groups
- @spinny new private [GroupName] - Another way to create private groups
- @spinny create private [GroupName] @username1 @username2 - Create private group and add users immediately

Examples:
- "@spinny create Project Discussion" (shows join quick actions)
- "@spinny create private Marketing Team" (asks for @mentions to add users)
- "@spinny create private Leadership Team @username1 @username2.eth" (creates group and adds users)
- "@spinny make private Finance Group" (private group creation)

Note: Use usernames, ENS domains, or wallet addresses for @mentions (e.g., @username, @username.eth, @0x1234...).

Note: Private groups can only be created in group conversations, not in DMs.

Features:
- Instant Group Creation - Groups are created immediately
- Public Groups - Show quick action buttons for easy joining
- Private Groups - Ask for @mentions to add specific users
- Member Management - Add multiple members with @mentions or quick actions
- Focused Discussions - Organized, topic-specific conversations

Need help with something specific? Just ask!`;
      }

      return `I'm Spinny, your Group Creation Assistant! I help create focused discussion groups instantly.

To create a group, just say: "@spinny create [GroupName]"
For private groups (groups only): "@spinny create private [GroupName]"
For private groups with users: "@spinny create private [GroupName] @username1 @username2"

For help, say: "help" or "@spinny help"`;
      
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