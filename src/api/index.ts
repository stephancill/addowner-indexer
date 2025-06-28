import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { asc, client, eq, graphql, or } from "ponder";
import { getUserOpsFromTransaction } from "../utils";
import { createPublicClient, http, PublicClient, type Address } from "viem";
import { base } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.PONDER_RPC_URL_8453!),
});

const baseBundlerClient = createBundlerClient({
  chain: base,
  transport: http(process.env.PONDER_RPC_URL_8453!),
});

app.get("/events/:address", async (c) => {
  const { address } = c.req.param();
  const events = await db
    .select()
    .from(schema.owners)
    .where(
      or(
        eq(schema.owners.address, address as `0x${string}`),
        eq(schema.owners.owner, address as `0x${string}`)
      )
    );
  return c.json(events);
});

app.get("/ops/:address", async (c) => {
  const { address } = c.req.param();

  const txnHashes = await db
  .select({
    transactionHash: schema.owners.transactionHash,
  })
  .from(schema.owners)
  .where(
      eq(schema.owners.address, address as `0x${string}`)
  )
  .orderBy(asc(schema.owners.createdAt));

  if (!txnHashes.length) {
    return c.json([]);
  }
  
  const deployTxHash = txnHashes[0]?.transactionHash;

  const addOwnerUserOps = await Promise.all(
    txnHashes.map(async ({ transactionHash }) => {
      const userOps = await getUserOpsFromTransaction({
        transactionHash: transactionHash,
        bundlerClient: baseBundlerClient,
        client: baseClient as PublicClient,
        sender: address as Address,
      });

      // Replayable userOps have nonce key 8453
      const replayableUserOp = userOps.find(({ userOperation }) => {
        return userOperation.nonce >> BigInt(64) === BigInt(8453);
      });

      if (!replayableUserOp && transactionHash !== deployTxHash) {
        throw new Error(
          `No replayable userOp found for ${transactionHash}`
        );
      }

      return replayableUserOp;
    })
  );

  // TODO: UserOperation is probably not JSON serializable
  const serializedUserOps = addOwnerUserOps.flatMap((userOp) => {
    if (!userOp) return []
    return {
      transactionHash: userOp.transactionHash,
      userOperation: userOp.userOperation,
    };
  });

  return c.json(serializedUserOps);
});

export default app;
