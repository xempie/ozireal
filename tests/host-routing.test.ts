import { describe, expect, it } from "vitest";
import { routeForHost } from "@/lib/host-routing";

const base = { publicHost: "www.ozirealty.com.au", crmHost: "crm.ozirealty.com.au", search: "", preview: false };
const go = (host: string, pathname: string, extra: Partial<typeof base> = {}) =>
  routeForHost({ ...base, ...extra, host, pathname });

describe("host routing", () => {
  it("sends the apex to www, keeping the path", () => {
    expect(go("ozirealty.com.au", "/contact", { search: "?a=1" })).toEqual({
      location: "https://www.ozirealty.com.au/contact?a=1",
      status: 301,
    });
  });

  it("serves public pages on www", () => {
    for (const p of ["/", "/for-sale", "/post/x", "/media/t/a/l/b/c.webp", "/api/forms/k", "/sitemap.xml"]) {
      expect(go("www.ozirealty.com.au", p)).toBeNull();
    }
  });

  it("sends console paths from www to crm", () => {
    expect(go("www.ozirealty.com.au", "/login")).toEqual({ location: "https://crm.ozirealty.com.au/login", status: 307 });
    expect(go("www.ozirealty.com.au", "/dashboard")?.location).toBe("https://crm.ozirealty.com.au/dashboard");
    expect(go("www.ozirealty.com.au", "/api/media/listings/x")?.location).toBe("https://crm.ozirealty.com.au/api/media/listings/x");
  });

  it("sends the old Wix property pages on www to for-sale", () => {
    expect(go("www.ozirealty.com.au", "/properties/12-powell-street")).toEqual({
      location: "https://www.ozirealty.com.au/for-sale",
      status: 301,
    });
  });

  it("serves the console on crm and opens it at the dashboard", () => {
    expect(go("crm.ozirealty.com.au", "/")).toEqual({ location: "https://crm.ozirealty.com.au/dashboard", status: 307 });
    for (const p of ["/login", "/dashboard", "/properties/abc", "/website", "/api/website/preview", "/media/x", "/brand/logo.png"]) {
      expect(go("crm.ozirealty.com.au", p)).toBeNull();
    }
  });

  it("sends public pages on crm to www, temporarily, except in preview", () => {
    expect(go("crm.ozirealty.com.au", "/for-sale")).toEqual({ location: "https://www.ozirealty.com.au/for-sale", status: 307 });
    expect(go("crm.ozirealty.com.au", "/for-sale", { preview: true })).toBeNull();
  });

  it("leaves unknown hosts alone", () => {
    expect(go("127.0.0.1", "/dashboard")).toBeNull();
    expect(go("localhost", "/")).toBeNull();
  });
});
