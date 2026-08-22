DROP INDEX "contacts_tenant_email_uq";--> statement-breakpoint
DROP INDEX "contacts_tenant_phone_uq";--> statement-breakpoint
CREATE INDEX "contacts_tenant_email_idx" ON "contacts" USING btree ("tenant_id","email_normalised");--> statement-breakpoint
CREATE INDEX "contacts_tenant_phone_idx" ON "contacts" USING btree ("tenant_id","phone_e164");