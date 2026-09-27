# Reference data

## sa-suburbs.csv

South Australia's suburbs and localities: 1,893 rows of `postcode, suburb` plus the
government's locality number, gazettal date and boundary length/area. Supplied by the
agency on 2026-09-27. It matches the SA Government "Suburbs and localities" dataset
published on data.sa.gov.au (Creative Commons Attribution); keep the attribution if the
list is shown publicly.

Loaded by `drizzle/0016_sa_suburbs.sql`, which the deploy applies. Names are converted
from capitals to normal case (McLaren Vale, O'Halloran Hill), and rows already in
`suburbs` are left alone.

**No coordinates.** `shape_Leng` / `shape_Area` describe the boundary polygon, not a
point, so `suburbs.latitude` / `longitude` stay empty. A file with a centroid per
locality can fill them later with an `UPDATE … FROM (VALUES …)` keyed on name + postcode.
