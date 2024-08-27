// @ts-check

/* eslint-disable import/order -- https://github.com/endojs/endo/issues/1235 */
import { test as anyTest } from '../prepare-test-env-ava.js';

import { createRequire } from 'module';
import { E } from '@endo/far';
import { makeNodeBundleCache } from '@endo/bundle-source/cache.js';
import { makeZoeKitForTest } from '@agoric/zoe/tools/setup-zoe.js';
import { AmountMath } from '@agoric/ertp';

import { makeStableFaucet } from '../mintStable.js';
import buildManualTimer from '@agoric/zoe/tools/manualTimer.js';
import { oneDay, TimeIntervals } from '../../src/airdrop/helpers/time.js';
import {
  startTribblesAirdrop,
  permit,
  makeTerms,
} from '../../src/airdrop.proposal.js';
import {
  produceBoardAuxManager,
  permit as boardAuxPermit,
} from '../../src/platform-goals/board-aux.core.js';
import { extract } from '@agoric/vats/src/core/utils.js';
import { mockBootstrapPowers } from '../../tools/boot-tools.js';
import { getBundleId } from '../../tools/bundle-tools.js';
import { head } from '../../src/airdrop/helpers/objectTools.js';
import { accounts } from '../data/agd-keys.js';
import { merkleTreeAPI } from '../../src/merkle-tree/index.js';
import { simulateClaim } from './actors.js';
import { OPEN } from '../../src/airdrop/airdropKitCreator.js';

const generateInt = x => () => Math.floor(Math.random() * (x + 1));

const createTestTier = generateInt(4); // ?

/** @typedef {typeof import('../../src/airdrop/airdropKitCreator.js').start} AssetContractFn */

const myRequire = createRequire(import.meta.url);
const contractPath = myRequire.resolve(
  `../../src/airdrop/airdropKitCreator.js`,
);
const AIRDROP_TIERS_STATIC = [9000n, 6500n, 3500n, 1500n, 750n];

/** @type {import('ava').TestFn<Awaited<ReturnType<makeTestContext>>>} */
const test = anyTest;
const publicKeys = accounts.map(x => x.pubkey.key);

const defaultCustomTerms = {
  initialPayoutValues: AIRDROP_TIERS_STATIC,
  targetNumberOfEpochs: 5,
  targetEpochLength: TimeIntervals.SECONDS.ONE_DAY,
  targetTokenSupply: 10_000_000n,
  tokenName: 'Tribbles',
  startTime: oneDay,
  merkleRoot: merkleTreeAPI.generateMerkleRoot(publicKeys),
};

const UNIT6 = 1_000_000n;

const timerTracer = label => value => {
  console.log(label, '::: latest #### ', value);
  return value;
};
const makeLocalTimer = async (
  createTimerFn = buildManualTimer(timerTracer('default timer'), 5n),
) => {
  const timer = createTimerFn();

  const timerBrand = await E(timer).getTimerBrand();

  return {
    timer,
    timerBrand,
  };
};
/**
 * Tests assume access to the zoe service and that contracts are bundled.
 *
 * See test-bundle-source.js for basic use of bundleSource().
 * Here we use a bundle cache to optimize running tests multiple times.
 *
 * @param {unknown} _t
 */
const makeTestContext = async _t => {
  const { zoeService: zoe, feeMintAccess } = makeZoeKitForTest();

  const bundleCache = await makeNodeBundleCache('bundles/', {}, s => import(s));
  const bundle = await bundleCache.load(contractPath, 'assetContract');
  const testFeeIssuer = await E(zoe).getFeeIssuer();
  const testFeeBrand = await E(testFeeIssuer).getBrand();

  const testFeeTokenFaucet = await makeStableFaucet({
    feeMintAccess,
    zoe,
    bundleCache,
  });
  console.log('bundle:::', { bundle, bundleCache });
  return {
    zoe,
    bundle,
    bundleCache,
    makeLocalTimer,
    testFeeTokenFaucet,
    faucet: testFeeTokenFaucet.faucet,
    testFeeBrand,
    testFeeIssuer,
  };
};

test.before(async t => (t.context = await makeTestContext(t)));

// IDEA: use test.serial and pass work products
// between tests using t.context.

test('Install the contract', async t => {
  const { zoe, bundle } = t.context;

  const installation = await E(zoe).install(bundle);
  t.log(installation);
  t.is(typeof installation, 'object');
});

const startLocalInstance = async (
  t,
  bundle,
  { issuers: { Fee }, zoe, terms: customTerms },
) => {
  const timer = buildManualTimer();

  const timerBrand = await E(timer).getTimerBrand();
  /** @type {ERef<Installation<AssetContractFn>>} */
  const installation = await E(zoe).install(bundle);

  const instance = await E(zoe).startInstance(
    installation,
    { Fee },
    {
      ...customTerms,
      startTime: harden({ timerBrand, relValue: customTerms.startTime }),
    },
    { timer },
  );

  const publicFacet = await instance.publicFacet;
  t.log('instance', { instance });

  return { instance, installation, timer, publicFacet };
};

test.serial('Start the contract', async t => {
  const { zoe: zoeRef, bundle, bundleCache, feeMintAccess } = t.context;

  const testFeeIssuer = await E(zoeRef).getFeeIssuer();

  const testFeeTokenFaucet = await makeStableFaucet({
    feeMintAccess,
    zoe: zoeRef,
    bundleCache,
  });
  console.log('context:', { testFeeTokenFaucet });

  const localTestConfig = {
    zoe: zoeRef,
    issuers: { Fee: testFeeIssuer },
    terms: defaultCustomTerms,
  };

  const contractInstance = await startLocalInstance(t, bundle, localTestConfig);
  t.log(contractInstance.instance);
  t.is(typeof contractInstance.instance, 'object');
});
const makeOfferArgs = ({ pubkey: { key }, address }) => ({
  key,
  proof: merkleTreeAPI.generateMerkleProof(key, publicKeys),
  address,
  tier: createTestTier(),
});

test('Airdrop ::: happy paths', async t => {
  const { zoe: zoeRef, bundle, faucet } = await t.context;
  console.log(t.context);
  const { instance, publicFacet, timer } = await startLocalInstance(t, bundle, {
    zoe: zoeRef,
    issuers: { Fee: await E(zoeRef).getFeeIssuer() },
    terms: defaultCustomTerms,
  });

  await E(timer).advanceBy(oneDay * (oneDay / 2n));

  t.deepEqual(await E(publicFacet).getStatus(), OPEN);

  t.log({ faucet });
  await E(timer).advanceBy(oneDay);
  const feePurse = await faucet(5n * UNIT6);
  t.log(feePurse);
  await t.deepEqual(
    feePurse.getCurrentAmount(),
    AmountMath.make(t.context.testFeeBrand, 5_000_000n),
  );
  const offerArgs = makeOfferArgs(head(accounts));

  console.log({ offerArgs });
  await simulateClaim(t, zoeRef, instance.instance, feePurse, offerArgs);

  await E(timer).advanceBy(oneDay);

  await simulateClaim(
    t,
    zoeRef,
    instance.instance,
    feePurse,
    makeOfferArgs(accounts[2]),
  );

  await E(timer).advanceBy(oneDay);

  t.deepEqual(await E(publicFacet).getStatus(), 'claim-window-open');

  await E(timer).advanceBy(oneDay);
});

test('MN-2 Task: Add a deployment test that exercises the core-eval that will be used to install & start the contract on chain.', async t => {
  const { bundle } = t.context;

  console.groupEnd();
  const bundleID = getBundleId(bundle);
  const { powers, vatAdminState } = await mockBootstrapPowers(t.log);
  const { feeMintAccess, zoe } = powers.consume;

  // When the BLD staker governance proposal passes,
  // the startup function gets called.
  vatAdminState.installBundle(bundleID, bundle);
  const airdropPowers = extract(permit, powers);
  const boardAuxPowers = extract(boardAuxPermit, powers);
  await Promise.all([
    produceBoardAuxManager(boardAuxPowers),
    startTribblesAirdrop(airdropPowers, {
      options: {
        customTerms: makeTerms(),
        tribblesAirdrop: { bundleID },
      },
    }),
  ]);
  const sellSpace = powers;
  const instance = await sellSpace.instance.consume.tribblesAirdrop;

  // Now that we have the instance, resume testing as above.
  const { bundleCache } = t.context;
  const { faucet } = makeStableFaucet({ bundleCache, feeMintAccess, zoe });
  await t.throwsAsync(
    simulateClaim(
      t,
      zoe,
      instance,
      await faucet(5n * UNIT6),
      makeOfferArgs(accounts[3]),
    ),
    {
      message: 'Claim attempt failed.',
    },
  );
});

// test('use the code that will go on chain to start the contract', async t => {
//   const noop = harden(() => {});

//   // Starting the contract consumes an installation
//   // and produces an instance, brand, and issuer.
//   // We coordinate these with promises.
//   const makeProducer = () => ({ ...makePromiseKit(), reset: noop });
//   const sync = {
//     installation: makeProducer(),
//     instance: makeProducer(),
//     brand: makeProducer(),
//     issuer: makeProducer(),
//   };

//   /**
//    * Chain bootstrap makes a number of powers available
//    * to code approved by BLD staker governance.
//    *
//    * Here we simulate the ones needed for starting this contract.
//    */
//   const mockBootstrap = async () => {
//     const board = { getId: noop };
//     const chainStorage = Far('chainStorage', {
//       makeChildNode: async () => chainStorage,
//       setValue: async () => {},
//     });

//     const { zoe } = t.context;
//     const startUpgradable = async ({
//       installation,
//       issuerKeywordRecord,
//       label,
//       terms,
//     }) =>
//       E(zoe).startInstance(installation, issuerKeywordRecord, terms, {}, label);
//     const feeIssuer = await E(zoe).getFeeIssuer();
//     const feeBrand = await E(feeIssuer).getBrand();

//     const pFor = x => Promise.resolve(x);
//     const powers = {
//       consume: { zoe, chainStorage, startUpgradable, board },
//       brand: {
//         consume: { IST: pFor(feeBrand) },
//         produce: { Item: sync.brand },
//       },
//       issuer: {
//         consume: { IST: pFor(feeIssuer) },
//         produce: { Item: sync.issuer },
//       },
//       installation: { consume: { offerUp: sync.installation.promise } },
//       instance: { produce: { offerUp: sync.instance } },
//     };
//     return powers;
//   };

//   const powers = await mockBootstrap();

//   // Code to install the contract is automatically
//   // generated by `agoric run`. No need to test that part.
//   const { zoe, bundle } = t.context;
//   const installation = E(zoe).install(bundle);
//   sync.installation.resolve(installation);

//   // When the BLD staker governance proposal passes,
//   // the startup function gets called.
//   await startOfferUpContract(powers);
//   const instance = await sync.instance.promise;

//   // Now that we have the instance, resume testing as above.
//   const { feeMintAccess, bundleCache } = t.context;
//   const { faucet } = makeStableFaucet({ bundleCache, feeMintAccess, zoe });
//   await alice(t, zoe, instance, await faucet(5n * UNIT6));
// });
