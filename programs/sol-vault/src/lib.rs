use anchor_lang::prelude::*;

pub mod constants;
use constants::ANCHOR_DISCRIMINATOR_SIZE;

declare_id!("C6hkvjdeyYjChDHx98WcJwhhsggWDDh1G3sKJZhU2WxK");

#[program]
pub mod sol_vault {
    use super::*;

    /// Create or reinitialize the vault with an unlock timestamp set by the user
    pub fn initialize_vault(ctx: Context<InitializeVault>, unlock_time: i64) -> Result<()> {
        let vault = &mut ctx.accounts.vault_account;
        let clock = Clock::get()?;

        if vault.owner == Pubkey::default() {
            // skip on future calls
            vault.owner = ctx.accounts.user.key();
        }

        /// A owner can change the lock-time, yes.
        /// For production purpose, you can return an Error instead...
        if clock.unix_timestamp <= unlock_time {
            msg!("Unlock time should be in the future...");
        }
        vault.unlock_time = unlock_time; // user can lock/unlock vault
        Ok(())
    }

    /// Only the owner can close the vault, and only after unlock time has passed.
    /// Closing sends *all* vault lamports to the recipient and deletes the account.
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= ctx.accounts.vault_account.unlock_time,
            TimelockError::VaultLocked
        );
        // Anchor's `close` constraint does all lamport transfer & account deletion.
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
    pub owner: Pubkey,
    pub unlock_time: i64, // Unix timestamp (seconds)
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"vault", user.key().as_ref()],
        bump,
        space = ANCHOR_DISCRIMINATOR_SIZE + VaultAccount::INIT_SPACE,
    )]
    pub vault_account: Account<'info, VaultAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner,
        close = recipient, // Sends all lamports & closes account
    )]
    pub vault_account: Account<'info, VaultAccount>,
    pub owner: Signer<'info>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
}

#[error_code]
pub enum TimelockError {
    #[msg("Vault is still locked")]
    VaultLocked,
}
