// @ts-check
export {};

/** @import { ERef } from '@endo/far'; */

/**
 * @typedef {string | string[]} Petname A petname can either be a plain string
 * or a path for which the first element is a petname for the origin, and the
 * rest of the elements are a snapshot of the names that were first given by that
 * origin.  We are migrating away from using plain strings, for consistency.
 */

/**
 * @typedef ProposalResult
 * @property {string} sourceSpec
 * @property {[exportedGetManifest: string, ...manifestArgs: any[]]} getManifestCall
 */

/**
 * @callback PublishBundleRef
 * @param {ERef<VatSourceRef>} bundle
 * @returns {Promise<VatSourceRef>}
 */

/**
 * @callback InstallBundle
 * @param {string} srcSpec
 * @param {string} bundlePath
 * @param {any} [opts]
 * @returns {ERef<VatSourceRef>}
 */

/**
 * @callback ProposalBuilder
 * @param {{
 *   publishRef: PublishBundleRef,
 *   install: InstallBundle,
 *   wrapInstall?: <T>(f: T) => T }
 * } powers
 * @param {...any} args
 * @returns {Promise<ProposalResult>}
 */

/**
 * @typedef {{
 *  bundleSource: typeof import('@endo/bundle-source').default,
 *  now: () => number,
 *  lookup: (...path: string[]) => unknown,
 *  publishBundle: PublishBundleRef,
 *  pathResolve: (...path: string[]) => string,
 *  cacheDir: string,
 * }} DeployScriptEndownments
 */

/**
 * @typedef {{
 * agoricNames: ERef<NameHub>,
 * bank: ERef<import("@agoric/vats/src/vat-bank.js").Bank>,
 * board: ERef<import("@agoric/vats").Board>,
 * faucet: unknown,
 * myAddressNameAdmin: ERef<import("@agoric/vats").NameAdmin>,
 * namesByAddress: ERef<NameHub>,
 * scratch: ERef<import('@agoric/internal/src/scratch.js').ScratchPad>,
 * zoe: ERef<ZoeService>,
 * }} CanonicalHome
 */

// TODO wallet as import('@agoric/wallet-backend/src/types').WalletAdmin once it's a module
/**
 * @typedef {CanonicalHome & {
 * wallet?: any,
 * }} AgSoloHome
 */

/**
 * @callback DeployScriptFunction
 * @param {Promise<CanonicalHome>} homeP
 * @param {DeployScriptEndownments} endowments
 * @returns {Promise<void>}
 */
