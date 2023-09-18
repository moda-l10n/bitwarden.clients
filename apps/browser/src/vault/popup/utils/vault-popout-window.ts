import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/popup/browser-popup-utils";

const VaultPopoutType = {
  vaultItemPasswordReprompt: "vault_PasswordReprompt",
  addEditVaultItem: "vault_AddEditVaultItem",
} as const;

/**
 * Opens a popout window for the current page.
 * If the current page is set for the current tab, then the
 * popout window will be set for the vault items listing tab.
 * @param {Window} win
 * @param {string} href
 * @returns {Promise<void>}
 */
async function openCurrentPagePopout(win: Window, href: string = null) {
  const popoutUrl = href || win.location.href;
  const parsedUrl = new URL(popoutUrl);
  let hashRoute = parsedUrl.hash;
  if (hashRoute.startsWith("#/tabs/current")) {
    hashRoute = "#/tabs/vault";
  }

  await BrowserPopupUtils.openPopout(`${parsedUrl.pathname}${hashRoute}`);

  if (BrowserPopupUtils.inPopup(win)) {
    BrowserApi.closePopup(win);
  }
}

/**
 * Opens a popout window that facilitates re-prompting for
 * the password of a vault item.
 * @param {chrome.tabs.Tab} senderTab
 * @param {{cipherId: string, action: string}} cipherOptions
 * @returns {Promise<void>}
 */
async function openVaultItemPasswordRepromptPopout(
  senderTab: chrome.tabs.Tab,
  cipherOptions: {
    cipherId: string;
    action: string;
  }
) {
  const { cipherId, action } = cipherOptions;
  const promptWindowPath =
    "popup/index.html#/view-cipher" +
    `?cipherId=${cipherId}` +
    `&senderTabId=${senderTab.id}` +
    `&action=${action}`;

  await BrowserPopupUtils.openPopout(promptWindowPath, {
    singleActionKey: `${VaultPopoutType.vaultItemPasswordReprompt}_${cipherId}`,
    senderWindowId: senderTab.windowId,
    forceCloseExistingWindows: true,
  });
}

/**
 * Opens a popout window that facilitates adding or editing a vault item.
 * @param {number} senderWindowId
 * @param {string} cipherId
 * @returns {Promise<void>}
 */
async function openAddEditVaultItemPopout(senderWindowId: number, cipherId?: string) {
  const addEditCipherUrl =
    cipherId == null
      ? "popup/index.html#/edit-cipher"
      : `popup/index.html#/edit-cipher?cipherId=${cipherId}`;

  await BrowserPopupUtils.openPopout(addEditCipherUrl, {
    singleActionKey: VaultPopoutType.addEditVaultItem,
    senderWindowId,
  });
}

/**
 * Closes the add/edit vault item popout window.
 * @param {number} delayClose
 * @returns {Promise<void>}
 */
async function closeAddEditVaultItemPopout(delayClose = 0) {
  await BrowserPopupUtils.closeSingleActionPopout(VaultPopoutType.addEditVaultItem, delayClose);
}

export {
  VaultPopoutType,
  openCurrentPagePopout,
  openVaultItemPasswordRepromptPopout,
  openAddEditVaultItemPopout,
  closeAddEditVaultItemPopout,
};
