# Publishing Headquarters — V1 foundation

## Product direction
Brandon Books & Stories begins with Brandon D. Coleman Jr.'s existing author brand and seven-book catalog, then expands into a carefully moderated home for independent authors and readers.

## Current milestone
- Public publishing vision page: `website/publishing.html`
- Responsive page styles: `website/publishing.css`
- Home navigation link to the publishing page.
- No public manuscript intake or upload is enabled.
- No author portal or administrator login is represented as functional yet.

## Required before accepting submissions
1. Choose and configure a persistent database for author profiles, submissions, status history, and audit events.
2. Configure secure authentication with owner/reviewer roles and least-privilege access.
3. Configure private object storage for manuscript files; never store manuscripts in public website assets or Git.
4. Add explicit privacy notice, retention policy, file size/type limits, malware scanning, and deletion workflow.
5. Add submission consent and rights acknowledgement. A submission must not transfer copyright or grant publication rights by itself.
6. Build reviewer queues, notes, decisions, notifications, and an auditable status history.
7. Test authorization, upload restrictions, rate limiting, CSRF protections where applicable, and backup/restore.
8. Only after those checks, enable the author application and manuscript submission form.

## Planned author statuses
- Draft
- Submitted
- Initial review
- More information requested
- Accepted for discussion
- Declined
- Withdrawn
- Agreement pending
- In production
- Published

These statuses are workflow labels, not promises of acceptance or publication.

## Owner dashboard modules
- Overview and activity
- Books and editions
- Authors and profiles
- Author applications
- Manuscript submissions
- Review queue and decisions
- Reader reviews and moderation
- Publishing announcements
- Roles, audit log, and settings

## Guardrails
- Keep production website and Discord bot unchanged until an explicit release approval.
- Keep all work on `feature/publishing-headquarters-v1` until reviewed.
- Do not invent author contact details, contracts, fees, ISBNs, book metadata, or retailer URLs.
- Do not accept manuscript files until secure storage and access controls are operational.
- Remove the abandoned Android release branch only through an authorized GitHub branch-delete action; the current connected GitHub toolset exposes branch reads and writes but not branch deletion.
