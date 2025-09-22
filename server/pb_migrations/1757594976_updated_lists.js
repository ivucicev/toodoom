/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3277857102")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && (participants ~ @request.auth.id || owner = @request.auth.id)",
    "updateRule": "@request.auth.id != \"\" && (participants ~ @request.auth.id || owner = @request.auth.id)",
    "viewRule": "@request.auth.id != \"\" && (participants ~ @request.auth.id || owner = @request.auth.id)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3277857102")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "viewRule": "@request.auth.id != \"\" && owner = @request.auth.id"
  }, collection)

  return app.save(collection)
})
