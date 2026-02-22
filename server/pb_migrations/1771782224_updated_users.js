/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "mfa": {
      "enabled": false
    },
    "oauth2": {
      "enabled": false
    },
    "otp": {
      "enabled": false
    },
    "passwordAuth": {
      "enabled": false
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "mfa": {
      "enabled": true
    },
    "oauth2": {
      "enabled": true
    },
    "otp": {
      "enabled": true
    },
    "passwordAuth": {
      "enabled": true
    }
  }, collection)

  return app.save(collection)
})
