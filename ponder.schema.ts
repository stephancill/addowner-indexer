import { onchainTable } from "ponder";

export const owners = onchainTable("owners", (t) => ({
  id: t.text().primaryKey(),
  address: t.text(),
  owner: t.text(),
  index: t.integer(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));
