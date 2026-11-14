/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "d6bd2c19a7676eded036d876c17bce13"
  }, {
    "url": "pwa-512x512.png",
    "revision": "2fd465e736e3b3a708af62df285a4f27"
  }, {
    "url": "pwa-192x192.png",
    "revision": "740edbc2ce849659e4d2a8962b68fc80"
  }, {
    "url": "index.html",
    "revision": "ef3bc0f462fdc7b8ff107e233537d6d5"
  }, {
    "url": "icon.svg",
    "revision": "586e9516acc0f4ec4cca820752e68a70"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fc818d31551201533b17035a2434a4e5"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-CjnuzNYt.js",
    "revision": null
  }, {
    "url": "assets/index-Db_As15m.css",
    "revision": null
  }, {
    "url": "assets/index-BEL98wzT.js",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_20261114_070411_4aa24aad.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fc818d31551201533b17035a2434a4e5"
  }, {
    "url": "icon.svg",
    "revision": "586e9516acc0f4ec4cca820752e68a70"
  }, {
    "url": "pwa-192x192.png",
    "revision": "740edbc2ce849659e4d2a8962b68fc80"
  }, {
    "url": "pwa-512x512.png",
    "revision": "2fd465e736e3b3a708af62df285a4f27"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "d6bd2c19a7676eded036d876c17bce13"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
