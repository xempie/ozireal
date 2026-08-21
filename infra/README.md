# Deployed infrastructure — console prototype

What is actually running in AWS for the sample-data console. This is **not** the Phase 1
architecture (CLAUDE.md §11) — that needs EC2, Postgres and Redis. The prototype is a
static export, so it needs none of them.

## Account

| | |
|---|---|
| Account | `310792823958` |
| Deploy user | `ozirealty-deploy` (IAM, not root) |
| CLI profile | `ozirealty` |
| Region | `ap-southeast-2` (Sydney) |

Credentials live in `~/.aws/credentials` on the operator's machine and are never
committed. Root is not used for anything.

## Resources

| Resource | Identifier |
|---|---|
| S3 bucket | `ozirealty-console-310792823958` (private, ap-southeast-2) |
| CloudFront distribution | `E3KK59Q508X006` |
| CloudFront domain | `d1k9fpihoxh9d8.cloudfront.net` |
| Origin access control | `E182T4AZOWPCP2` |
| Viewer-request function | `ozirealty-console-auth` |

### How access is controlled

The bucket blocks public access and has **no** website hosting enabled. Its policy grants
`s3:GetObject` to the CloudFront service principal *only*, conditioned on the exact
distribution ARN — so even another distribution in the same account cannot read it.
Verified: a direct request to the S3 URL returns 403.

Everything is served through CloudFront over HTTPS, with HTTP redirected up.

### The viewer-request function

`infra/viewer-request.js` does two jobs on every request:

1. **HTTP basic auth.** The demo is an unfinished product carrying the agency's name, so
   it should not be reachable by a passer-by or indexed by a crawler. Credentials are in
   `infra/demo-credentials.txt` (gitignored).
2. **Directory-index rewrite.** The export uses `trailingSlash`, so pages live at
   `/dashboard/index.html`. CloudFront resolves a default root object at `/` only, never
   for sub-paths — without this rewrite every route except the home page 404s.

The auth is a shared password in edge JavaScript. It keeps the demo private; it is not
authentication and it protects nothing sensitive, because there is nothing sensitive
here — every person, message and price in the app is invented.

## Cost

Roughly **$1–2/month** at demo traffic: a few cents of S3 storage, and CloudFront well
inside its always-free tier. There is no compute, no database and no NAT Gateway — see
[docs/aws-cost.md](../docs/aws-cost.md) for why that last one matters.

## Redeploying

```bash
./scripts/deploy.sh
```

Rebuilds, syncs, invalidates the edge cache, and fails loudly if the export came out
short or if the auth gate stops returning 401.

## Custom domain

`crm.ozirealty.com.au`, once the certificate is issued. Two DNS records are needed at
whoever hosts the `ozirealty.com.au` zone:

1. The ACM validation `CNAME` (issued when the certificate is requested).
2. `crm` → `d1k9fpihoxh9d8.cloudfront.net`.

**Neither touches the apex, `www`, or the MX records.** The live Wix site and the
agency's email are unaffected — adding a subdomain is additive.

## What this is not

- Not the Phase 1 stack. No EC2, no RDS, no Redis, no SES.
- Not multi-environment. One bucket, one distribution.
- Not infrastructure-as-code. It was created with CLI calls, recorded here. If this
  outlives the prototype it should become Terraform or CDK rather than a document.
