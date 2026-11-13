// Design system v0.1 data-visualization palette. Use direct labels as well as color.
export const chartColors = {
  categorical: ["#6043EF", "#171717", "#0D9488", "#B45309", "#DC2626", "#2563EB", "#15803D"],
  status: { positive: "#15803D", negative: "#DC2626", warning: "#B45309" },
  sequential: ["#E9E5FD", "#D3CAFB", "#B1A2F7", "#8B74F3", "#6043EF", "#3E27AE"],
  grid: "#E5E7EB",
  axis: "#6B7280",
  label: "#020817",
} as const;
