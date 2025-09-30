/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3395098727")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\" && user.id = @request.auth.id ",
    "listRule": "@request.auth.id != \"\" && user.id = @request.auth.id ",
    "updateRule": "@request.auth.id != \"\" && user.id = @request.auth.id ",
    "viewRule": "@request.auth.id != \"\" && user.id = @request.auth.id "
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3395098727")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\" && @request.auth.id = @request.auth.id ",
    "listRule": "@request.auth.id != \"\" && @request.auth.id = @request.auth.id ",
    "updateRule": "@request.auth.id != \"\" && @request.auth.id = @request.auth.id ",
    "viewRule": "@request.auth.id != \"\" && @request.auth.id = @request.auth.id "
  }, collection)

  return app.save(collection)
})
