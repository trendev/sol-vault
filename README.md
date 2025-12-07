# Sol Vault

A minimal SOL timelock vault built with Anchor. Users create a vault PDA tied to their wallet, pick an unlock timestamp, send lamports to the PDA, and later close the vault to reclaim all funds. No custom tokens, just SOL; cheap and fast.

## How it works
- `initialize_vault(unlock_time: i64)`: creates or reconfigures the caller’s vault PDA at seeds `["vault", user]`. Stores owner, bump, and unlock timestamp.
- `close_vault(recipient)`: only the owner can close, and only when `Clock::unix_timestamp >= unlock_time`. Closing transfers all lamports from the vault to `recipient` and deletes the account.
- Deposits are plain system transfers sent directly to the vault PDA; the program does not hold instructions for deposits.

## Current behaviors to know
- The `init_if_needed` constraint allows re-calling `initialize_vault`, so the owner can change the unlock time. For stricter locks, replace the informational log with a `require!(clock.unix_timestamp <= unlock_time, TimelockError::VaultLocked)` or a new error to prevent shortening the lock.
- Program ID: `C6hkvjdeyYjChDHx98WcJwhhsggWDDh1G3sKJZhU2WxK`.

## Quick start
1. Install Solana CLI and Anchor (built with Anchor `0.32.1`).
2. Install JS deps: `yarn install`.
3. Build program: `anchor build`.
4. Run tests (local validator): `anchor test`.
5. After deploying, run the init helper: `UNLOCK_SECONDS=3600 yarn init:vault` (prints the vault PDA and transaction signature for explorer use).

If the test validator port `8899` is busy, stop the existing validator or run Anchor with a different `--provider.cluster`/port.

### Provider setup for scripts
- Devnet (example): `ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json UNLOCK_SECONDS=3600 yarn init:vault`
- Localnet fallback: if `ANCHOR_PROVIDER_URL` is unset, the script defaults to `AnchorProvider.local()` (localhost:8899 with `~/.config/solana/id.json`).

## Key files
- Program: `programs/sol-vault/src/lib.rs`
- TS tests: `tests/sol-vault.ts`
- Anchor config: `Anchor.toml`

## Support / Donation
If this vault is useful, consider sending a small SOL tip to `7BnaEiWBh6sve5cvNpTMVvbpr13QartFeR1VU5XXMbz8`.

## Minimal usage flow (localnet)
1. Airdrop SOL to your wallet.
2. Call `initialize_vault` with an unlock timestamp (seconds).
3. Transfer lamports to the vault PDA (seeded by `["vault", user]`).
4. After the unlock time, call `close_vault` to withdraw all lamports to your chosen recipient and close the account.
