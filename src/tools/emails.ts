import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';

export const toolDefinitions: ToolDefinition[] = [
  // Existing email tools
  {
    name: 'send_email',
    description: 'Send an email to specific contacts',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: { type: 'number', description: 'Email template ID' },
        contactIds: { type: 'array', items: { type: 'number' }, description: 'Array of contact IDs' },
        contactEmails: { type: 'array', items: { type: 'string' }, description: 'Array of contact emails' },
      },
    },
  },
  {
    name: 'list_emails',
    description: 'Get all email templates and campaigns',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Number of results', maximum: 200 },
        start: { type: 'number', description: 'Starting offset' },
        publishedOnly: { type: 'boolean', description: 'Only published emails' },
      },
    },
  },
  {
    name: 'get_email',
    description: 'Get detailed email information',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Email ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_email_template',
    description: 'Create a new email template',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Email name' },
        subject: { type: 'string', description: 'Email subject' },
        fromAddress: { type: 'string', description: 'From email address' },
        fromName: { type: 'string', description: 'From name' },
        replyToAddress: { type: 'string', description: 'Reply-to email address' },
        customHtml: { type: 'string', description: 'HTML content' },
        plainText: { type: 'string', description: 'Plain text content' },
        emailType: { type: 'string', enum: ['template', 'list'], description: 'Email type' },
        isPublished: { type: 'boolean', description: 'Publish immediately' },
      },
      required: ['name', 'subject'],
    },
  },
  {
    name: 'get_email_stats',
    description: 'Get email performance statistics',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: { type: 'number', description: 'Email ID' },
      },
      required: ['emailId'],
    },
  },
  {
    name: 'get_email_activity',
    description: 'Summarize email sends and engagement by date range',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD), inclusive',
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD), exclusive',
        },
      },
      required: ['dateFrom', 'dateTo'],
    },
  },
  {
    name: 'get_email_click_activity',
    description: 'Summarize tracked email clicks by date range',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: {
          type: 'number',
          description: 'Email ID to analyze',
        },
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD), inclusive',
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD), exclusive',
        },
      },
      required: ['emailId', 'dateFrom', 'dateTo'],
    },
  },


  // NEW Mautic 7 email tools
  {
    name: 'send_email_to_segment',
    description: 'Send email to its assigned segment(s) with real-time audience adaptation (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: { type: 'number', description: 'Email ID (must be a segment/list email)' },
      },
      required: ['emailId'],
    },
  },
  {
    name: 'record_email_reply',
    description: 'Record an email reply by tracking hash (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        trackingHash: { type: 'string', description: 'The email tracking hash' },
      },
      required: ['trackingHash'],
    },
  },
  {
    name: 'get_email_graph_stats',
    description: 'Get email graph statistics for a date range (Mautic 7)',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: { type: 'number', description: 'Email ID' },
        isVariant: { type: 'boolean', description: 'Whether this is a variant email' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['emailId', 'dateFrom', 'dateTo'],
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  async send_email(client: MauticApiClient, args: any) {
    const { emailId, contactIds, contactEmails } = args;
    const data: any = { id: emailId };
    if (contactIds) data.contactIds = contactIds;
    if (contactEmails) data.contactEmails = contactEmails;

    const response = await client.v1.post(`/emails/${emailId}/contact/send`, data);
    return {
      content: [{ type: 'text', text: `Email sent successfully:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async list_emails(client: MauticApiClient, args: any) {
    const params: any = {};
    if (args?.search) params.search = args.search;
    if (args?.limit) params.limit = Math.min(args.limit, 200);
    if (args?.start) params.start = args.start;
    if (args?.publishedOnly) params.publishedOnly = args.publishedOnly;

    const response = await client.v1.get('/emails', { params });
    return {
      content: [{ type: 'text', text: `Found ${response.data.total} emails:\n${JSON.stringify(response.data.emails, null, 2)}` }],
    };
  },

  async get_email(client: MauticApiClient, args: any) {
    const { id } = args;
    const response = await client.v1.get(`/emails/${id}`);
    return {
      content: [{ type: 'text', text: `Email details:\n${JSON.stringify(response.data.email, null, 2)}` }],
    };
  },

  async create_email_template(client: MauticApiClient, args: any) {
    const response = await client.v1.post('/emails/new', args);
    return {
      content: [{ type: 'text', text: `Email template created successfully:\n${JSON.stringify(response.data.email, null, 2)}` }],
    };
  },
 
  async get_email_stats(client: MauticApiClient, args: any) {
    const { emailId } = args;

    const response = await client.v1.get(`/emails/${emailId}`);
    const email = response.data.email;

    const sent = Number(email.sentCount ?? 0);
    const read = Number(email.readCount ?? 0);

    const result = {
      id: email.id,
      name: email.name,
      subject: email.subject,
      sentCount: sent,
      readCount: read,
      readRate: sent > 0
        ? `${((read / sent) * 100).toFixed(1)}%`
        : '0.0%',
      publishUp: email.publishUp,
      publishDown: email.publishDown,
      statisticsScope: 'Cumulative, not date-filtered',
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },


  async get_email_activity(client: MauticApiClient, args: any) {
    const { dateFrom, dateTo } = args;

    const validDate = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;

    if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom >= dateTo) {
      throw new Error('Provide a valid dateFrom before dateTo (YYYY-MM-DD)');
    }

    const pageSize = 200;
    const maxRecords = 10000;
    let start = 0;
    let total = 0;

    const emails = new Map<number, {
      emailId: number;
      sendRecords: number;
      readFlagged: number;
      failed: number;
    }>();

    do {
      const params = new URLSearchParams({
        start: String(start),
        limit: String(pageSize),
      });

      params.set('where[0][col]', 'date_sent');
      params.set('where[0][expr]', 'gte');
      params.set('where[0][val]', `${dateFrom} 00:00:00`);

      params.set('where[1][col]', 'date_sent');
      params.set('where[1][expr]', 'lt');
      params.set('where[1][val]', `${dateTo} 00:00:00`);

      const response = await client.v1.get('/stats/email_stats', {
        params,
      });

      total = Number(response.data.total ?? 0);
      const rows = response.data.stats;

      if (!Array.isArray(rows) || !Number.isFinite(total)) {
        throw new Error('Unexpected Mautic statistics response');
      }

      if (total > maxRecords) {
        throw new Error(`Result exceeds ${maxRecords} records`);
      }

      if (rows.length === 0 && start < total) {
        throw new Error('Mautic returned an incomplete statistics page');
      }

      for (const row of rows) {
        const emailId = Number(row.email_id);

        if (!Number.isInteger(emailId)) {
          throw new Error('Invalid email ID in statistics response');
        }

        const entry = emails.get(emailId) ?? {
          emailId,
          sendRecords: 0,
          readFlagged: 0,
          failed: 0,
        };

        entry.sendRecords++;

        if (row.is_read === true || String(row.is_read) === '1') {
          entry.readFlagged++;
        }

        if (row.is_failed === true || String(row.is_failed) === '1') {
          entry.failed++;
        }

        emails.set(emailId, entry);
      }

      start += rows.length;
    } while (start < total);

    const result = {
      dateFrom,
      dateTo,
      dateField: 'date_sent',
      totalRecords: start,
      emails: [...emails.values()].sort(
        (a, b) => b.sendRecords - a.sendRecords
      ),
      note: 'Read and failure flags reflect current status of emails sent during this period.',
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },

  async get_email_click_activity(client: MauticApiClient, args: any) {
    const { emailId, dateFrom, dateTo } = args;

    const validDate = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;

    if (
      !Number.isInteger(emailId) ||
      emailId < 1 ||
      !validDate(dateFrom) ||
      !validDate(dateTo) ||
      dateFrom >= dateTo
    ) {
      throw new Error('Invalid email ID or date range');
    }

    const pageSize = 200;
    const maxRecords = 10000;

    let start = 0;
    let total = 0;
    let totalClicks = 0;
    let unidentifiedClicks = 0;

    const contacts = new Set<string>();
    const contactLinks = new Set<string>();
    const links = new Set<string>();

    do {
      const params = new URLSearchParams({
        start: String(start),
        limit: String(pageSize),
      });

      const filters = [
        ['email_id', 'eq', String(emailId)],
        ['date_hit', 'gte', `${dateFrom} 00:00:00`],
        ['date_hit', 'lt', `${dateTo} 00:00:00`],
        ['source', 'eq', 'email'],
      ];

      filters.forEach(([col, expr, val], index) => {
        params.set(`where[${index}][col]`, col);
        params.set(`where[${index}][expr]`, expr);
        params.set(`where[${index}][val]`, val);
      });

      const response = await client.v1.get('/stats/page_hits', {
        params,
      });

      total = Number(response.data.total ?? 0);
      const rows = response.data.stats;

      if (!Array.isArray(rows) || !Number.isFinite(total)) {
        throw new Error('Unexpected Mautic statistics response');
      }

      if (total > maxRecords) {
        throw new Error(`Result exceeds ${maxRecords} records`);
      }

      if (rows.length === 0 && start < total) {
        throw new Error('Incomplete statistics page');
      }

      for (const row of rows) {
        if (Number(row.email_id) !== emailId || row.source !== 'email') {
          throw new Error('Unexpected email click record');
        }

        totalClicks++;

        const contactId = row.lead_id;
        const redirectId = row.redirect_id;

        if (contactId != null && redirectId != null) {
          contacts.add(String(contactId));
          links.add(String(redirectId));
          contactLinks.add(`${contactId}:${redirectId}`);
        } else {
          unidentifiedClicks++;
        }
      }

      start += rows.length;
    } while (start < total);

    const result = {
      emailId,
      dateFrom,
      dateTo,
      dateField: 'date_hit',
      totalClicks,
      uniqueContacts: contacts.size,
      uniqueContactLinkPairs: contactLinks.size,
      uniqueLinks: links.size,
      unidentifiedClicks,
      note: 'Unique contact/link pairs are not necessarily identical to Mautic reported unique hits.',
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },

  // NEW Mautic 7 handlers
  async send_email_to_segment(client: MauticApiClient, args: any) {
    const { emailId } = args;
    const response = await client.v1.post(`/emails/${emailId}/send`);
    return {
      content: [{ type: 'text', text: `Email ${emailId} sent to segment successfully:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async record_email_reply(client: MauticApiClient, args: any) {
    const { trackingHash } = args;
    const response = await client.v1.post(`/emails/reply/${trackingHash}`);
    return {
      content: [{ type: 'text', text: `Email reply recorded for tracking hash ${trackingHash}:\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },

  async get_email_graph_stats(client: MauticApiClient, args: any) {
    const { emailId, isVariant, dateFrom, dateTo } = args;
    const variant = isVariant ? 1 : 0;
    const response = await client.v1.get(`/emails/${emailId}`, {
      params: { dateFrom, dateTo },
    });
    return {
      content: [{ type: 'text', text: `Email ${emailId} stats (${dateFrom} to ${dateTo}):\n${JSON.stringify(response.data, null, 2)}` }],
    };
  },
};
