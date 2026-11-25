import { translatePhraseToArabic } from './frToArDictionary';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'PATH',
  'CODE',
  'PRE',
  'TEXTAREA',
  'KBD',
  'IFRAME'
]);

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;

let observer: MutationObserver | null = null;
let isApplying = false;
let rafId: number | null = null;
let pendingRoots = new Set<Node>();

// Track original vs written strings per node/element so React updates and language switches stay clean
const originalTextMap = new WeakMap<Text, string>();
const writtenTextMap = new WeakMap<Text, string>();
const trackedTextNodes = new Set<Text>();

const originalAttrMap = new WeakMap<Element, Map<string, string>>();
const writtenAttrMap = new WeakMap<Element, Map<string, string>>();
const trackedElements = new Set<Element>();

const addedOptionValues = new Set<HTMLOptionElement>();

function shouldSkipElement(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
    if (
      cur.classList?.contains('no-translate') ||
      cur.classList?.contains('force-ltr') ||
      cur.hasAttribute('data-no-translate') ||
      cur.getAttribute('contenteditable') === 'true'
    ) {
      return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

function processTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || shouldSkipElement(parent)) return;

  const current = node.nodeValue ?? '';
  if (!current.trim()) return;

  // If this exact Arabic value was already written by us, skip
  const lastWritten = writtenTextMap.get(node);
  if (lastWritten !== undefined && current === lastWritten) {
    return;
  }

  // Otherwise current is a fresh source string (initial mount or React update)
  originalTextMap.set(node, current);
  trackedTextNodes.add(node);

  // Protect <option> without explicit value attribute so form values stay intact in French/DB format
  if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) {
    const opt = parent as HTMLOptionElement;
    opt.setAttribute('value', current.trim());
    addedOptionValues.add(opt);
  }

  const translated = translatePhraseToArabic(current);
  if (translated !== current) {
    writtenTextMap.set(node, translated);
    node.nodeValue = translated;
  } else {
    writtenTextMap.delete(node);
  }
}

function processElementAttrs(el: Element): void {
  if (shouldSkipElement(el)) return;

  for (const attr of TRANSLATABLE_ATTRS) {
    const val = el.getAttribute(attr);
    if (!val || !val.trim()) continue;

    const wMap = writtenAttrMap.get(el);
    if (wMap && wMap.get(attr) === val) continue;

    let oMap = originalAttrMap.get(el);
    if (!oMap) {
      oMap = new Map<string, string>();
      originalAttrMap.set(el, oMap);
    }
    oMap.set(attr, val);
    trackedElements.add(el);

    const translated = translatePhraseToArabic(val);
    if (translated !== val) {
      let nextWMap = writtenAttrMap.get(el);
      if (!nextWMap) {
        nextWMap = new Map<string, string>();
        writtenAttrMap.set(el, nextWMap);
      }
      nextWMap.set(attr, translated);
      el.setAttribute(attr, translated);
    } else {
      writtenAttrMap.get(el)?.delete(attr);
    }
  }
}

function translateSubtree(root: Node): void {
  if (!root) return;

  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (shouldSkipElement(el)) return;
    processElementAttrs(el);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (shouldSkipElement(node as Element)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode: Node | null = walker.nextNode();
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      processTextNode(currentNode as Text);
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      processElementAttrs(currentNode as Element);
    }
    currentNode = walker.nextNode();
  }
}

function flushPendingTranslations(): void {
  rafId = null;
  if (isApplying) return;

  const roots = Array.from(pendingRoots);
  pendingRoots.clear();
  if (roots.length === 0) return;

  isApplying = true;
  try {
    for (const root of roots) {
      if (root.isConnected) {
        translateSubtree(root);
      }
    }
  } finally {
    isApplying = false;
  }
}

function scheduleRoot(node: Node): void {
  pendingRoots.add(node);
  if (rafId === null) {
    rafId = window.requestAnimationFrame(flushPendingTranslations);
  }
}

export function startArabicDomTranslation(rootElement?: Element | null): void {
  if (typeof document === 'undefined') return;
  const target = rootElement || document.body;
  if (!target) return;

  stopArabicDomTranslation();

  // Initial synchronous pass so there is zero untranslated flash
  isApplying = true;
  try {
    translateSubtree(target);
  } finally {
    isApplying = false;
  }

  observer = new MutationObserver(mutations => {
    if (isApplying) return;

    // Apply immediately inside a micro-pass for snappy modals & dropdowns
    isApplying = true;
    try {
      for (const m of mutations) {
        if (m.type === 'characterData') {
          if (m.target.nodeType === Node.TEXT_NODE && m.target.isConnected) {
            processTextNode(m.target as Text);
          }
        } else if (m.type === 'attributes') {
          if (m.target.nodeType === Node.ELEMENT_NODE && (m.target as Element).isConnected) {
            processElementAttrs(m.target as Element);
          }
        } else if (m.type === 'childList') {
          m.addedNodes.forEach(added => {
            if (added.isConnected) {
              translateSubtree(added);
            }
          });
        }
      }
    } finally {
      isApplying = false;
    }

    // Also queue a coalesced rAF pass for any rapid chained state updates
    if (target.isConnected) {
      scheduleRoot(target);
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS]
  });
}

export function stopArabicDomTranslation(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  pendingRoots.clear();

  isApplying = true;
  try {
    trackedTextNodes.forEach(node => {
      if (!node.isConnected) return;
      const written = writtenTextMap.get(node);
      const original = originalTextMap.get(node);
      if (original !== undefined && written !== undefined && node.nodeValue === written) {
        node.nodeValue = original;
      }
      writtenTextMap.delete(node);
    });
    trackedTextNodes.clear();

    trackedElements.forEach(el => {
      if (!el.isConnected) return;
      const oMap = originalAttrMap.get(el);
      const wMap = writtenAttrMap.get(el);
      if (oMap && wMap) {
        for (const [attr, origVal] of oMap.entries()) {
          if (el.getAttribute(attr) === wMap.get(attr)) {
            el.setAttribute(attr, origVal);
          }
        }
      }
      writtenAttrMap.delete(el);
    });
    trackedElements.clear();

    addedOptionValues.forEach(opt => {
      if (opt.isConnected) {
        opt.removeAttribute('value');
      }
    });
    addedOptionValues.clear();
  } finally {
    isApplying = false;
  }
}
