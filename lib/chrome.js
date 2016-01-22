"use strict";

import Kinto from "kinto";
import btoa from "btoa";

const SYNC_INTERVAL = 10000;

export class StorageChange {
  constructor(oldValue, newValue) {
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
}

export class StorageChangeEvent {
  constructor(areaName) {
    this.listeners = [];
    this.changes = [];
    this.areaName = areaName;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  _addChange(key, oldValue, newValue) {
    this.changes[key] = new StorageChange(oldValue, newValue);
  }

  _emit() {
    for (const listener of this.listeners) {
      listener(this.changes, this.areaName);
    }
    this.changes = [];
  }
}

class Events {
  constructor() {
    this.events = {local: new StorageChangeEvent("local"),
                   managed: new StorageChangeEvent("managed"),
                   sync: new StorageChangeEvent("sync")};
  }

  addListener(callback) {

    for (const _event in this.events) {
      this.events[_event].addListener(callback);
    }
  }

  _addChange(areaName, key, oldValue, newValue) {
    this.events[areaName]._addChange(key, oldValue, newValue);
  }

  _emit(areaName) {
    this.events[areaName]._emit();
  }

}


export class StorageArea {
  constructor(areaName, config) {
    if (!areaName) {areaName = "sync";}
    this.areaName = areaName;

    this.db = new Kinto();

    function schema() {
      let _next = 0;
      return {
        generate() {
          return _next++;
        },
        validate(id) {
          // validating everything for now
          return true;
        }
      };
    }

    this.items = this.db.collection("items", {idSchema: schema()});

    if (areaName === "sync") {
      this.config = config;
      this.syncTimer = setInterval(() => {
        this.items.sync(this.config).then(syncResults => {
          console.log("Sync Results", syncResults);
        }, err => {
          console.error("Sync Error", err.message);
        });
      }, SYNC_INTERVAL);
    }

    // XXX just for the tests
    this.items.clear();
  }

  get(keys, callback) {
    const this_items = this.items;
    const records = [];

    function getRecord(key) {
      return this_items.get(key).then(function (res) {
        const promise = new Promise(function(resolve, reject) {
          if (res) {
            records[res.data.id] = res.data.data;
            resolve(res.data);
          } else {
            reject("boom");
          }
        });
        return promise;
      },
      function (rejected) {
        // XXX we just swallow the error and not set any key
      }
      );
    }
    function getRecords(keys) {
      return Promise.all(keys.map(key => getRecord(key))).then(
        function() {
          if (callback) {callback(records);}
        }
      );
    }

    if (!keys) {
      keys = [];
      // XXX suboptimal: fetching all ids - then doing a second query
      return this_items.list().then(function(res) {
        res.data.map(r => keys.push(r.id));
      }).then(function() {return getRecords(keys);});
    } else {
      keys = [].concat(keys);
      return getRecords(keys);
    }
  }

  getBytesInUse(keys, callback) {
    return 0;
  }

  set(items, callback) {
    items = [].concat(items);
    const this_items = this.items;
    const areaName = this.areaName;

    function createOrUpdateItem(item) {
      const record = {"data": Object.values(item)[0]};
      const id = Object.keys(item)[0];
      record["id"] = id;

      function createItem() {
        storage.onChanged._addChange(areaName, id, null, record);
        return this_items.create(record, {useRecordId: true});
      }

      function updateItem(old_record) {
        storage.onChanged._addChange(areaName, id, old_record, record);
        return this_items.update(record);
      }

      return this_items.get(id).then(function(old_record) {return updateItem(old_record);},
                                     function(reason) {return createItem();});
    }

    return Promise.all(items.map(item => createOrUpdateItem(item).then(
              res => { }
            ))).then(
      function() {
        storage.onChanged._emit(areaName);
        if (callback) {callback();}
      }
    );
  }

  remove(keys, callback) {
    keys = [].concat(keys);
    const this_items = this.items;

    function removeItem(key) {
      return this_items.delete(key);
    }

    return Promise.all(keys.map(key => removeItem(key).then(
              res => { }
            ))).then(
      function() {if (callback) {callback();}}
    );
  }

  clear(callback) {
    this.items.clear().then(function() {if (callback) {callback();}});
  }
}


export const storage = {
  onChanged: new Events(),
  sync: new StorageArea("sync", {
    remote: "https://kinto.dev.mozaws.net/v1/",
    headers: {Authorization: "Basic " + btoa("user:pass")}
  }),
  local: new StorageArea("local"),
  managed: new StorageArea("managed")
};
