# AWS Backend Module (Rust)

Empty placeholder that mirrors the planned structure under
`src/features/aws/`.

```rust
// Mod future shape:
// pub mod ec2;
// pub mod s3;
// pub mod iam;
// pub mod lambda;
```

When the first AWS feature ships, add the corresponding submodule here,
declare it in `mod.rs`, and register the resulting `#[tauri::command]`s in
`src-tauri/src/lib.rs`.
