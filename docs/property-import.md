# Property import

**Properties → Import** accepts a `.json`, `.md` or `.pdf` file of up to 5 MB.

1. The file is read. JSON is validated as written; Markdown and PDF are read by Claude
   (`prompts/extract-properties.v1.md`, Haiku tier, logged on the Costs page).
2. A preview shows every property found, the suburb it lands in, whether the owner and
   tenants already exist as contacts, and why any row would be skipped. **Nothing is
   saved at this point.**
3. Untick anything wrong and press **Import**. Only the ticked rows are written, and each
   is re-checked on the server first.

## What an import creates

| From the file | Becomes |
|---|---|
| The property | A `properties` row, status **off market**, with "Imported from <file> (source id N)" in its private notes |
| The owner | A contact with the **landlord** role, linked as the property's owner |
| Each tenant | A contact with the **tenant** role, address filled in if it was blank |
| A suburb not yet in the list | A new suburb row, but only when the file gives its postcode and state |

People are matched to existing contacts by **phone or email only**, through the same
identity resolver as every enquiry. A person matching more than one record is added as a
new contact with a merge review raised. Nothing merges automatically, and a name alone
never matches.

**Ignored on purpose:** rent, arrears, lease dates, held funds, trust accounts, fees,
statements, inspections and maintenance. Rentals are advertised here, not managed (D10),
and trust accounting is out of scope (§14).

**Skipped rows:** an address already in your properties, the same address twice in one
file, a suburb that is not in the list with no postcode and state to add it, or land
with bedrooms.

## JSON format

Either `{ "properties": [ ... ] }` or a bare array. Unknown keys are ignored, so an export
with extra columns imports without editing.

```json
{
  "properties": [
    {
      "unit": "1",
      "streetNumber": "17",
      "street": "Devon Drive",
      "suburb": "Salisbury",
      "postcode": "5108",
      "state": "SA",
      "propertyType": "unit",
      "beds": 2,
      "baths": 1,
      "parking": 1,
      "landAreaSqm": null,
      "sourceRef": "3",
      "owner": { "name": "Hassan Varasi", "phone": "0438 371 208", "email": null },
      "tenants": [
        { "name": "Najibullah Karimi", "phone": "0418 117 748", "email": null }
      ]
    }
  ]
}
```

- **Required:** `street`, `suburb`, `propertyType`.
- **`propertyType`:** `house`, `unit`, `townhouse`, `land`, `acreage` or `commercial`.
  `apartment`, `flat` and `villa` are read as `unit`.
- A trailing bracketed label on a name, such as "Hassan Varasi (1/17 DEVON)", is dropped.
