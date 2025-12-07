import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolVault } from "../target/types/sol_vault";
import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

anchor.setProvider(anchor.AnchorProvider.env());
const provider = anchor.getProvider() as anchor.AnchorProvider;
const program = anchor.workspace.SolVault as Program<SolVault>;

const confirm = async (signature: string) => {
  const bh = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({ signature, ...bh });
}

const fund = async (kp: PublicKey, sol = 2) => {
  const sig = await provider.connection.requestAirdrop(
    kp,
    sol * anchor.web3.LAMPORTS_PER_SOL
  );
  await confirm(sig);
}

describe("sol-vault (deterministic unlock)", () => {
  let now: number;
  const SEED = Buffer.from("vault");
  const user = (provider.wallet as anchor.Wallet).payer;
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [SEED, user.publicKey.toBuffer()],
    program.programId
  );

  beforeEach(async () => {
    // Use the latest block time (seconds)
    const slot = await provider.connection.getSlot();
    now = await provider.connection.getBlockTime(slot);

  });

  it("prevents withdrawal before unlock", async () => {
    // Set unlock time far in the future
    const unlockTime = new anchor.BN(now + 3600); // 1 hour from now
    await fund(user.publicKey, 2);

    await program.methods.initializeVault(unlockTime)
      .accounts({
        user: user.publicKey,
        vaultAccount: vaultPda,
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
    const donator = Keypair.generate();
    fund(donator.publicKey, 2);

    await program.methods.initializeVault(unlockTime)
      .accounts({
        user: user.publicKey,
        vaultAccount: vaultPda,
      })
      .signers([])
      .rpc();

    fund(vaultPda, 3);

    // Should work immediately, no waiting
    await program.methods.closeVault()
      .accounts({
        recipient: user.publicKey,
      })
      .signers([user])
      .rpc();
  });
});
