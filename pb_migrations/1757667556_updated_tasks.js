/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\" && (list.owner.id = @request.auth.id || @request.auth.id = user)",
    "listRule": "@request.auth.id != \"\" && (list.participants.id ~ @request.auth.id || list.owner.id = @request.auth.id)",
    "updateRule": "@request.auth.id != \"\" && @request.auth.id = user.id",
    "viewRule": "@request.auth.id != \"\" && (list.participants.id ~ @request.auth.id || list.owner.id = @request.auth.id)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\" && (list.owner = @request.auth.id || @request.auth.id = user)",
    "listRule": "@request.auth.id != \"\" && (list.participants.id ~ @request.auth.id || list.owner = @request.auth.id)",
    "updateRule": "@request.auth.id != \"\" && @request.auth.id = user",
    "viewRule": "@request.auth.id != \"\" && (list.participants ~ @request.auth.id || list.owner = @request.auth.id)"
  }, collection)

  return app.save(collection)
})
