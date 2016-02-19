var { classes: Cc, interfaces: Ci, utils: Cu } = Components;

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorageLocal",
                                  "resource://gre/modules/ExtensionStorageLocal.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionStorageSync",
                                  "resource://gre/modules/ExtensionStorageSync.jsm");

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

      sync: {
        get: function(keys, callback) {
          ExtensionStorageSync.get(extension.id, keys).then(result => {
            runSafe(context, callback, result);
          });
        },
        set: function(items, callback) {
          ExtensionStorageSync.set(extension.id, items).then(() => {
            if (callback) {
              runSafe(context, callback);
            }
          });
        },
        remove: function(items, callback) {
          ExtensionStorageSync.remove(extension.id, items).then(() => {
            if (callback) {
              runSafe(context, callback);
            }
          });
        },
      },

      onChanged: new EventManager(context, "storage.onChanged", fire => {
        ExtensionStorageLocal.setEventManager(extension.id, fire);
        ExtensionStorageSync.setEventManager(extension.id, fire);
        return () => {
          ExtensionStorageLocal.removeEventManager(extension.id);
          ExtensionStorageSync.removeEventManager(extension.id);
        };
      }).api(),
    },
  };
});
