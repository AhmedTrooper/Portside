# Git Backend Module (Rust)

Empty placeholder that mirrors the planned structure under
`src/features/git/`.

```rust
// Mod future shape:
// pub mod repos;
// pub mod commits;
```

When the first git feature ships, add the corresponding submodule here,
declare it in `mod.rs`, and register the resulting `#[tauri::command]`s in
`src-tauri/src/lib.rs`.
