import { vi } from 'vitest';

export function installTinyDom() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  class TinyNode {
    childNodes: TinyNode[] = [];
    nodeType: number;
    nodeName: string;
    ownerDocument: TinyDocument;
    parentNode: TinyNode | null = null;
    private text = '';

    constructor(nodeType: number, nodeName: string, ownerDocument: TinyDocument) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.ownerDocument = ownerDocument;
    }

    appendChild(node: TinyNode) {
      this.childNodes.push(node);
      node.parentNode = this;
      return node;
    }

    insertBefore(node: TinyNode, before: TinyNode | null) {
      const index = before ? this.childNodes.indexOf(before) : -1;
      if (index === -1) {
        return this.appendChild(node);
      }
      this.childNodes.splice(index, 0, node);
      node.parentNode = this;
      return node;
    }

    removeChild(node: TinyNode) {
      this.childNodes = this.childNodes.filter(child => child !== node);
      node.parentNode = null;
      return node;
    }

    addEventListener() {}

    removeEventListener() {}

    get textContent() {
      return this.text || this.childNodes.map(node => node.textContent).join('');
    }

    set textContent(value: string) {
      this.text = value;
      this.childNodes = [];
    }
  }

  class TinyElement extends TinyNode {
    attributes: Record<string, string> = {};
    style: Record<string, string> = {};
    tagName: string;

    constructor(tagName: string, ownerDocument: TinyDocument) {
      super(1, tagName.toUpperCase(), ownerDocument);
      this.tagName = this.nodeName;
    }

    removeAttribute(name: string) {
      delete this.attributes[name];
    }

    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }
  }

  class TinyText extends TinyNode {
    constructor(text: string, ownerDocument: TinyDocument) {
      super(3, '#text', ownerDocument);
      this.textContent = text;
    }
  }

  class TinyDocument {
    body: TinyElement;
    defaultView = globalThis;
    nodeName = '#document';
    nodeType = 9;
    ownerDocument = this;

    constructor() {
      this.body = new TinyElement('body', this);
    }

    addEventListener() {}

    createComment(text: string) {
      return new TinyText(text, this);
    }

    createElement(tagName: string) {
      return new TinyElement(tagName, this);
    }

    createTextNode(text: string) {
      return new TinyText(text, this);
    }

    removeEventListener() {}
  }

  const document = new TinyDocument();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('Node', TinyNode);
  vi.stubGlobal('Element', TinyElement);
  vi.stubGlobal('HTMLElement', TinyElement);
  vi.stubGlobal('HTMLIFrameElement', class HTMLIFrameElement {});
}
