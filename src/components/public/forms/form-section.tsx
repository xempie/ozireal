import { EnquiryForm } from "./enquiry-form";
import { formForSlug } from "./definitions";
import { publicFormKey } from "@/server/public/forms";
import { AGENCY } from "../agency";

/**
 * The server half of an enquiry form.
 *
 * It exists so a page does not have to know how a form addresses the CRM. It resolves the
 * tenant's form key through the public projection layer and hands it to the client island
 * along with the definition, which keeps `src/app/(public)` free of any database import
 * and keeps `tests/public-boundary.test.ts` passing.
 *
 * Renders nothing when a slug has no form, so adding a page without one is not an error.
 */
export async function FormSection({ slug }: { slug: string }) {
  const definition = formForSlug(slug);
  if (!definition) return null;
  const formKey = await publicFormKey();

  return (
    <section className="sec enq-sec" id="enquire">
      <div className="wrap">
        <EnquiryForm
          definition={definition}
          formKey={formKey}
          phone={AGENCY.phone}
          phoneHref={AGENCY.phoneHref}
        />
      </div>
    </section>
  );
}
