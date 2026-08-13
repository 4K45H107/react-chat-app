/**
 * Ensure user objects from Firestore always have a safe blocked list.
 * @param {import("../types").AppUser|null|undefined} user
 * @returns {import("../types").AppUser|null}
 */
export const normalizeUser = (user) => {
  if (!user) return null;

  return {
    ...user,
    blocked: Array.isArray(user.blocked) ? user.blocked : [],
  };
};
