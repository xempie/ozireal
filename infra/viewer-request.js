function handler(event) {
  var request = event.request;
  var headers = request.headers;

  // Gate the demo. It is an unfinished product carrying the agency's name, so it
  // should not be reachable by anyone who stumbles across the URL, or indexed.
  var expected = "Basic b3ppOnBvd2VsbC1zdHJlZXQtNDgyMQ==";
  if (!headers.authorization || headers.authorization.value !== expected) {
    return {
      statusCode: 401,
      statusDescription: "Unauthorized",
      headers: {
        "www-authenticate": { value: 'Basic realm="Ozi Realty console"' },
        "cache-control": { value: "no-store" }
      }
    };
  }

  // The export uses trailingSlash, so pages live at /dashboard/index.html.
  // CloudFront only resolves a default root object at "/", not for sub-paths.
  var uri = request.uri;
  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
  } else if (uri.indexOf(".") === -1) {
    request.uri = uri + "/index.html";
  }
  return request;
}
