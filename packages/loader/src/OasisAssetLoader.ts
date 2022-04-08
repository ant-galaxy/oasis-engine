import {
  resourceLoader,
  Loader,
  AssetPromise,
  AssetType,
  LoadItem,
  Texture2D,
  ResourceManager
} from "@oasis-engine/core";
import { decode } from "@oasis-engine/resource-process";

@resourceLoader(AssetType.Oasis, ["oasis"], false)
class EditorFileLoader<T> extends Loader<T> {
  load(item: LoadItem, resourceManager: ResourceManager): AssetPromise<T> {
    return new AssetPromise((resolve, reject) => {
      resourceManager.baseUrl = item.url;

      this.request<ArrayBuffer>(item.url, {
        ...item,
        type: "arraybuffer"
      })
        .then((ab) => decode<T>(ab, resourceManager.engine))
        .then((object) => {
          resolve(object);
          resourceManager.baseUrl = "";
        })
        .catch((err) => {
          console.error(`load ${item.url} error`);
          reject(err);
        });
    });
  }
}
