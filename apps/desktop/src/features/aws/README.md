# AWS Feature Module

Placeholder for future AWS tooling integration.

## Planned layout

```
aws/
├── README.md
├── AwsPage.tsx           # dashboard at /aws
├── ec2/                  # instances, security groups, key pairs
├── s3/                   # buckets, objects
├── iam/                  # users, roles, policies
└── lambda/               # functions, layers, triggers
```

Each sub-resource should mirror the `docker/containers/` and `docker/images/`
pattern:

- a thin page wrapper that hosts a heading and the table component
- a virtualized table with `<DropdownMenu>` for resource-specific actions
- backend commands in `src-tauri/src/aws/<resource>.rs`, registered in
  `src-tauri/src/lib.rs` and re-exported through `src-tauri/src/aws/mod.rs`

Until the first AWS feature ships, this directory contains only this README
and the `AwsPage.tsx` placeholder below (so the route is wired but renders an
empty dashboard).
