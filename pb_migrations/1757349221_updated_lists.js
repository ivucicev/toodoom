/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3277857102")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_Po0EGLN5c7` ON `lists` (\n  `name`,\n  `owner`\n)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number1364852787",
    "max": null,
    "min": null,
    "name": "grad_seed",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3277857102")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // remove field
  collection.fields.removeById("number1364852787")

  return app.save(collection)
})
