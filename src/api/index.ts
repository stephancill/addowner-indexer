import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { asc, client, eq, graphql, or, replaceBigInts } from "ponder";
import { getUserOpsFromTransaction } from "../utils";
import {
  createPublicClient,
  http,
  numberToHex,
  PublicClient,
  type Address,
} from "viem";
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

app.get("/replayable-ops/:address", async (c) => {
  const { address } = c.req.param();

  const txnHashes = await db
    .select({
      transactionHash: schema.owners.transactionHash,
      owner: schema.owners.owner,
      index: schema.owners.index,
    })
    .from(schema.owners)
    .where(eq(schema.owners.address, address as `0x${string}`))
    .orderBy(asc(schema.owners.createdAt));

  if (!txnHashes.length) {
    return c.json([]);
  }

  const deployTxHash = txnHashes[0]?.transactionHash;

  let initCode: `0x${string}` | undefined;

  const replayableAddOwnerBlobs = await Promise.all(
    txnHashes.map(async ({ transactionHash, owner, index }) => {
      const userOpBlobs = await getUserOpsFromTransaction({
        transactionHash: transactionHash,
        bundlerClient: baseBundlerClient,
        client: baseClient as PublicClient,
        sender: address as Address,
      });

      // Populate initCode if available
      userOpBlobs.forEach(({ userOperation }) => {
        if (userOperation.initCode && userOperation.initCode !== "0x") {
          initCode = userOperation.initCode;
        }
      });

      // Replayable userOps have nonce key 8453
      const replayableUserOpBlob = userOpBlobs.find(({ userOperation }) => {
        return userOperation.nonce >> BigInt(64) === BigInt(8453);
      });

      if (!replayableUserOpBlob && transactionHash !== deployTxHash) {
        throw new Error(
          `No replayable userOp found for sender ${address} in ${transactionHash}`
        );
      }

      return { blob: replayableUserOpBlob, owner, ownerIndex: index };
    })
  );

  const serializedUserOps = replayableAddOwnerBlobs.flatMap(
    ({ blob, owner, ownerIndex }) => {
      if (!blob) return [];
      return {
        owner,
        ownerIndex,
        transactionHash: blob.transactionHash,
        userOperation: replaceBigInts(blob.userOperation, numberToHex),
      };
    }
  );

  return c.json({
    initCode,
    items: serializedUserOps,
  });
});

export default app;
