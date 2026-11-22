# Change Log
All notable changes to this project will be documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Added `get_report` for retrieving existing Mautic reports with date filters and pagination
- Added `get_email_activity` to summarize send records, current read flags, and failure flags for a date range using Mautic's `email_stats` data
- Added `get_email_click_activity` to retrieve date-filtered tracked link clicks and calculate unique contacts, links, and contact/link combinations
- Added `get_email_unsubscribe_activity` to count recipient unsubscribe events by occurrence date and associate them with emails when Mautic provides attribution
- Added `get_email_monthly_report` to consolidate sends, read flags, clicks, and unsubscribes into one calendar-month response with per-email names and subjects
- Added validation, pagination, and record limits to new reporting tools to avoid silently returning incomplete large data sets
- Added a default read-only tool allowlist, exposing nine approved email and reporting tools and rejecting direct calls to other tools
- Added `MCP_ALLOW_WRITES=1` as an explicit opt-in for the inherited full tool registry
- Established and validated a local ChatGPT connection using OpenAI Secure MCP Tunnel and the existing STDIO transport

### Changed
- Adapted reporting functionality for the classic Mautic REST API, validated against Mautic 4.4.10
- Reused date-filtered send and unsubscribe reporting handlers in the consolidated monthly report
- Kept send, click, and unsubscribe activity on their respective occurrence-date fields rather than treating cumulative email statistics as monthly results
- Returned aggregate monthly metrics without subscriber-level records
- Documented the purpose of the EMRL fork, local development setup, metric definitions, read-only access, and tunnel-based ChatGPT connectivity

### Fixed
- Corrected `get_email_stats` to retrieve cumulative email metrics from `/emails/{id}` instead of an unavailable `/emails/{id}/stats` endpoint
- Distinguished the current read status of period sends from opens actually occurring during the period
- Preserved the distinction between raw unique contact/link combinations and Mautic's reported unique hits, which do not always reconcile
