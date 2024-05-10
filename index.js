const http = require("http");

const version = "0.0.3";

let allowedDomains = process?.env?.ALLOWED_REMOTE_DOMAINS?.split(",") || ["*"];
let imgproxyUrl = process?.env?.IMGPROXY_URL || "http://imgproxy:8080";
if (process.env.NODE_ENV === "development") {
  imgproxyUrl = "http://localhost:8888";
}
allowedDomains = allowedDomains.map((d) => d.trim());
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h3>Next Image Transformation v${version}</h3>.`);
  } else if (url.pathname === "/health") {
    res.writeHead(200);
    res.end("OK");
  } else if (url.pathname.startsWith("/image/")) {
    const response = await resize(url);
    res.writeHead(response.status, response.headers);
    response.body.pipe(res);
  } else {
    res.writeHead(302, {
      Location: "https://ozantunca.org",
    });
    res.end();
  }
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});

async function resize(url) {
  const preset = "pr:sharp";
  const src = url.pathname.split("/").slice(2).join("/");
  const origin = new URL(src).hostname;
  const allowed = allowedDomains.filter((domain) => {
    if (domain === "*") return true;
    if (domain === origin) return true;
    if (domain.startsWith("*.") && origin.endsWith(domain.split("*.").pop()))
      return true;
    return false;
  });
  if (allowed.length === 0) {
    return new Response(
      `Domain (${origin}) not allowed. More details here: https://github.com/ozantunca/next-image-transformation`,
      { status: 403 }
    );
  }
  const width = url.searchParams.get("width") || 0;
  const height = url.searchParams.get("height") || 0;
  const quality = url.searchParams.get("quality") || 75;
  try {
    const url = `${imgproxyUrl}/${preset}/resize:fill:${width}:${height}/q:${quality}/plain/${src}`;
    const image = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,*/*",
      },
    });
    const headers = new Headers(image.headers);
    headers.set("Server", "NextImageTransformation");
    return new Response(image.body, {
      headers,
    });
  } catch (e) {
    console.log(e);
    return new Response("Error resizing image");
  }
}
