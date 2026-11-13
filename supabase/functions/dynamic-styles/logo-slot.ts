// Native HighLevel logos and theme-customizer uploads share the header and sidebar
// slots. A wide upload (or an older scale(1.45) rule) was painting outside that slot.

export function logoSlotCSS(): string {
  return `/* Keep native and uploaded logos inside the header and sidebar slots. */
html body .hl_header :is(.agency-logo-container, .hl_header--logo, .hl-header-logo),
html body #sidebar-v2 .agency-logo-container {
  display: flex !important;
  align-items: center !important;
  box-sizing: border-box !important;
  max-width: min(220px, 42vw) !important;
  max-height: 48px !important;
  overflow: hidden !important;
}
html body .hl_header :is(img.agency-logo, img.company-logo, .agency-logo-container img, .hl_header--logo img, .hl-header-logo img),
html body #sidebar-v2 :is(img.agency-logo, img.sai-logo-slot, .agency-logo-container img):not(.sai-logo-hidden),
html body .transition-slowest .flex-col .overflow-hidden .agency-logo-container img {
  display: block !important;
  box-sizing: border-box !important;
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 40px !important;
  object-fit: contain !important;
  object-position: center !important;
  transform: none !important;
}
`;
}
