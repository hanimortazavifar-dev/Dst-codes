const faNumber = new Intl.NumberFormat("fa-IR");

/** Rounds and formats a number with Persian digits and separators. */
export const fa = (n: number) => faNumber.format(Math.round(n));

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
