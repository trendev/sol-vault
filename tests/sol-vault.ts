import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolVault } from "../target/types/sol_vault";
import { assert, expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

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

    const vault = await program.account.vaultAccount.fetch(vaultPda);
    assert.strictEqual(vault.bump, vaultBump, "bump mismatch");
    assert(vault.owner.equals(user.publicKey), "user is not the owner");
    try {
      await program.methods.closeVault()
        .accounts({
          owner: user.publicKey,
          vaultAccount: vaultPda,
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
    const transferLamports = 1_000_000;
    const donor = Keypair.generate();
    await fund(donor.publicKey, 2);

    await program.methods.initializeVault(unlockTime)
      .accounts({
        user: user.publicKey,
        vaultAccount: vaultPda,
      })
      .signers([])
      .rpc();

    const userBalanceBefore = await provider.connection.getBalance(user.publicKey);
    const donorBalanceBefore = await provider.connection.getBalance(donor.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

    assert(vaultBalanceBefore !== 0, "vault should not be empty");
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: donor.publicKey,
        toPubkey: vaultPda,
        lamports: transferLamports,
      })
    );
    await sendAndConfirmTransaction(provider.connection, tx, [donor]);

    const donorBalanceAfter = await provider.connection.getBalance(donor.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

    assert.strictEqual(
      vaultBalanceAfter - vaultBalanceBefore,
      transferLamports,
      "vault should receive the transferred lamports"
    );
    assert(donorBalanceBefore - transferLamports >= donorBalanceAfter, "donator should only lose the transferred lamports (fees excluded)");

    // Should work immediately, no waiting
    await program.methods.closeVault()
      .accounts({
        owner: user.publicKey,
        vaultAccount: vaultPda,
        recipient: user.publicKey,
      })
      .signers([user])
      .rpc();

    const userBalanceAfter = await provider.connection.getBalance(user.publicKey);

    let failed = false;
    try {
      await program.account.vaultAccount.fetch(vaultPda);
    } catch {
      failed = true;
    }
    assert(failed, "vault is closed and should not be fetched");
    assert(userBalanceAfter <= userBalanceBefore + vaultBalanceAfter, "vault should have been withdrawn to user");
    
    const vaultBalanceAfterClose = await provider.connection.getBalance(vaultPda);
    assert.strictEqual(vaultBalanceAfterClose, 0, "vault balance should be 0");
  });
});
