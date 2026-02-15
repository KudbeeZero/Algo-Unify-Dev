interface Env {
  R2_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const path = context.params.path;
    const objectKey = Array.isArray(path) ? path.join("/") : path;

    const object = await context.env.R2_BUCKET.get(objectKey);

    if (!object) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": object.httpEtag,
      },
    });
  } catch (err) {
    console.error("Error serving object:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
