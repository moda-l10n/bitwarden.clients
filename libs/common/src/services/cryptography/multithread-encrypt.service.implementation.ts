import { defaultIfEmpty, filter, firstValueFrom, fromEvent, map, Subject, takeUntil } from "rxjs";
import { Jsonify } from "type-fest";

import { Decryptable, DecryptableDomain } from "../../interfaces/crypto.interface";
import { InitializerMetadata } from "../../interfaces/initializer-metadata.interface";
import { Utils } from "../../misc/utils";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";
import { getClassInitializer } from "./get-class-initializer";

// TTL (time to live) is not strictly required but avoids tying up memory resources if inactive
const workerTTL = 3 * 60000; // 3 minutes

export class MultithreadEncryptServiceImplementation extends EncryptServiceImplementation {
  private worker: Worker;
  private timeout: any;

  private clear$ = new Subject<void>();

  /**
   * Sends items to a web worker to decrypt them.
   * This utilises multithreading to decrypt items faster without interrupting other operations (e.g. updating UI).
   */
  async decryptDomains<V, D extends DecryptableDomain & InitializerMetadata>(
    view: Decryptable<V, D> & InitializerMetadata,
    items: D[],
    key: SymmetricCryptoKey
  ): Promise<V[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    this.logService.info("Starting decryption using multithreading");

    this.worker ??= new Worker(
      new URL(
        /* webpackChunkName: 'encrypt-worker' */
        "@bitwarden/common/services/cryptography/encrypt.worker.ts",
        import.meta.url
      )
    );

    this.restartTimeout();

    const request = {
      id: Utils.newGuid(),
      view: view.initializerKey,
      items: items,
      key: key,
    };

    this.worker.postMessage(JSON.stringify(request));

    return await firstValueFrom(
      fromEvent(this.worker, "message").pipe(
        filter((response: MessageEvent) => response.data?.id === request.id),
        map((response) => JSON.parse(response.data.items)),
        map((items) =>
          items.map((jsonItem: Jsonify<D>) => {
            const initializer = getClassInitializer<D>(jsonItem.initializerKey);
            return initializer(jsonItem);
          })
        ),
        takeUntil(this.clear$),
        defaultIfEmpty([])
      )
    );
  }

  private clear() {
    this.clear$.next();
    this.worker?.terminate();
    this.worker = null;
    this.clearTimeout();
  }

  private restartTimeout() {
    this.clearTimeout();
    this.timeout = setTimeout(() => this.clear(), workerTTL);
  }

  private clearTimeout() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
  }
}
