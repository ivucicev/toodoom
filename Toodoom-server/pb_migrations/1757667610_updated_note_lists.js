/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2475035874")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\" && owner.id = @request.auth.id",
    "listRule": "@request.auth.id != \"\" && owner.id = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" && owner.id = @request.auth.id",
    "viewRule": "@request.auth.id != \"\" && owner.id = @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2475035874")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "listRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" && owner = @request.auth.id",
    "viewRule": "@request.auth.id != \"\" && owner = @request.auth.id"
  }, collection)

  return app.save(collection)
})
