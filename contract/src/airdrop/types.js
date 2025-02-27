/**
 * @typedef {object} NatInstance
 * Represents a natural number with semigroup concatenation capabilities.
 *
 * @property {import('@agoric/ertp/src/types.js').NatValue} value - The integer value of the natural number.
 * @property {function(NatInstance): NatInstance} concat - A binary function
 *           that takes another NatInstance and returns the sum NatInstance holding the
 * @property {function(): import('@agoric/ertp/src/types.js').NatValue} fold - A function that returns the integer
 *           value contained in the NatInstance.
 * @property {function(): string} inspect - A function that returns a string representation of the NatInstance.
 */

/**
 * @typedef {object} EpochDetails
 * @property {bigint} windowLength Length of epoch in seconds. This value is used by the contract's timerService to schedule a wake up that will fire once all of the seconds in an epoch have elapsed
 * @property {import('@agoric/ertp/src/types.js').NatValue} tokenQuantity The total number of tokens recieved by each user who claims during a particular epoch.
 * @property {bigint} index The index of a particular epoch.
 * @property {number} inDays Length of epoch formatted in total number of days
 */