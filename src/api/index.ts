import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, eq, graphql, or } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

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

export default app;
