#!/usr/bin/env node

/**
 * Mautic MCP server
 *
 * Fork of mantic-MCP with Mautic 4-compatible reporting and configurable
 * tool access. Supports the original tool registry for full-access use.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

import { MauticApiClient } from './api/client.js';
import { allToolDefinitions, dispatchTool } from './tools/index.js';

// Mautic connection settings.
const MAUTIC_BASE_URL = process.env.MAUTIC_BASE_URL;
const MAUTIC_CLIENT_ID = process.env.MAUTIC_CLIENT_ID;
const MAUTIC_CLIENT_SECRET = process.env.MAUTIC_CLIENT_SECRET;
const MAUTIC_TOKEN_ENDPOINT = process.env.MAUTIC_TOKEN_ENDPOINT;

// Available modes: reporting, readonly, full. Default to readonly.
type AccessMode = 'reporting' | 'readonly' | 'full';
const configuredMode = process.env.MCP_ACCESS_MODE ?? 'readonly';

if (!['reporting', 'readonly', 'full'].includes(configuredMode)) {
  throw new Error(
    `Invalid MCP_ACCESS_MODE "${configuredMode}". Use reporting, readonly, or full.`
  );
}
const MCP_ACCESS_MODE = configuredMode as AccessMode;

// The original nine reporting tools, validated against Mautic 4.
const REPORTING_TOOLS = new Set([
  'list_emails',
  'get_email',
  'get_email_stats',
  'get_email_activity',
  'get_email_click_activity',
  'get_email_unsubscribe_activity',
  'get_email_monthly_report',
  'list_reports',
  'get_report',
]);

// Additional GET-only tools using the legacy Mautic API.
// Read-only does not mean anonymous: some tools return contact/submission data.
// Mautic 7-specific tools are excluded until tested for compatibility.
const ADDITIONAL_READ_ONLY_TOOLS = new Set([
  // Contacts
  'get_contact',
  'search_contacts',

  // Campaigns
  'list_campaigns',
  'get_campaign',
  'get_campaign_contacts',

  // Forms
  'list_forms',
  'get_form',
  'get_form_submissions',

  // Segments
  'list_segments',
  'get_segment_contacts',

  // Content
  'list_assets',
  'get_asset',
  'list_pages',
  'list_sms',

  // Business entities
  'list_companies',
  'get_contact_notes',
  'list_tags',
  'list_categories',

  // Additional contact data
  'list_stages',
  'list_contact_fields',
  'get_contact_activity',

  // Integrations
  'list_webhooks',
]);

const READ_ONLY_TOOLS = new Set([
  ...REPORTING_TOOLS,
  ...ADDITIONAL_READ_ONLY_TOOLS,
]);

function isToolAllowed(name: string): boolean {
  switch (MCP_ACCESS_MODE) {
    case 'full':
      return true;
    case 'readonly':
      return READ_ONLY_TOOLS.has(name);
    case 'reporting':
      return REPORTING_TOOLS.has(name);
  }
}

if (!MAUTIC_BASE_URL || !MAUTIC_CLIENT_ID || !MAUTIC_CLIENT_SECRET || !MAUTIC_TOKEN_ENDPOINT) {
  throw new Error(
    'Missing required Mautic environment variables: ' +
    'MAUTIC_BASE_URL, MAUTIC_CLIENT_ID, MAUTIC_CLIENT_SECRET, MAUTIC_TOKEN_ENDPOINT'
  );
}

class MauticServer {
  private server: Server;
  private apiClient: MauticApiClient;

  constructor() {
    this.server = new Server(
      {
        name: 'mautic-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiClient = new MauticApiClient({
      baseUrl: MAUTIC_BASE_URL!,
      clientId: MAUTIC_CLIENT_ID!,
      clientSecret: MAUTIC_CLIENT_SECRET!,
      tokenEndpoint: MAUTIC_TOKEN_ENDPOINT!,
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allToolDefinitions.filter(tool => isToolAllowed(tool.name)),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        // Enforce permissions on calls, not only in tool discovery.
        if (!isToolAllowed(request.params.name)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Tool "${request.params.name}" is disabled in ${MCP_ACCESS_MODE} mode`
          );
        }

        return await dispatchTool(
          request.params.name,
          this.apiClient,
          request.params.arguments,
        );
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        if (axios.isAxiosError(error)) {
          const message = MauticApiClient.extractErrorMessage(error);
          return {
            content: [{ type: 'text', text: `Mautic API Error: ${message}` }],
            isError: true,
          };
        }
        throw new McpError(ErrorCode.InternalError, `Unexpected error: ${error}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`EMRL Mautic MCP server running on stdio (access: ${MCP_ACCESS_MODE})`);
  }
}

const server = new MauticServer();
server.run().catch(console.error);
