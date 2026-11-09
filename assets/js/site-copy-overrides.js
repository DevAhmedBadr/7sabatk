import { getSiteLanguage } from './site-language.js';
import { loadPublicSettings } from './data.js';

function pathOf(element, root) {
  const parts = [];
  let node = element;
  while (node && node !== root) {
    const parent = node.parentElement;
    if (!parent) break;
    const peers = [...parent.children].filter((item) => item.tagName === node.tagName);
    parts.unshift(`${node.tagName.toLowerCase()}:${peers.indexOf(node)}`);
    node = parent;
  }
  return parts.join('>');
}

async function applySavedCopy() {
  const route = location.pathname.split('/').filter(Boolean).pop() || 'index';
  const page = route.endsWith('.html') ? route : `${route}.html`;
  if (page === 'index.html') return; // app.js applies the homepage copy after it loads its settings.
  const [language, settings] = await Promise.all([getSiteLanguage(), loadPublicSettings()]);
  const saved = settings?.site_html_texts;
  if (!saved || typeof saved !== 'object') return;
  const root = document.body;
  const prefix = `${page}::`;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement || node.parentElement.closest('script,style,noscript,template,svg,code,pre')) continue;
    const index = [...node.parentElement.childNodes].filter((item) => item.nodeType === Node.TEXT_NODE).indexOf(node);
    const entry = saved[`${prefix}${pathOf(node, root)}::text:${index}`];
    const current = node.nodeValue.trim();
    const value = entry?.[language];
    if (typeof value === 'string' && value.trim()) node.nodeValue = node.nodeValue.replace(current, value);
  }
  document.querySelectorAll('input,textarea,button,a,[title],[aria-label],[placeholder],[alt]').forEach((element) => {
    for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
      const entry = saved[`${prefix}${pathOf(element, root)}::attr:${attr}`];
      const current = (element.getAttribute(attr) || '').trim();
      const value = entry?.[language];
      if (typeof value === 'string' && value.trim()) element.setAttribute(attr, value);
    }
  });
}

applySavedCopy().catch((error) => console.warn('Could not apply saved page text:', error));
