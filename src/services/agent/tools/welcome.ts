import { z } from "zod";
import { DynamicTool } from "@langchain/core/tools";

// Welcome message tool
export const sendWelcomeMessage = new DynamicTool({
  name: "SendWelcomeMessage",
  description: "Send a welcome message with quick actions to help users get started with group creation",
  func: async () => {
    return `Hi! I'm Sidebar your Group Creation Assistant. 

I help you create focused discussion groups instantly. Here's how to get started:

🎯 **Create a Group**: "@sidebar create [GroupName]"
👥 **Add Members**: I'll help you add people with quick actions
📋 **Manage Groups**: Get info and help with group administration

Just mention me with @sidebar and tell me what group you'd like to create!`;
  },
});

// Help tool
export const showHelp = new DynamicTool({
  name: "ShowHelp",
  description: "Show help information and available commands for group creation",
  func: async () => {
    return `## Sidebar Group Creation Assistant - Help

### Available Commands:

**Group Creation:**
- \`@sidebar create [GroupName]\` - Create a new group instantly
- \`@sidebar make [GroupName]\` - Alternative syntax for group creation
- \`@sidebar new [GroupName]\` - Another way to create groups

**Examples:**
- "@sidebar create Project Discussion"
- "@sidebar make Marketing Team" 
- "@sidebar new Design Review"

### Features:
- **Instant Group Creation** - Groups are created immediately
- **Member Management** - Add multiple members with quick actions
- **Focused Discussions** - Organized, topic-specific conversations
- **Quick Actions** - Interactive buttons for easy group management

### How to Use:
1. Mention me with @sidebar in any conversation
2. Tell me what group you'd like to create
3. I'll create the group and help you add members
4. Use quick action buttons for easy management

Need help with something specific? Just ask!`;
  },
});
