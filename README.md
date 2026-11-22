# EMRL Mautic MCP

An EMRL-maintained fork of [Cbrown35/mantic-MCP](https://github.com/Cbrown35/mantic-MCP), adapted to make Mautic email reporting accessible to ChatGPT through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

The primary purpose of this fork is to retrieve consistent, date-specific email performance data from EMRL-managed Mautic instances and turn it into useful client reporting, without relying on a third-party marketing analytics service.

**Current status:** The reporting tools have been tested against **Mautic 4.4.10** and a local MCP server has been connected successfully to ChatGPT through OpenAI's Secure MCP Tunnel. A permanent Ubuntu deployment is planned, not yet documented as complete.

## Why this fork exists

The upstream project is a broad Mautic integration focused on Mautic 7. EMRL's immediate need is different: connect existing Mautic 4 installations directly to ChatGPT, retrieve monthly email activity, and make the results reliable enough to discuss with clients.

This fork retains the upstream tool modules while adding:

- **Mautic 4 reporting support:** Tested against the classic `/api/` endpoints and OAuth2 client credentials.
- **Date-specific metrics:** Send records, current read flags, tracked link clicks, and recipient unsubscribe events.
- **One-call monthly reporting:** A consolidated report with per-email attribution and month-wide totals.
- **Configurable tool access:** `reporting` exposes nine reporting tools; the default `readonly` mode exposes 31 approved read operations; `full` exposes all 67 registered tools, including write operations.
- **Private ChatGPT access:** The existing STDIO MCP server can be reached using OpenAI's Secure MCP Tunnel, without running a public HTTP endpoint.

The longer-term objective is to support reporting across multiple EMRL-managed Mautic instances. **The current process connects to one Mautic instance per server configuration.** Multi-instance configuration and unattended production deployment are future work.

## Tool access modes

Set `MCP_ACCESS_MODE` to select which tools the server advertises and permits. If the variable is unset, the server uses `readonly`. An unrecognized value causes startup to fail rather than silently changing permissions.

| Mode | Tools | Access |
| --- | ---: | --- |
| `reporting` | 9 | Tested email activity and Mautic report tools only |
| `readonly` | 31 | The nine reporting tools plus 22 approved GET-only operations across contacts, campaigns, forms, segments, assets, and related entities (**default**) |
| `full` | 67 | Every registered tool, including sending emails, updating data, and deleting records |

Tool discovery and direct tool execution enforce the same access rules. Switching modes requires restarting the MCP server or its tunnel-managed child process. This setting replaces the previous `MCP_ALLOW_WRITES` boolean; the old variable is no longer used.

**Read-only does not mean anonymous or non-sensitive.** Some approved read operations return contact details, form submissions, or activity histories. The broader inherited tools have not all been verified against Mautic 4.4.10. `full` mode should only be enabled for expressly authorized administration, not general client reporting.

## Reporting tools

These nine tools are available in all three modes:

| Tool | Purpose |
| --- | --- |
| `get_email_monthly_report` | Consolidated monthly sends, read flags, clicks, unsubscribes, and per-email metadata |
| `get_email_activity` | Send records, current read flags, and failure flags for emails sent in a date range |
| `get_email_click_activity` | Link hits and unique interactions for an individual email within a date range |
| `get_email_unsubscribe_activity` | Recipient unsubscribe events by occurrence date and associated email ID |
| `get_email_stats` | Current cumulative send and read statistics for an email |
| `list_emails` | List available emails |
| `get_email` | Retrieve email details |
| `list_reports` | List configured Mautic reports |
| `get_report` | Retrieve a configured Mautic report with filters and pagination |

The default `readonly` mode also includes approved discovery operations such as `list_campaigns`, `get_campaign`, `list_segments`, and `search_contacts`. Mautic 7-specific operations and modifying operations remain unavailable unless `MCP_ACCESS_MODE=full`. The availability of a tool does not guarantee that its API endpoint is supported by the connected Mautic version.

### Monthly report

`get_email_monthly_report` accepts a calendar month in `YYYY-MM` format:

```json
{
  "month": "2026-10"
}
```

Its response includes:

- Calendar-month boundaries, with an exclusive end date.
- Overall send records, read flags, failed sends, tracked clicks, unique clicking contacts, and unsubscribe events.
- Per-email names, subjects, send activity, click activity, and attributed unsubscribes.
- Notes explaining what each metric represents.
- A list of email IDs whose metadata could not be retrieved.

For example, the October 2026 validation against King's Mautic instance returned **223 send records, 117 tracked clicks, 10 distinct clicking contacts, and one unsubscribe event**. These are historical test observations, not fixtures or guaranteed future results.

### Interpreting the metrics

**The date fields matter.** A monthly report combines different types of activity, and they must not be mistaken for equivalent measurements.

| Metric | Date basis | Interpretation |
| --- | --- | --- |
| Send records | `date_sent` | Emails sent during the selected period |
| Read flagged | Current `is_read` value for those send records | Current read status of emails sent during the period, not opens that necessarily occurred during it |
| Failed | Current `is_failed` value for those send records | Current failure status of emails sent during the period |
| Clicks | `date_hit` | Tracked link activity occurring during the period, including clicks on older emails |
| Unique clicking contacts | Distinct contact IDs among period clicks | Deduplicated across emails at the monthly total level |
| Unique contact/link pairs | Distinct email, contact, and tracked-link combinations | Not necessarily identical to Mautic's own `unique_hits` field |
| Unsubscribes | `date_added` | Recipient unsubscribe events occurring during the period, attributed by `channel_id` when available |

Additional rules and limitations:

- Date ranges are **start-inclusive and end-exclusive**. The MCP server passes Mautic date strings without timezone conversion.
- Recipient unsubscribes are filtered to the `email` channel and reason `1`. Bounce and manual do-not-contact records are not counted as recipient unsubscribes.
- An email with no sends in the selected month can still have clicks or unsubscribes during that month.
- Monthly clicks should **not** be divided by that month's send count to produce a conventional campaign click-through rate; the clicks may come from emails sent in earlier months.
- Distinct tracked clicks do not necessarily represent human engagement. Security scanners and automated link checks can generate hits.
- Raw Mautic records and Mautic's cumulative email statistics can differ. We have observed differences in read and unique-click totals; the reporting tools preserve their own explicitly defined measurement methods rather than silently forcing agreement.
- The current data retrieval functions cap each relevant result set at **10,000 records** and fail rather than silently returning a partial report when that limit is exceeded.

The consolidated monthly report returns aggregate statistics and email metadata, **not contact-level records**. Other read-only tools, particularly `get_report`, may reveal sensitive information if a Mautic report is configured to include it. Control access to the MCP service and Mautic account accordingly.

## Requirements

- Node.js with npm. **Node.js 24** was used for the verified local development setup.
- An accessible Mautic instance with the classic REST API enabled.
- A Mautic OAuth2 application using the `client_credentials` grant, with the permissions needed to read the relevant records.
- A local MCP client or OpenAI Secure MCP Tunnel for ChatGPT access.

The reporting features were verified on Mautic **4.4.10**. The fork still contains upstream Mautic 7-oriented tools, but their compatibility has not been independently validated as part of EMRL's reporting work.

## Local installation

Clone the EMRL fork and install its pinned dependencies:

```bash
git clone https://github.com/EMRL/mantic-MCP.git
cd mantic-MCP
npm ci
npm run build
```

### Configure Mautic credentials

The server reads its configuration from **environment variables**. The included `.env.example` is a reference only; the application does **not** automatically load a `.env` file.

For a local shell session:

```bash
export MAUTIC_BASE_URL="https://your-mautic.example.com/api/"
export MAUTIC_TOKEN_ENDPOINT="https://your-mautic.example.com/oauth/v2/token"
export MCP_ACCESS_MODE=readonly

read -r -p "Mautic client ID: " MAUTIC_CLIENT_ID
read -r -s -p "Mautic client secret: " MAUTIC_CLIENT_SECRET
echo
export MAUTIC_CLIENT_ID MAUTIC_CLIENT_SECRET
```

Never commit credentials, access tokens, tunnel runtime keys, or populated `.env` files. For production, use a protected service environment file or an appropriate secret-management system.

| Variable | Required | Description |
| --- | --- | --- |
| `MAUTIC_BASE_URL` | Yes | Classic Mautic API base URL, including `/api/` |
| `MAUTIC_TOKEN_ENDPOINT` | Yes | OAuth2 token endpoint, typically `/oauth/v2/token` |
| `MAUTIC_CLIENT_ID` | Yes | Mautic OAuth2 client ID |
| `MAUTIC_CLIENT_SECRET` | Yes | Mautic OAuth2 client secret |
| `MCP_ACCESS_MODE` | No | `readonly` by default (31 tools); `reporting` for 9 tools; `full` for all 67 tools |

### Test with MCP Inspector

Build the project and launch Inspector from the same shell that contains the Mautic environment variables:

```bash
npm run build
npx --yes @modelcontextprotocol/inspector@v1-latest node build/index.js
```

In Inspector, connect to the STDIO process and run **List Tools**. The expected counts are **31 tools** for default `readonly` mode, **9** for `reporting`, and **67** for `full`. To test another mode, export a different `MCP_ACCESS_MODE` value and restart the server. Verify that write tools such as `send_email` are absent outside `full` mode. Do not execute write operations simply to test discovery.

Run `get_email_monthly_report` for a month with known activity and compare the figures with Mautic.

To run the MCP server directly without Inspector:

```bash
node build/index.js
```

It communicates over STDIO, so it will remain attached to the terminal while waiting for MCP requests. This is expected. Use stderr for diagnostics; stdout is reserved for the MCP protocol.

## Connect to ChatGPT through Secure MCP Tunnel

This is the verified local connection method. It does **not** require modifying the MCP server to expose HTTP or publishing an Apache endpoint.

### 1. Create the tunnel and runtime key

In the OpenAI Platform:

1. Create a tunnel under [Tunnels](https://platform.openai.com/settings/organization/tunnels).
2. Create a separate [runtime API key](https://platform.openai.com/settings/organization/api-keys) with the appropriate **Tunnels Read + Use** permissions.
3. Keep the tunnel ID and runtime key available to the local host. Do not use an admin API key as the long-lived tunnel runtime key.

### 2. Install the tunnel client

Use the supported tunnel-client release for the host architecture. Verify the installed client and its configuration syntax:

```bash
./tunnel-client --version
./tunnel-client help quickstart
```

### 3. Initialize a STDIO profile

The following assumes the `tunnel-client` executable is in the current directory and the MCP repo is located at `~/mantic-MCP`:

```bash
read -r -s -p "OpenAI runtime API key: " CONTROL_PLANE_API_KEY
echo
export CONTROL_PLANE_API_KEY

read -r -p "Tunnel ID: " CONTROL_PLANE_TUNNEL_ID

./tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile emrl-local \
  --tunnel-id "$CONTROL_PLANE_TUNNEL_ID" \
  --mcp-command "node $HOME/mantic-MCP/build/index.js"

./tunnel-client doctor --profile emrl-local --explain
```

Ensure Node.js is on `PATH` and the **Mautic environment variables are present in the same shell** before launching the tunnel. The tunnel client starts the MCP child process using those settings.

### 4. Start and verify

```bash
./tunnel-client run --profile emrl-local
```

Keep that terminal running. In a second terminal, check the local readiness endpoint (the sample profile uses port 8080):

```bash
curl -fsS http://127.0.0.1:8080/readyz
```

A response of `ready` confirms tunnel-client readiness, **not** the success of an end-to-end Mautic request. To verify the complete connection, create or select the corresponding custom MCP plugin in ChatGPT and invoke `get_email_monthly_report`.

The WSL development tunnel was successfully used to query a Mautic monthly report directly from ChatGPT. The local tunnel must remain running for subsequent calls.

## Deployment direction

Production deployment is planned for an **Ubuntu 20.04 server running Apache**, alongside EMRL-managed Mautic instances. This is a proposed operating layout, not a claim that production hosting is already configured.

```text
/opt/emrl-mcp/               Node.js application and dependencies
restricted environment file Mautic credentials and runtime configuration
systemd service             Long-running tunnel client and MCP process
Apache                      Existing Mautic virtual hosts, unchanged
```

Use a dedicated unprivileged service account, restrict access to credentials, configure supervised startup, and verify service health after restarts. A secure tunnel needs outbound connectivity; a new public MCP endpoint or Apache reverse proxy is not required for this approach.

Ubuntu 20.04 is beyond standard security maintenance. Confirm the host's extended-security-maintenance coverage or plan an OS upgrade before treating it as a long-term production platform.

## Code structure

```text
src/
├── index.ts             Server startup, STDIO transport, access-mode allowlists
├── api/
│   └── client.ts        Mautic API clients and OAuth2 token handling
├── tools/
│   ├── index.ts         Tool registration and dispatch
│   ├── emails.ts        Email reporting and inherited email operations
│   ├── monthly.ts       Consolidated monthly email report
│   ├── integration.ts   Mautic reports, webhooks, and other integrations
│   └── ...              Inherited contact, campaign, and other modules
└── types/               Shared MCP and Mautic types
```

To add a new tool, define it in the appropriate module and register its module in `src/tools/index.ts` if it is new. In `src/index.ts`, add it to `REPORTING_TOOLS` if it belongs in the restricted reporting mode, or to `ADDITIONAL_READ_ONLY_TOOLS` if it has been reviewed as a safe read operation. New tools otherwise remain available only in `full` mode. Rebuild and test tool discovery and execution before committing.

## Troubleshooting

- **Tools are missing:** Check `MCP_ACCESS_MODE` and the tool allowlists; the default `readonly` mode exposes 31 tools, while `reporting` exposes 9. Rebuild and restart the MCP process after source changes.
- **Mautic authentication fails:** Confirm the OAuth2 application, token endpoint, client ID, client secret, and API access permissions.
- **Inspector works but the tunnel cannot access Mautic:** Confirm that the tunnel process inherited the same Mautic environment variables, and that its Node executable resolves correctly.
- **Tunnel readiness passes but ChatGPT calls fail:** A ready tunnel does not guarantee successful tool execution. Check the tunnel-client logs, MCP process stderr, and Mautic API response.
- **Report counts differ from Mautic's dashboard:** First compare date fields, cumulative versus period-specific figures, and the definitions of read and unique-click metrics.
- **Large reporting period fails:** The reporting functions have a 10,000-record safety limit for individual data sets. Split the period or adjust the implementation deliberately after reviewing pagination and resource usage.

## Upstream project and attribution

This repository is derived from [Cbrown35/mantic-MCP](https://github.com/Cbrown35/mantic-MCP), which provides the original Mautic MCP server and its broader Mautic 7 toolset. EMRL's changes focus on Mautic 4 reporting, metric interpretation, configurable access modes, and private ChatGPT connectivity.

The inherited `package.json` currently reports version `2.0.0`; this is **not** an EMRL-specific release number. EMRL changes are tracked in [CHANGELOG.md](CHANGELOG.md).

**Licensing note:** No `LICENSE` file was present in the fork or upstream repository when this documentation was prepared. Verify the original project's licensing terms with its author before redistributing or asserting a particular license for the fork.
