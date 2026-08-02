// Ensure user objects from Firestore always have a safe blocked list
export const normalizeUser = (user) => {
  if (!user) return null;

  return {
    ...user,
    blocked: Array.isArray(user.blocked) ? user.blocked : [],
  };
};
