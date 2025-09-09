/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3395098727")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  // remove field
  collection.fields.removeById("relation1154021400")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3395098727")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && list.owner = @request.auth.id",
    "viewRule": "@request.auth.id != \"\" && list.owner = @request.auth.id"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3277857102",
    "hidden": false,
    "id": "relation1154021400",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "list",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
