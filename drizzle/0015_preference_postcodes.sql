--------------------------------------------------------------------------------
-- Postcodes as a way to say where a buyer is looking.
--
-- Area preferences were suburbs only, resolved against the suburbs table so the
-- stage-1 filter could compare foreign keys. That table holds only the suburbs the
-- agency has loaded, so "Salisbury" or "5108" for most of SA had nowhere to go and
-- the buyer could not be matched there at all.
--
-- A postcode needs no reference data: properties.postcode is on every property, so
-- matching compares it directly. A property is in a contact's area when its suburb
-- is one of theirs OR its postcode is one of theirs; with neither set, any area.
--
-- text[] of four-digit strings (validated in setContactPreferences), never an int:
-- leading zeros matter in NT postcodes (0800), and a postcode is a label.
--------------------------------------------------------------------------------

ALTER TABLE "contact_preferences"
  ADD COLUMN IF NOT EXISTS "postcodes" text[];
