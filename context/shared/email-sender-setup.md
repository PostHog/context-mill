---
title: Set up an email sender
---

- First check that the PostHog MCP has the sender tools: `integrations-email-create`, `integrations-email-verify-create`, `integrations-domain-connect-check-retrieve`, and `integrations-domain-connect-apply-url-create`. When they are missing, go to the last bullet of this step.
- When the `setting-up-an-email-domain` skill is available, follow it. It covers the details.
- Ask which domain to send from. Recommend a subdomain such as `mail.example.com`. Use the person's own domain, never a free mailbox domain such as gmail.com.
- Never create a sender for an address that already has one: creating it again marks it unverified. For an existing unverified sender, skip to its records.
- Create the sender with `integrations-email-create`, then get its DNS records with `integrations-email-verify-create`.
- PostHog never writes DNS. Call `integrations-domain-connect-check-retrieve` with the domain. When `supported` is true, give the person the URL from `integrations-domain-connect-apply-url-create`: they approve the records at their DNS host. Otherwise, give them the records that are not `success` as a table with type, name, value, and priority.
- Always include both SPF records, merged into an existing `v=spf1` record when there is one. Never add a second `_dmarc` record when the domain already has one.
- Call `integrations-email-verify-create` again after the records are published, at least a minute apart. `success` means done. `failed` means fix the records, then verify again. After about 15 minutes of `pending` with every record published, stop and tell the person that DNS is still propagating and they can ask you to check again later.
- A 403 that says the person lacks permissions in the project means a project admin must verify the sender. Do not retry.
- **When the sender tools are missing or refused**, the agent setup for sender domains is not available to this person yet. Do not try other integration tools. Ask the person to verify a sender in PostHog: Workflows, then Channels, then add an email sender on their domain and follow the DNS steps (https://posthog.com/docs/workflows/configure-channels). Wait until they confirm that the sender shows as verified, then continue.

