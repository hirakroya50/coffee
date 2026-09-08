# TASK 17 — Hide active flag on menu list

Remove the `active` field from `GET /menu-items` JSON responses. The endpoint must still return only active menu items (same filtering as today). Do not change `GET /menu-items/{id}` — it may still include `active` for single-item lookups.

Update OpenAPI so `MenuItemList` items no longer include `active`. Keep OpenAPI, code, and tests synchronized. Prior tasks must still pass.
