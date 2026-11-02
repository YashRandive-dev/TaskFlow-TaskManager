// Use-cases a user can pick during onboarding. Each one maps to a category.
const PURPOSES = {
  work: { name: 'Work', icon: 'briefcase' },
  study: { name: 'Study', icon: 'book' },
  health: { name: 'Health', icon: 'heart' },
  shopping: { name: 'Shopping', icon: 'cart' },
  personal: { name: 'Personal', icon: 'home' },
};
const PURPOSE_NAMES = new Set(Object.values(PURPOSES).map((p) => p.name));

/** Categories for the chosen purposes, keeping any custom categories the user made. */
const categoriesFor = (purposes = [], existing = []) => {
  const base = purposes.filter((p) => PURPOSES[p]).map((p) => PURPOSES[p]);
  const custom = existing.filter((c) => !PURPOSE_NAMES.has(c.name));
  return [...base, ...custom].map((c) => ({ name: c.name, icon: c.icon || 'tag' }));
};

module.exports = { PURPOSES, categoriesFor };
