use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("C6hkvjdeyYjChDHx98WcJwhhsggWDDh1G3sKJZhU2WxK");

#[program]
pub mod sol_vault {
    use super::*;

    // Creates the vault with an unlock timestamp set by the user
    pub fn initialize_vault(ctx: Context<InitializeVault>, unlock_time: i64) -> Result<()> {
        ctx.accounts.vault_account.owner = ctx.accounts.user.key();
        ctx.accounts.vault_account.unlock_time = unlock_time;
        Ok(())
    }

    // Only the owner can withdraw, and only after the unlock time has passed
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= ctx.accounts.vault_account.unlock_time,
            TimelockError::VaultLocked
        );

        let vault = ctx.accounts.vault_account.to_account_info();
        let recipient = ctx.accounts.recipient.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();

        let seed = ctx.accounts.owner.key();
        let bump_seed = ctx.bumps.vault_account;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", seed.as_ref(), &[bump_seed]]];

        let cpi_ctx = CpiContext::new(
            system_program,
            Transfer {
                from: vault,
                to: recipient,
            },
        )
         .with_signer(signer_seeds);

        transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[account]
pub struct VaultAccount {
    pub owner: Pubkey,
    pub unlock_time: i64, // Unix timestamp (seconds)
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = user,
        seeds = [b"vault", user.key().as_ref()],
        bump,
        space = 8 + 32 + 8  // 8 discriminator, 32 Pubkey, 8 i64
    )]
    pub vault_account: Account<'info, VaultAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner,
    )]
    pub vault_account: Account<'info, VaultAccount>,
    pub owner: Signer<'info>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum TimelockError {
    #[msg("Vault is still locked")]
    VaultLocked,
}
