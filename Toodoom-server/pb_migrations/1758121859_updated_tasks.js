/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id != \"\" && (user.id = @request.auth.id || list.participants.id ~ @request.auth.id || list.owner.id = @request.auth.id)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id != \"\" && user.id = @request.auth.id"
  }, collection)

  return app.save(collection)
})
