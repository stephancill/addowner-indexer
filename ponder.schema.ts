import { onchainTable } from "ponder";

export const owners = onchainTable("owners", (t) => ({
  id: t.text().primaryKey(),
  address: t.hex(),
  owner: t.hex(),
  index: t.integer(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));
