import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolVault } from "../target/types/sol_vault";
import { expect } from "chai";

describe("sol-vault (deterministic unlock)", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.SolVault as Program<SolVault>;
  const provider = anchor.getProvider();
  const user = (provider.wallet as anchor.Wallet).payer;

  let vaultPda: anchor.web3.PublicKey;
  const SEED = Buffer.from("vault");

  let now: number;

  beforeEach(async () => {
    // Use the latest block time (seconds)
    const slot = await provider.connection.getSlot();
    now = await provider.connection.getBlockTime(slot);
    [vaultPda] = await anchor.web3.PublicKey.findProgramAddress(
      [SEED, user.publicKey.toBuffer()],
      program.programId
    );
  });

  it("prevents withdrawal before unlock", async () => {
    // Set unlock time far in the future
    const unlockTime = new anchor.BN(now + 3600); // 1 hour from now

    // Fund the vault PDA so it can pay out
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(vaultPda, 2_000_000_000),
      "confirmed"
    );

    await program.methods.initializeVault(unlockTime)
      .accounts({
        user: user.publicKey,
      })
      .signers([])
      .rpc();

    try {
      await program.methods.closeVault()
        .accounts({
          recipient: user.publicKey,
        })
        .signers([user])
        .rpc();

      throw new Error("Should have failed because vault is locked");
    } catch (e: any) {
      expect(e.message).to.match(/Vault is still locked/);
    }
  });

  it("allows withdrawal after unlock", async () => {
    // Set unlock time in the past
    const unlockTime = new anchor.BN(now - 3600); // 1 hour ago

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(vaultPda, 2_000_000_000),
      "confirmed"
    );

    await program.methods.initializeVault(unlockTime)
      .accounts({
        user: user.publicKey,
      })
      .signers([])
      .rpc();

    // Should work immediately, no waiting
    await program.methods.closeVault()
      .accounts({
        recipient: user.publicKey,
      })
      .signers([user])
      .rpc();
  });
});
