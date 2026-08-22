function handler(event) {
  var request = event.request;

  // Basic auth was removed at the owner's request so the console loads directly.
  // The directory-index rewrite below is NOT optional: the export uses trailingSlash,
  // so pages live at /dashboard/index.html, and CloudFront only resolves a default
  // root object at "/" - never for sub-paths. Without this every route 404s.
  var uri = request.uri;
  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
  } else if (uri.indexOf(".") === -1) {
    request.uri = uri + "/index.html";
  }
  return request;
}
