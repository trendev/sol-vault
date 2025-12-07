import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { SolVault } from "../target/types/sol_vault";

// Use env provider when ANCHOR_PROVIDER_URL is set, else fall back to local
const provider = process.env.ANCHOR_PROVIDER_URL
  ? (anchor.AnchorProvider.env() as anchor.AnchorProvider)
  : anchor.AnchorProvider.local();
anchor.setProvider(provider);
const program = anchor.workspace.SolVault as anchor.Program<SolVault>;

const DEFAULT_LOCK_SECONDS = 3600;

async function main() {
  const user = (provider.wallet as anchor.Wallet).payer;
  const unlockSeconds = Number(process.env.UNLOCK_SECONDS ?? DEFAULT_LOCK_SECONDS);
  const unlockTime = new anchor.BN(
    Math.floor(Date.now() / 1000) + unlockSeconds
  );

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.publicKey.toBuffer()],
    program.programId
  );

  const signature = await program.methods
    .initializeVault(unlockTime)
    .accounts({
      user: user.publicKey,
      vaultAccount: vaultPda,
    })
    .rpc();

  console.log("Vault PDA:", vaultPda.toBase58());
  console.log("Unlocks at (unix):", unlockTime.toString());
  console.log("Transaction signature:", signature);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
