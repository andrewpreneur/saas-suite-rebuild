import { test, expect } from "bun:test";
import { buildSwitchyardCSS, cleanSwitchyardColors, SWITCHYARD_DEFAULTS } from "../supabase/functions/_shared/switchyardTheme";
import { buildBrandingThemeJS, brandingThemeMarker, readBrandingTheme } from "../supabase/functions/_shared/brandingTheme";
import { buildFaviconJS, faviconMarker, readFavicon } from "../supabase/functions/_shared/brandingFavicon";
import { splitBrandingCSS, updateBrandingPart } from "../src/lib/brandingSections";
import { emptyDesignSnapshot, designSavePlan } from "../src/lib/designPageModel";
import { validFaviconFile } from "../src/lib/faviconUpload";

test("favicon upload accepts supported images up to 2 MB and rejects scripts or larger files", () => {
  expect(validFaviconFile({name:"icon.png",size:2097152,type:"image/png"})).toBe(true);
  expect(validFaviconFile({name:"icon.ico",size:100,type:""})).toBe(true);
  expect(validFaviconFile({name:"icon.png",size:2097153,type:"image/png"})).toBe(false);
  expect(validFaviconFile({name:"icon.png",size:100,type:"text/html"})).toBe(false);
  expect(validFaviconFile({name:"icon.svg",size:100,type:"image/svg+xml"})).toBe(false);
});

test("Switchyard customizer can be disabled independently of saved CSS", () => {
  const options = { version:"switchyard" as const, motion:false, font:"Roboto", iconPack:"default", sidebarBg:"#11171f", accent:"#175993", switchyard:SWITCHYARD_DEFAULTS, customizerEnabled:false };
  const css = brandingThemeMarker(options) + buildSwitchyardCSS(options.switchyard);
  expect(readBrandingTheme(css)?.version).toBe("switchyard");
  expect(buildBrandingThemeJS(css,"saassuite")).toBe("");
  expect(buildBrandingThemeJS(brandingThemeMarker({...options,customizerEnabled:true}),"saassuite")).toContain('"sidebar":"#switchyard-primary-navigation"');
});
test("manual colors survive validation and unsafe colors fall back", () => {
  expect(cleanSwitchyardColors({accentText:"#ffffff",iconColor:"#123456"}).iconColor).toBe("#123456");
  expect(cleanSwitchyardColors({sidebarBg:"red;}body{display:none"}).sidebarBg).toBe("#11171f");
});
test("Switchyard color and customizer edits are saved as sidebar only", () => {
  const saved = {...emptyDesignSnapshot(),sidebarStyle:"switchyard" as const};
  expect(designSavePlan(saved,{...saved,customizerEnabled:false})).toEqual([{kind:"sidebar"}]);
  expect(designSavePlan(saved,{...saved,switchyard:{...SWITCHYARD_DEFAULTS,accentText:"#111111"}})).toEqual([{kind:"sidebar"}]);
});
test("favicon remains independent when sidebar is replaced or removed", () => {
  const url = "https://example.com/icon.png";
  const current = updateBrandingPart(updateBrandingPart("","favicon",faviconMarker(url)),"sidebar","old");
  expect(readFavicon(updateBrandingPart(current,"sidebar",""))).toBe(url);
  const removed = updateBrandingPart(current,"favicon","");
  expect(readFavicon(removed)).toBe("");
  expect(splitBrandingCSS(removed).sidebar).toBe("old");
  const saved = emptyDesignSnapshot();
  expect(designSavePlan(saved,{...saved,faviconUrl:url})).toEqual([{kind:"favicon"}]);
});
test("favicon rejects executable URLs and installs actual link elements", () => {
  expect(()=>faviconMarker("javascript:alert(1)")).toThrow();
  expect(readFavicon('/* SS-FAVICON:"javascript:alert(1)" */')).toBe("");
  const links: {href?:string,rel?:string,removeAttribute:()=>void}[] = [];
  const doc = {querySelectorAll:()=>links,createElement:()=>({removeAttribute(){}}),head:{appendChild:(l:typeof links[number])=>links.push(l)}};
  new Function("document",buildFaviconJS(faviconMarker("https://example.com/icon.png")))(doc);
  expect(links[0]?.href).toBe("https://example.com/icon.png");
  expect(links[0]?.rel).toBe("shortcut icon");
});