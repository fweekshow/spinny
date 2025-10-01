GROUPER: AI GROUP MANAGEMENT AGENT FOR BASE
==========================================

WHAT IS GROUPER?
================

Grouper is an intelligent AI agent that lives in Base's messaging app, designed to make group creation and management effortless. Think of Grouper as your personal group administrator that can create focused discussion groups instantly, manage permissions, and help organize conversations.

WHY GROUPER EXISTS
==================

THE PROBLEM
-----------
- Creating groups in messaging apps is often cumbersome and time-consuming
- Users need to manually invite people, set permissions, and organize conversations
- Group management requires technical knowledge of admin controls
- No intelligent assistance for group creation workflows

THE SOLUTION
------------
Grouper eliminates these friction points by providing:
- Instant group creation with simple commands
- Intelligent conversation flow that guides users through the process
- Automatic admin setup for group creators
- Interactive quick actions for seamless user experience

CORE FEATURES
=============

INSTANT GROUP CREATION
----------------------
- Create groups with simple commands like @grouper create Marketing Team
- Works in both direct messages (DMs) and group conversations
- Groups are created immediately with proper naming and permissions

SMART CONVERSATION FLOW
-----------------------
- In DMs: Start with "Hey" → Get interactive buttons → Provide group name → Group created
- In Groups: Mention @grouper create [GroupName] → Group created with invitation buttons
- Persistent conversation state remembers where you are in the process

ADVANCED GROUP MANAGEMENT
-------------------------
- Automatic Admin Rights: Group creators become super admins automatically
- Group Naming: Intelligent group name handling and validation
- Member Management: Quick action buttons for joining/declining groups
- Sidebar Conversations: Creates focused discussion groups from main conversations

INTERACTIVE QUICK ACTIONS
-------------------------
- Namespaced Action IDs: All actions use grouper_ prefix for uniqueness
- Join/Decline Buttons: One-click group participation
- Create/No Thanks Buttons: Simple decision making in conversation flow

HOW IT WORKS
============

FOR DIRECT MESSAGES (DMs)
-------------------------
1. Initial Contact: User says "Hey" or "Hi"
2. Welcome Flow: Grouper responds with interactive buttons:
   - "✅ Yes, create group"
   - "❌ Not now"
3. Group Name Collection: If user chooses to create, Grouper asks for group name
4. Instant Creation: Group is created with proper admin permissions
5. Confirmation: User receives confirmation with group details

FOR GROUP CONVERSATIONS
-----------------------
1. Mention Grouper: @grouper create Project Discussion
2. Instant Creation: Group is created immediately
3. Invitation Actions: Original group gets buttons to join the new group
4. Seamless Transition: Users can join with one click

SUPPORTED COMMANDS
==================

GROUP CREATION COMMANDS
-----------------------
@grouper create [GroupName]     # Primary command
@grouper make [GroupName]       # Alternative syntax
@grouper new [GroupName]        # Alternative syntax
@grouper sidebar [GroupName]    # Alternative syntax

DM COMMANDS
-----------
create [GroupName]              # Direct creation in DMs
hey/hi/hello                   # Triggers welcome flow
help                           # Shows help information

TECHNICAL ARCHITECTURE
======================

CONVERSATION STATE MANAGEMENT
-----------------------------
- Persistent State: Remembers conversation progress using DMConversationState
- Step Tracking: WAITING_FOR_GROUP_NAME, ASKED_CREATE_GROUP, etc.
- Automatic Cleanup: Old conversation states are cleaned up after 1 hour

GROUP CREATION PROCESS
----------------------
1. XMTP Group Creation: Uses XMTP SDK to create new group conversations
2. Name Setting: Automatically sets group name after creation
3. Admin Assignment: Makes creator a super admin using XMTP permissions
4. Metadata Storage: Stores group information for future reference
5. Welcome Message: Sends confirmation message to the new group

QUICK ACTIONS SYSTEM
--------------------
- Namespaced IDs: All actions prefixed with grouper_ for uniqueness
- Interactive Buttons: Primary/secondary styling for clear UX
- Intent Handling: Processes button clicks and continues appropriate flow

USE CASES
=========

BUSINESS TEAMS
--------------
- Project Discussions: Create focused groups for specific projects
- Department Chats: Organize conversations by team or function
- Client Communications: Separate client discussions from internal chats

COMMUNITY MANAGEMENT
--------------------
- Topic-Based Groups: Create groups for specific interests or topics
- Event Organization: Set up groups for events, meetups, or activities
- Support Channels: Create focused support or help groups

EDUCATIONAL SETTINGS
--------------------
- Study Groups: Organize learning sessions and study materials
- Course Discussions: Create subject-specific conversation groups
- Collaborative Projects: Set up groups for group assignments

BENEFITS
========

FOR USERS
---------
- Zero Learning Curve: Simple, intuitive commands
- Instant Gratification: Groups created immediately
- Reduced Friction: No manual setup or configuration
- Smart Assistance: AI guides you through the process

FOR COMMUNITIES
---------------
- Better Organization: Focused discussions reduce noise
- Increased Engagement: Easy group creation encourages participation
- Scalable Management: AI handles routine group administration
- Improved UX: Interactive buttons make actions obvious

INTEGRATION WITH BASE
=====================

Grouper is designed to be a native part of the Base ecosystem:
- XMTP Integration: Uses Base's messaging infrastructure
- Wallet Integration: Works with Base wallet addresses
- Group Permissions: Leverages Base's group management system
- User Experience: Feels like a natural part of Base's interface

FUTURE ENHANCEMENTS
===================

PLANNED FEATURES
----------------
- Advanced Member Management: Bulk invite, role assignments
- Group Analytics: Usage statistics and engagement metrics
- Custom Templates: Pre-configured group setups for common use cases
- Integration APIs: Connect with other Base ecosystem tools

POTENTIAL INTEGRATIONS
----------------------
- Calendar Systems: Schedule-based group creation
- Project Management: Integration with task and project tools
- Notification Systems: Smart alerts for group activity
- Content Sharing: Enhanced media and file sharing capabilities

GETTING STARTED
===============

FOR END USERS
-------------
1. Start a DM with Grouper or mention @grouper in any group
2. Say "Hey" to begin the welcome flow
3. Follow the interactive prompts to create your first group
4. Use @grouper help for command reference

FOR DEVELOPERS
--------------
- Open Source: Full codebase available for review and contribution
- Extensible: Plugin architecture for custom functionality
- Well Documented: Comprehensive code comments and documentation
- Active Development: Regular updates and feature additions

---

Grouper makes group management effortless, intelligent, and fun. Whether you're organizing a team project, setting up a community discussion, or creating study groups, Grouper is your AI assistant for seamless group creation and management in Base.
