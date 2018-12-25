import { Directive, ElementRef, Renderer, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * This directive overrides ngx-translate's directive, which doesn't seem to work
 * with ionic components such as <ion-title /> (Specifically, for
 * components that automatically add child nodes).
 * This replacement directive recursively translates all child nodes by calling
 * ngx-translate's service method.
 *
 * TODO: Check if there is no better way to do this (Maybe by getting the original content through TemplateRef or something)
 */
@Directive({
  selector: '[translate]'
})
export class IonicTranslateDirective {
  /**
   * Cache of the original translation keys for each text node
   */
  private nodeKeys:Array<{node: any, key: string}> = [];
  
  public constructor(
    private el: ElementRef,
    private renderer: Renderer,
    private translateSvc:TranslateService
  ) { 
    this.translateSvc.onLangChange.subscribe(() => {
      this.translateHTMLNode(this.el.nativeElement);
    });
  }

  @Input() set translate(key: string) {
    this.translateHTMLNode(this.el.nativeElement);
  }
  
  /**
   * Get the cached translation key for a text DOM node
   * @param  {DOMElement} node the text node
   * @return {string}          the translation key
   */
  private getNodeKey(node):string {
    let nodeKeyData = this.nodeKeys.find(nodeKeyData => nodeKeyData.node === node);
    if (nodeKeyData) {
      return nodeKeyData.key;
    }
    
    let key = node.textContent.trim();
    if (!key) {
      return null;
    }
    
    this.nodeKeys.push({node, key});
    return key;
  }
  
  /**
   * Recursively translate a DOM node and all its children
   * @param  {DOMElement} node the node to translate
   */
  private translateHTMLNode(node) {
    if (node.nodeType === 3) {
      // -> the text node we want to translate
      const nodeKey = this.getNodeKey(node);
      if (nodeKey) {
        const translation = this.translateSvc.instant(nodeKey);
        this.renderer.setElementProperty(node, 'textContent', translation);
      }
      return;
    }
    
    if (node.nodeType === 8 && node.nextSibling) {
      // -> ng-container comment followed by the actual node we want to translate
      this.translateHTMLNode(node.nextSibling);
      return;
    }
    
    // Not a text/comment node
    // -> check if we can find a translatable text node
    // at a lower level of the DOM:
    for (let childNode of node.childNodes) {
      this.translateHTMLNode(childNode);
    }
  }
}
