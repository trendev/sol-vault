use anchor_lang::prelude::*;

declare_id!("C6hkvjdeyYjChDHx98WcJwhhsggWDDh1G3sKJZhU2WxK");

#[program]
pub mod sol_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
