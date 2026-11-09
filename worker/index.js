
const IMAGE_ORIGIN = "https://maneulbbang.org/";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}

function cleanFolder(value) {
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);

  if (
    parts.length > 2 ||
    parts.some(p =>
      p === "." ||
      p === ".." ||
      !/^[A-Za-z0-9_-]+$/.test(p)
    )
  ) {
    throw new Error("Invalid folder");
  }

  return parts.join("/");
}

function isImage(key) {
  return /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(key);
}

function publicUrl(key) {
  return IMAGE_ORIGIN +
    key.split("/").map(encodeURIComponent).join("/");
}

async function listAll(bucket, options) {
  const objects = [];
  const prefixes = new Set();
  let cursor;

  do {
    const result = await bucket.list({
      ...options,
      cursor
    });

    objects.push(...(result.objects || []));

    for (const prefix of (result.delimitedPrefixes || [])) {
      prefixes.add(prefix);
    }

    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);

  return {
    objects,
    prefixes: [...prefixes]
  };
}

async function handleApi(request, env, url) {
  if (!env.BUCKET) {
    return json({
      error: "R2 bucket binding BUCKET is missing."
    }, 500);
  }

  if (url.pathname === "/api/folders") {
    let parent;

    try {
      parent = cleanFolder(
        url.searchParams.get("parent") || ""
      );
    } catch {
      return json({ error: "Invalid folder path." }, 400);
    }

    const prefix = parent ? parent + "/" : "";

    const result = await listAll(env.BUCKET, {
      prefix,
      delimiter: "/"
    });

    const folders = result.prefixes
      .map(p => p.slice(prefix.length).replace(/\/$/, ""))
      .filter(Boolean)
      .sort((a, b) =>
        a.localeCompare(
          b,
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );

    return json({ parent, folders });
  }

  if (url.pathname === "/api/images") {
    let folder;

    try {
      folder = cleanFolder(
        url.searchParams.get("folder") || ""
      );
    } catch {
      return json({ error: "Invalid folder path." }, 400);
    }

    if (folder.split("/").filter(Boolean).length !== 2) {
      return json({
        error: "Choose a first-level and second-level folder."
      }, 400);
    }

    const prefix = folder + "/";
    const result = await listAll(env.BUCKET, { prefix });

    const images = result.objects
      .filter(obj =>
        obj.key.startsWith(prefix) &&
        !obj.key.slice(prefix.length).includes("/") &&
        isImage(obj.key)
      )
      .map(obj => ({
        name: obj.key.slice(prefix.length),
        key: obj.key,
        url: publicUrl(obj.key),
        size: obj.size,
        uploaded: obj.uploaded
          ? obj.uploaded.toISOString()
          : null
      }))
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );

    return json({
      folder,
      count: images.length,
      images
    });
  }

  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        return json({
          error: "Unable to read the R2 bucket.",
          detail: error.message
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
