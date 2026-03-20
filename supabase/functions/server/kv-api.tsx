import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const kvApiRouter = new Hono();

// POST /make-server-f8b491be/kv - Set a key-value pair
kvApiRouter.post("/make-server-f8b491be/kv", async (c) => {
  try {
    const { key, value } = await c.req.json();
    if (!key || value === undefined) {
      return c.json({ error: "key and value are required" }, 400);
    }
    await kv.set(key, value);
    console.log(`KV set: ${key}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`KV set error: ${err.message}`);
    return c.json({ error: `Failed to set KV: ${err.message}` }, 500);
  }
});

// GET /make-server-f8b491be/kv/:key - Get a value by key
kvApiRouter.get("/make-server-f8b491be/kv/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const value = await kv.get(key);
    if (value === null || value === undefined) {
      return c.json({ error: "Key not found" }, 404);
    }
    return c.json({ key, value });
  } catch (err: any) {
    console.log(`KV get error: ${err.message}`);
    return c.json({ error: `Failed to get KV: ${err.message}` }, 500);
  }
});

// POST /make-server-f8b491be/kv/prefix - Get all values by key prefix
kvApiRouter.post("/make-server-f8b491be/kv/prefix", async (c) => {
  try {
    const { prefix } = await c.req.json();
    if (!prefix) {
      return c.json({ error: "prefix is required" }, 400);
    }
    const results = await kv.getByPrefix(prefix);
    return c.json({ results });
  } catch (err: any) {
    console.log(`KV prefix error: ${err.message}`);
    return c.json({ error: `Failed to get by prefix: ${err.message}` }, 500);
  }
});

// DELETE /make-server-f8b491be/kv/:key - Delete a key
kvApiRouter.delete("/make-server-f8b491be/kv/:key", async (c) => {
  try {
    const key = c.req.param("key");
    await kv.del(key);
    console.log(`KV deleted: ${key}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`KV delete error: ${err.message}`);
    return c.json({ error: `Failed to delete KV: ${err.message}` }, 500);
  }
});

export { kvApiRouter };
