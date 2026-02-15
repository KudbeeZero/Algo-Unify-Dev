import { handle } from "hono/cloudflare-pages";
import { createApp } from "../../server/api";

const app = createApp();

export const onRequest = handle(app);
