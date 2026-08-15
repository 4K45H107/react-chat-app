const THEME_KEY = "react-chat-theme";

export const THEMES = ["dark", "light"];

export const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEMES.includes(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
};

export const applyTheme = (theme) => {
  const next = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // ignore quota / private mode
  }
  return next;
};

export const cycleTheme = () => {
  const current =
    document.documentElement.getAttribute("data-theme") || getStoredTheme();
  const index = Math.max(0, THEMES.indexOf(current));
  return applyTheme(THEMES[(index + 1) % THEMES.length]);
};
