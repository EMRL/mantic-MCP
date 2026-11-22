import type { MauticApiClient } from '../api/client.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';
import { toolHandlers as emailHandlers } from './emails.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'get_email_monthly_report',
    description: 'Summarize sends, current read flags, clicks, and unsubscribe events for a calendar month without contact data',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'Month to report, YYYY-MM (e.g. 2026-10)',
        },
      },
      required: ['month'],
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  async get_email_monthly_report(client: MauticApiClient, args: any) {
    const month = args?.month;
    const match = typeof month === 'string'
      ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
      : null;

    if (!match || Number(match[1]) < 2000 || Number(match[1]) > 9998) {
      throw new Error('Month must be YYYY-MM (year 2000-9998)');
    }

    const dateFrom = `${month}-01`;
    const dateTo = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1))
      .toISOString().slice(0, 10);

    // Reuse our already-tested send and unsubscribe tools.
    const [sendResponse, unsubscribeResponse] = await Promise.all([
      emailHandlers.get_email_activity(client, { dateFrom, dateTo }),
      emailHandlers.get_email_unsubscribe_activity(client, { dateFrom, dateTo }),
    ]);
    const sends = JSON.parse(sendResponse.content[0].text);
    const unsubscribes = JSON.parse(unsubscribeResponse.content[0].text);

    type EmailSummary = {
      emailId: number;
      name: string | null;
      subject: string | null;
      sendRecords: number;
      readFlagged: number;
      failed: number;
      clicksDuringMonth: number;
      uniqueClickingContacts: number;
      uniqueContactLinkPairs: number;
      unsubscribesDuringMonth: number;
    };

    const byEmail = new Map<number, EmailSummary>();
    const rowFor = (emailId: number): EmailSummary => {
      let row = byEmail.get(emailId);
      if (!row) {
        row = {
          emailId, name: null, subject: null,
          sendRecords: 0, readFlagged: 0, failed: 0,
          clicksDuringMonth: 0, uniqueClickingContacts: 0,
          uniqueContactLinkPairs: 0, unsubscribesDuringMonth: 0,
        };
        byEmail.set(emailId, row);
      }
      return row;
    };

    for (const entry of sends.emails) {
      const row = rowFor(Number(entry.emailId));
      row.sendRecords = Number(entry.sendRecords);
      row.readFlagged = Number(entry.readFlagged);
      row.failed = Number(entry.failed);
    }
    for (const entry of unsubscribes.emails) {
      rowFor(Number(entry.emailId)).unsubscribesDuringMonth =
        Number(entry.unsubscribes);
    }

    // Clicks are grouped by date_hit, regardless of when an email was sent.
    const perEmailContacts = new Map<number, Set<string>>();
    const perEmailPairs = new Map<number, Set<string>>();
    const allContacts = new Set<string>();
    const allPairs = new Set<string>();
    let start = 0;
    let total = 0;
    let unattributedClicks = 0;
    const pageSize = 200;
    const maxRecords = 10000;

    do {
      const params = new URLSearchParams({
        start: String(start),
        limit: String(pageSize),
      });
      const filters = [
        ['date_hit', 'gte', `${dateFrom} 00:00:00`],
        ['date_hit', 'lt', `${dateTo} 00:00:00`],
        ['source', 'eq', 'email'],
      ];
      filters.forEach(([col, expr, val], i) => {
        params.set(`where[${i}][col]`, col);
        params.set(`where[${i}][expr]`, expr);
        params.set(`where[${i}][val]`, val);
      });

      const response = await client.v1.get('/stats/page_hits', { params });
      const page = response.data.stats;
      total = Number(response.data.total);
      if (!Array.isArray(page) || !Number.isInteger(total) || total < 0) {
        throw new Error('Unexpected click statistics response');
      }
      if (total > maxRecords) {
        throw new Error(`Click data exceeds ${maxRecords} records`);
      }
      if (page.length === 0 && start < total) {
        throw new Error('Incomplete click statistics page');
      }

      for (const hit of page) {
        if (hit.source !== 'email') {
          throw new Error('Non-email hit in click statistics');
        }
        const emailId = Number(hit.email_id);
        if (hit.email_id == null || !Number.isInteger(emailId) || emailId < 1) {
          unattributedClicks++;
          continue;
        }

        rowFor(emailId).clicksDuringMonth++;
        if (hit.lead_id != null) {
          const contactId = String(hit.lead_id);
          allContacts.add(contactId);
          if (!perEmailContacts.has(emailId)) {
            perEmailContacts.set(emailId, new Set());
          }
          perEmailContacts.get(emailId)!.add(contactId);
          if (hit.redirect_id != null) {
            const pair = JSON.stringify([emailId, contactId, String(hit.redirect_id)]);
            allPairs.add(pair);
            if (!perEmailPairs.has(emailId)) {
              perEmailPairs.set(emailId, new Set());
            }
            perEmailPairs.get(emailId)!.add(pair);
          }
        }
      }
      start += page.length;
    } while (start < total);

    for (const row of byEmail.values()) {
      row.uniqueClickingContacts = perEmailContacts.get(row.emailId)?.size ?? 0;
      row.uniqueContactLinkPairs = perEmailPairs.get(row.emailId)?.size ?? 0;
    }

    // Only fetch email metadata; never return HTML or subscriber details.
    const rows = [...byEmail.values()].sort(
      (a, b) => b.sendRecords - a.sendRecords || b.clicksDuringMonth - a.clicksDuringMonth
    );
    const missingEmails: number[] = [];
    for (let i = 0; i < rows.length; i += 5) {
      await Promise.all(rows.slice(i, i + 5).map(async (row) => {
        try {
          const response = await client.v1.get(`/emails/${row.emailId}`);
          row.name = response.data.email?.name ?? null;
          row.subject = response.data.email?.subject ?? null;
        } catch (error) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status !== 404) throw error;
          missingEmails.push(row.emailId);
        }
      }));
    }

    const result = {
      month,
      dateFrom,
      dateToExclusive: dateTo,
      totals: {
        sendRecords: sends.totalRecords,
        readFlaggedForPeriodSends: rows.reduce((sum, row) => sum + row.readFlagged, 0),
        failedForPeriodSends: rows.reduce((sum, row) => sum + row.failed, 0),
        clicksDuringMonth: total,
        uniqueClickingContactsDuringMonth: allContacts.size,
        uniqueContactLinkPairsDuringMonth: allPairs.size,
        unattributedClicks,
        unsubscribeEventsDuringMonth: unsubscribes.totalUnsubscribes,
        unattributedUnsubscribes: unsubscribes.unattributedUnsubscribes,
      },
      emails: rows,
      missingEmails,
      notes: [
        'Send records are filtered by date_sent.',
        'Read flags are current status of emails sent this month, not opens occurring this month.',
        'Clicks are filtered by date_hit; unsubscribes by date_added.',
        'Clicks and unsubscribes may belong to emails sent before this month.',
        'Unique contact/link pairs are not necessarily equal to Mautic reported unique hits.',
        'Date boundaries are passed to Mautic without timezone conversion.',
      ],
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
};
