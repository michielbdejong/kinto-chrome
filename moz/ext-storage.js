var { classes: Cc, interfaces: Ci, utils: Cu } = Components;

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorageLocal",
                                  "resource://gre/modules/ExtensionStorageLocal.jsm");

Cu.import("resource://gre/modules/ExtensionUtils.jsm");
var {
  EventManager,
  ignoreEvent,
  runSafe,
} = ExtensionUtils;

extensions.registerPrivilegedAPI("storage", (extension, context) => {
  return {
    storage: {
      local: {
        get: function(keys, callback) {
          ExtensionStorageLocal.get(extension.id, keys).then(result => {
            runSafe(context, callback, result);
          });
        },
        set: function(items, callback) {
          ExtensionStorageLocal.set(extension.id, items).then(() => {
            if (callback) {
              runSafe(context, callback);
            }
          });
        },
        remove: function(items, callback) {
          ExtensionStorageLocal.remove(extension.id, items).then(() => {
            if (callback) {
              runSafe(context, callback);
            }
          });
        },
      },

      onChanged: new EventManager(context, "storage.onChanged", fire => {
        ExtensionStorage.setEventManager(extension.id, fire);
        return () => {
          ExtensionStorage.removeEventManager(extension.id, fire);
        };
      }).api(),
    },
  };
});
