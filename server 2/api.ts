import { Hono } from "hono";
import { createDb } from "./db";
import { DatabaseStorage } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
import { insertSongSchema, insertAnnouncementVideoSchema, insertSeedBankSchema } from "../shared/schema";

type Bindings = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ADMIN_WALLET_ADDRESS: string;
};

export function createApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  // Helper to get storage instance per request
  function getStorage(env: Bindings) {
    const db = createDb(env.DB);
    return new DatabaseStorage(db);
  }

  // User login
  app.post("/api/users/login", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress } = api.users.login.input.parse(body);
      const storage = getStorage(c.env);

      let user = await storage.getUserByWallet(walletAddress);

      if (!user) {
        user = await storage.createUser({ walletAddress });
        return c.json(user, 201);
      } else {
        user = await storage.updateUserLogin(user.id);
        return c.json(user, 200);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        }, 400);
      }
      throw err;
    }
  });

  // Sync balances
  app.post("/api/users/sync-balances", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress, budBalance, terpBalance } = body;
      const storage = getStorage(c.env);
      const user = await storage.updateUserBalances(walletAddress, budBalance, terpBalance);
      return c.json(user);
    } catch (err) {
      return c.json({ message: "Failed to sync balances" }, 500);
    }
  });

  // Get user by wallet
  app.get("/api/users/:walletAddress", async (c) => {
    const storage = getStorage(c.env);
    const user = await storage.getUserByWallet(c.req.param("walletAddress"));
    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }
    return c.json(user);
  });

  // Config
  app.get("/api/config", (c) => {
    return c.json({ network: "testnet" });
  });

  // Leaderboards
  app.get("/api/leaderboard/harvests", async (c) => {
    try {
      const storage = getStorage(c.env);
      const leaderboard = await storage.getHarvestLeaderboard(20);
      return c.json(leaderboard);
    } catch (err) {
      console.error("Failed to get harvest leaderboard:", err);
      return c.json({ message: "Failed to get leaderboard" }, 500);
    }
  });

  app.get("/api/leaderboard/bud", async (c) => {
    try {
      const storage = getStorage(c.env);
      const leaderboard = await storage.getBudLeaderboard(20);
      return c.json(leaderboard);
    } catch (err) {
      console.error("Failed to get BUD leaderboard:", err);
      return c.json({ message: "Failed to get leaderboard" }, 500);
    }
  });

  app.get("/api/leaderboard/terp", async (c) => {
    try {
      const storage = getStorage(c.env);
      const leaderboard = await storage.getTerpLeaderboard(20);
      return c.json(leaderboard);
    } catch (err) {
      console.error("Failed to get TERP leaderboard:", err);
      return c.json({ message: "Failed to get leaderboard" }, 500);
    }
  });

  // Global stats
  app.get("/api/stats/global", async (c) => {
    try {
      const storage = getStorage(c.env);
      const stats = await storage.getGlobalStats();
      return c.json(stats);
    } catch (err) {
      console.error("Failed to get global stats:", err);
      return c.json({ message: "Failed to get stats" }, 500);
    }
  });

  // Record harvest
  const recordHarvestSchema = z.object({
    walletAddress: z.string().min(58).max(58),
    budEarned: z.string().regex(/^\d+$/),
    terpEarned: z.string().regex(/^\d+$/).default("0"),
    isRareTerp: z.boolean().default(false),
  });

  app.post("/api/stats/record-harvest", async (c) => {
    try {
      const body = await c.req.json();
      const parsed = recordHarvestSchema.parse(body);
      const storage = getStorage(c.env);
      const stats = await storage.recordHarvest(
        parsed.walletAddress,
        parsed.budEarned,
        parsed.terpEarned,
        parsed.isRareTerp
      );
      return c.json(stats);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        }, 400);
      }
      console.error("Failed to record harvest:", err);
      return c.json({ message: "Failed to record harvest" }, 500);
    }
  });

  // Jukebox API endpoints
  app.get("/api/jukebox/songs", async (c) => {
    try {
      const storage = getStorage(c.env);
      const allSongs = await storage.getAllSongs();
      return c.json(allSongs);
    } catch (err) {
      console.error("Failed to get songs:", err);
      return c.json({ message: "Failed to get songs" }, 500);
    }
  });

  app.post("/api/jukebox/songs", async (c) => {
    try {
      const body = await c.req.json();
      const songData = insertSongSchema.parse(body);
      const storage = getStorage(c.env);
      const song = await storage.createSong(songData);
      return c.json(song, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        }, 400);
      }
      console.error("Failed to create song:", err);
      return c.json({ message: "Failed to create song" }, 500);
    }
  });

  app.delete("/api/jukebox/songs/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"));
      if (isNaN(id)) {
        return c.json({ message: "Invalid song ID" }, 400);
      }
      const storage = getStorage(c.env);
      await storage.deleteSong(id);
      return c.body(null, 204);
    } catch (err) {
      console.error("Failed to delete song:", err);
      return c.json({ message: "Failed to delete song" }, 500);
    }
  });

  app.post("/api/jukebox/songs/:id/play", async (c) => {
    try {
      const id = parseInt(c.req.param("id"));
      if (isNaN(id)) {
        return c.json({ message: "Invalid song ID" }, 400);
      }
      const storage = getStorage(c.env);
      const song = await storage.incrementPlayCount(id);
      if (!song) {
        return c.json({ message: "Song not found" }, 404);
      }
      return c.json(song);
    } catch (err) {
      console.error("Failed to update play count:", err);
      return c.json({ message: "Failed to update play count" }, 500);
    }
  });

  // Announcement Video API endpoints
  app.get("/api/announcement/current", async (c) => {
    try {
      const storage = getStorage(c.env);
      const announcement = await storage.getActiveAnnouncement();
      return c.json(announcement || null);
    } catch (err) {
      console.error("Failed to get announcement:", err);
      return c.json({ message: "Failed to get announcement" }, 500);
    }
  });

  app.get("/api/announcement/check/:walletAddress", async (c) => {
    try {
      const walletAddress = c.req.param("walletAddress");
      const storage = getStorage(c.env);
      const announcement = await storage.getActiveAnnouncement();

      if (!announcement) {
        return c.json({ needsToWatch: false, announcement: null });
      }

      const hasWatched = await storage.hasUserWatchedAnnouncement(walletAddress, announcement.id);
      return c.json({
        needsToWatch: !hasWatched,
        announcement: hasWatched ? null : announcement,
      });
    } catch (err) {
      console.error("Failed to check announcement:", err);
      return c.json({ message: "Failed to check announcement" }, 500);
    }
  });

  app.post("/api/announcement", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress } = body;
      const ADMIN_WALLET = c.env.ADMIN_WALLET_ADDRESS || "";

      if (ADMIN_WALLET && walletAddress !== ADMIN_WALLET) {
        return c.json({ message: "Only admin can upload announcements" }, 403);
      }

      const storage = getStorage(c.env);
      await storage.deactivateAllAnnouncements();

      const videoData = insertAnnouncementVideoSchema.parse({
        title: body.title,
        objectPath: body.objectPath,
        isActive: true,
      });

      const announcement = await storage.createAnnouncement(videoData);
      return c.json(announcement, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        }, 400);
      }
      console.error("Failed to create announcement:", err);
      return c.json({ message: "Failed to create announcement" }, 500);
    }
  });

  app.post("/api/announcement/watched", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress, announcementId } = body;

      if (!walletAddress || !announcementId) {
        return c.json({ message: "Missing walletAddress or announcementId" }, 400);
      }

      const storage = getStorage(c.env);
      const user = await storage.markAnnouncementWatched(walletAddress, announcementId);
      return c.json({ success: true, user });
    } catch (err) {
      console.error("Failed to mark announcement as watched:", err);
      return c.json({ message: "Failed to mark as watched" }, 500);
    }
  });

  app.get("/api/announcement/admin-check/:walletAddress", async (c) => {
    const walletAddress = c.req.param("walletAddress");
    const ADMIN_WALLET = c.env.ADMIN_WALLET_ADDRESS || "";
    const isAdmin = ADMIN_WALLET ? walletAddress === ADMIN_WALLET : true;
    return c.json({ isAdmin });
  });

  // Seed Bank API endpoints
  app.get("/api/seed-bank", async (c) => {
    try {
      const storage = getStorage(c.env);
      const seeds = await storage.getAllSeeds();
      return c.json(seeds);
    } catch (err) {
      console.error("Failed to get seeds:", err);
      return c.json({ message: "Failed to get seeds" }, 500);
    }
  });

  app.get("/api/seed-bank/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"));
      if (isNaN(id)) {
        return c.json({ message: "Invalid seed ID" }, 400);
      }
      const storage = getStorage(c.env);
      const seed = await storage.getSeedById(id);
      if (!seed) {
        return c.json({ message: "Seed not found" }, 404);
      }
      return c.json(seed);
    } catch (err) {
      console.error("Failed to get seed:", err);
      return c.json({ message: "Failed to get seed" }, 500);
    }
  });

  app.post("/api/seed-bank", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress } = body;
      const ADMIN_WALLET = c.env.ADMIN_WALLET_ADDRESS || "";

      if (ADMIN_WALLET && walletAddress !== ADMIN_WALLET) {
        return c.json({ message: "Only admin can create seeds" }, 403);
      }

      const seedData = insertSeedBankSchema.parse(body);
      const storage = getStorage(c.env);
      const seed = await storage.createSeed(seedData);
      return c.json(seed, 201);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        }, 400);
      }
      console.error("Failed to create seed:", err);
      return c.json({ message: "Failed to create seed" }, 500);
    }
  });

  app.delete("/api/seed-bank/:id", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress } = body;
      const ADMIN_WALLET = c.env.ADMIN_WALLET_ADDRESS || "";

      if (ADMIN_WALLET && walletAddress !== ADMIN_WALLET) {
        return c.json({ message: "Only admin can delete seeds" }, 403);
      }

      const id = parseInt(c.req.param("id"));
      if (isNaN(id)) {
        return c.json({ message: "Invalid seed ID" }, 400);
      }
      const storage = getStorage(c.env);
      await storage.deleteSeed(id);
      return c.body(null, 204);
    } catch (err) {
      console.error("Failed to delete seed:", err);
      return c.json({ message: "Failed to delete seed" }, 500);
    }
  });

  app.post("/api/seed-bank/:id/purchase", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress } = body;
      if (!walletAddress) {
        return c.json({ message: "Wallet address required" }, 400);
      }

      const id = parseInt(c.req.param("id"));
      if (isNaN(id)) {
        return c.json({ message: "Invalid seed ID" }, 400);
      }

      const storage = getStorage(c.env);
      const seed = await storage.getSeedById(id);
      if (!seed) {
        return c.json({ message: "Seed not found" }, 404);
      }

      // Check supply limit
      if (seed.totalSupply !== null && seed.mintedCount >= seed.totalSupply) {
        return c.json({ message: "Seed sold out" }, 400);
      }

      // Check per-user limit
      if (seed.maxPerUser !== null) {
        const userCurrentCount = await storage.getUserSeedCount(walletAddress, id);
        if (userCurrentCount >= seed.maxPerUser) {
          return c.json({
            message: `You can only own ${seed.maxPerUser} of this seed`,
          }, 400);
        }
      }

      const userSeed = await storage.purchaseSeed(walletAddress, id);
      return c.json(userSeed, 201);
    } catch (err) {
      console.error("Failed to purchase seed:", err);
      return c.json({ message: "Failed to purchase seed" }, 500);
    }
  });

  app.get("/api/user-seeds/:walletAddress", async (c) => {
    try {
      const walletAddress = c.req.param("walletAddress");
      const storage = getStorage(c.env);
      const seeds = await storage.getUserSeeds(walletAddress);
      return c.json(seeds);
    } catch (err) {
      console.error("Failed to get user seeds:", err);
      return c.json({ message: "Failed to get user seeds" }, 500);
    }
  });

  app.post("/api/user-seeds/:seedId/use", async (c) => {
    try {
      const body = await c.req.json();
      const { walletAddress } = body;
      if (!walletAddress) {
        return c.json({ message: "Wallet address required" }, 400);
      }

      const seedId = parseInt(c.req.param("seedId"));
      if (isNaN(seedId)) {
        return c.json({ message: "Invalid seed ID" }, 400);
      }

      const storage = getStorage(c.env);
      const success = await storage.useUserSeed(walletAddress, seedId);
      if (!success) {
        return c.json({ message: "No seeds available to use" }, 400);
      }
      return c.json({ success: true });
    } catch (err) {
      console.error("Failed to use seed:", err);
      return c.json({ message: "Failed to use seed" }, 500);
    }
  });

  // R2 Upload endpoint (POST with FormData) - used by useUpload hook
  app.post("/api/uploads/direct", async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return c.json({ error: "No file provided" }, 400);
      }

      const objectId = crypto.randomUUID();
      const objectKey = `uploads/${objectId}`;

      await c.env.R2_BUCKET.put(objectKey, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
        customMetadata: { originalName: file.name },
      });

      return c.json({
        objectPath: `/objects/${objectKey}`,
        objectKey,
        metadata: {
          name: file.name,
          size: file.size,
          contentType: file.type,
        },
      });
    } catch (err) {
      console.error("Error handling upload:", err);
      return c.json({ error: "Failed to upload file" }, 500);
    }
  });

  // Request upload URL (Uppy S3 plugin compatibility)
  // Step 1: Client gets a unique object key and PUT URL
  // Step 2: Client PUTs the raw file to that URL
  app.post("/api/uploads/request-url", async (c) => {
    try {
      const body = await c.req.json();
      const { name, contentType } = body;

      if (!name) {
        return c.json({ error: "Missing required field: name" }, 400);
      }

      const objectId = crypto.randomUUID();
      const objectKey = `uploads/${objectId}`;

      return c.json({
        uploadURL: `/api/uploads/put/${objectKey}`,
        objectPath: `/objects/${objectKey}`,
        metadata: { name, contentType },
      });
    } catch (err) {
      console.error("Error generating upload URL:", err);
      return c.json({ error: "Failed to generate upload URL" }, 500);
    }
  });

  // PUT upload endpoint - receives raw file body at a pre-assigned key
  app.put("/api/uploads/put/*", async (c) => {
    try {
      const key = c.req.path.replace("/api/uploads/put/", "");
      const body = c.req.raw.body;
      if (!body) {
        return c.json({ error: "No file provided" }, 400);
      }

      const contentType = c.req.header("Content-Type") || "application/octet-stream";

      await c.env.R2_BUCKET.put(key, body, {
        httpMetadata: { contentType },
      });

      return new Response(null, { status: 200 });
    } catch (err) {
      console.error("Error handling upload:", err);
      return c.json({ error: "Failed to upload file" }, 500);
    }
  });

  // Serve objects from R2
  app.get("/objects/*", async (c) => {
    try {
      const path = c.req.path.replace("/objects/", "");
      const object = await c.env.R2_BUCKET.get(path);

      if (!object) {
        return c.json({ error: "Not found" }, 404);
      }

      const headers = new Headers();
      headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("ETag", object.httpEtag);

      return new Response(object.body, { headers });
    } catch (err) {
      console.error("Error serving object:", err);
      return c.json({ error: "Failed to serve object" }, 500);
    }
  });

  return app;
}
