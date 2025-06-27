import { ponder } from "ponder:registry";
import { owners } from "../ponder.schema";

ponder.on("CoinbaseSmartWallet:AddOwner", async ({ event, context }) => {
  const { index, owner } = event.args;
  await context.db.insert(owners).values({
    id: event.id,
    index: Number(index),
    owner,
    address: event.log.address,
    createdAt: new Date(Number(event.block.timestamp) * 1000),
    updatedAt: new Date(Number(event.block.timestamp) * 1000),
  });
});
