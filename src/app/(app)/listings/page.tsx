import Link from "next/link";
import { Plus, Eye, MessageSquare, Camera } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  Button,
  ProtoNote,
} from "@/components/ui";
import {
  listings,
  listingAddress,
  statusLabel,
  type ListingStatus,
} from "@/lib/sample-data";
import { relative } from "@/lib/utils";

const columns: { status: ListingStatus; tone: "queue" | "stock" | "brand" | "sent" | "neutral" }[] =
  [
    { status: "draft", tone: "queue" },
    { status: "live", tone: "stock" },
    { status: "under_offer", tone: "brand" },
    { status: "sold", tone: "sent" },
    { status: "withdrawn", tone: "neutral" },
  ];

export default function ListingsPage() {
  return (
    <>
      <PageHeader
        title="Listings"
        subtitle="A campaign over a property. A property can have many across its life; at most one is live."
        actions={
          <Button variant="primary">
            <Plus size={13} />
            New listing
          </Button>
        }
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
        {columns.map((col) => {
          const items = listings.filter((l) => l.status === col.status);
          return (
            <div key={col.status}>
              <div className="flex items-center gap-2 mb-2">
                <Badge tone={col.tone}>{statusLabel[col.status]}</Badge>
                <span className="text-3 text-[12px] tabular">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <Card key={l.id} className="p-3">
                    <Link
                      href={`/listings/${l.id}`}
                      className="text-[13px] font-medium hover:underline underline-offset-2 block"
                    >
                      {listingAddress(l)}
                    </Link>
                    <div className="text-3 text-[12px] mt-0.5">
                      {l.priceDisplay || (
                        <span className="text-[#b02f2f] dark:text-[#f08a8a]">
                          Price not set
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-3 text-[11.5px]">
                      {l.status === "live" && (
                        <>
                          <span className="inline-flex items-center gap-1 tabular">
                            <Eye size={11} />
                            {l.views7d}
                          </span>
                          <span className="inline-flex items-center gap-1 tabular">
                            <MessageSquare size={11} />
                            {l.enquiries7d}
                          </span>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1 tabular">
                        <Camera size={11} />
                        {l.photos}
                      </span>
                      <span className="ml-auto">{relative(l.listedAt)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge tone={l.type === "rent" ? "neutral" : "brand"}>
                        {l.type === "rent" ? "Rental" : "Sale"}
                      </Badge>
                      {l.resultDisplay && <Badge tone="sent">{l.resultDisplay}</Badge>}
                    </div>
                  </Card>
                ))}
                {items.length === 0 && (
                  <div className="border border-dashed rounded-lg p-4 text-center text-3 text-[12px]">
                    None
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Section className="mt-8">
        <ProtoNote>
          Sold and leased listings are never deleted. They are the sold archive, the
          content of the suburb pages, and the search equity the public site earns over
          time.
        </ProtoNote>
      </Section>
    </>
  );
}
