// Illustrations SVG générées (aucune photo de produit : voir docs). Chaque image porte un titre accessible.
import { hashStr } from './text.js';
const FAM_COLORS = { florale: ['#E8C7C8', '#C98B9B'], orientale: ['#D9A86C', '#A8622E'], boisee: ['#B89B72', '#6F5535'], hesperidee: ['#F0DC8A', '#D9B13B'], gourmande: ['#D9A27A', '#9A5B3A'], chypree: ['#B8B58A', '#6E7152'], fougere: ['#A9BFA0', '#5E7E58'], aromatique: ['#B7C9A8', '#6F8A5E'], aquatique: ['#BFD9E3', '#6FA3BD'], cuiree: ['#9C7B63', '#4A3428'], epicee: ['#D58A67', '#A04A2C'] };
const CAT_COLORS = { skincare: ['#E8E1D7', '#A79B8C'], maquillage: ['#E3C3B8', '#B3202B'], cheveux: ['#D8DDD0', '#7C8B6B'], corps: ['#E5D8C8', '#A58B6B'] };

function bottle(c1, c2, id) {
  return `<defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect x="150" y="40" width="60" height="38" rx="5" fill="#242321"/><rect x="164" y="78" width="32" height="16" fill="#CC3F28"/>
<rect x="105" y="94" width="150" height="190" rx="18" fill="#fff" stroke="#A79B8C" stroke-width="2"/>
<rect x="115" y="170" width="130" height="104" rx="10" fill="url(#g${id})"/><rect x="140" y="120" width="80" height="34" rx="3" fill="#F7F5F0" stroke="#E8E1D7"/>
<rect x="150" y="131" width="60" height="3" fill="#A79B8C"/><rect x="158" y="139" width="44" height="3" fill="#CC3F28"/>`;
}
const shapes = {
  skincare: (c1, c2, id) => `<defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="145" y="60" width="70" height="50" rx="6" fill="#242321"/><rect x="132" y="110" width="96" height="170" rx="14" fill="url(#g${id})"/><rect x="146" y="170" width="68" height="60" rx="4" fill="#F7F5F0" opacity=".9"/><rect x="156" y="190" width="48" height="3" fill="#A79B8C"/>`,
  maquillage: (c1, c2, id) => `<rect x="150" y="50" width="60" height="110" rx="6" fill="#242321"/><rect x="154" y="160" width="52" height="30" fill="#CC3F28"/><rect x="150" y="190" width="60" height="90" rx="6" fill="#242321"/><path d="M158 50 L180 8 L202 50 Z" fill="${c2}"/>`,
  cheveux: (c1, c2, id) => `<defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="162" y="40" width="36" height="34" rx="4" fill="#242321"/><rect x="132" y="74" width="96" height="206" rx="22" fill="url(#g${id})"/><rect x="146" y="150" width="68" height="70" rx="4" fill="#F7F5F0" opacity=".92"/><rect x="156" y="172" width="48" height="3" fill="#A79B8C"/>`,
  corps: (c1, c2, id) => `<defs><linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><path d="M140 70 H220 L228 270 Q228 288 210 288 H150 Q132 288 132 270 Z" fill="url(#g${id})"/><rect x="150" y="48" width="60" height="26" rx="4" fill="#242321"/><rect x="146" y="150" width="68" height="64" rx="4" fill="#F7F5F0" opacity=".92"/>`,
};

export function productSvg(p) {
  const id = hashStr(p.slug) % 9999;
  let colors;
  if (p.category === 'parfum') colors = FAM_COLORS[p.families[0]] || ['#E8E1D7', '#A79B8C'];
  else colors = CAT_COLORS[p.category] || ['#E8E1D7', '#A79B8C'];
  const art = p.category === 'parfum' ? bottle(colors[0], colors[1], id) : shapes[p.category](colors[0], colors[1], id);
  const label = `Illustration de démonstration — ${p.brand} ${p.name}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 320" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><rect width="360" height="320" fill="#F7F5F0"/><ellipse cx="180" cy="296" rx="90" ry="9" fill="#E8E1D7"/>${art}</svg>`;
}
export function brandSvg(b) {
  const initials = b.name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" role="img" aria-label="Monogramme ${esc(b.name)}"><title>Monogramme ${esc(b.name)}</title><rect width="240" height="120" fill="#F7F5F0"/><circle cx="120" cy="52" r="30" fill="none" stroke="#CC3F28" stroke-width="1.5"/><text x="120" y="61" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#242321">${esc(initials)}</text><text x="120" y="104" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="2" fill="#A79B8C">${esc(b.name.toUpperCase().slice(0, 26))}</text></svg>`;
}
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
