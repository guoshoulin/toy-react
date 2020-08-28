const RENDER_TO_DOM = Symbol('render to dom')

export class Component {

  constructor(props) {
    this.props = Object.create(null);
    this._root = null;
    this._range = null;
    this.children = [];
  }


  // 获取虚报dom
  get vdom() {
    return this.render().vdom;
  }

  setAttribute(name, value) {
      this.props[name] = value; 
  }

  appendChild(component) {
    this.children.push(component);
  }

  [RENDER_TO_DOM](range) {
    this._range = range;
    this._vdom = this.vdom;
    this._vdom[RENDER_TO_DOM](range);
  }

  // 更新dom树
  update() {

    // 定义一个isSameNode 方法来做虚拟DOM的diff
    let isSameNode = (oldNode, newNode) => {
      // 判断节点类型是不是一样
      if(oldNode.type !== newNode.type) {
        return false;
      }

      // 新老节点的props值不同
      for (const key in newNode.props) {
        if (oldNode.props[key] !== newNode.props[key]) {
          // 在比对事件的时候, 我们每次都会实例化一个新的事件函数。这就导致了我们的ToyReact处理不了关于事件调度方面的diff了。
          // 如果想要达到React那样, 只更新某个节点 这样的效果的话, 我们可以采取最残暴的手法, 直接忽略所有的事件。
          if(typeof newNode.props[key] !== 'function') {
            return false;
          }
        }
      }

      // 新节点的props少于老节点的props
      if(Object.keys(oldNode.props).length >  Object.keys(newNode.props).length)
      return false;

      // 如果文本节点的内容修改了
      if(newNode.type === "#text") {
        if(newNode.content !== oldNode.content) {
          return false;
        }
      }

      return true;
    }

    let update = (oldNode, newNode) => {
      // 判断新的虚拟DOM节点与老的虚拟DOM节点 是否一样, 如果一样那么就直接替换range
      if(!isSameNode(oldNode, newNode)) {
          newNode[RENDER_TO_DOM](oldNode._range)
          return;
      }

      newNode._range = oldNode._range;

      let newChildren = newNode.vchildren;
      let oldChildren = oldNode.vchildren;

      if(!newChildren || !newChildren.length){
        return;
      }

      let tailRange = oldChildren[oldChildren.length -1]._range;

      // 通过递归的方式去比对子节点。 如果节点不一样, 那么就更新当前节点下的range, 从而达到部分更新的效果。
      for (let index = 0; index < newChildren.length; index++) {
        const newChild = newChildren[index];
        const oldChild = oldChildren[index];
        if(index < oldChildren.length) {
          update(oldChild, newChild);
        } else {
          let range = document.createRange();
          range.setStart(tailRange.endContainer,tailRange.endOffset);
          range.setEnd(tailRange.endContainer,tailRange.endOffset);
          newChild[RENDER_TO_DOM](range);
          tailRange = range;
        }
      }
    }

    let vdom = this.vdom;
    update(this._vdom, vdom);
    this._vdom = vdom;

  }

  // setState方法主要是将新的state与老的state比较, 然后进行一个深拷贝的操作。
  setState(newState) {
    // 如果this.state不存在或者类型不是对象的时候, 我们直接使用新的state去替换它。
    if(this.state === null && typeof this.state !== 'object') {
      this.state = newState;
      this.update();
      return;
    }

    // 然后通过递归将新的state中的值直接赋值到旧的对应的state值。
    let merge = (oldState, newState) => {
        for (const key in newState) {
          if(oldState[key] === null || typeof oldState[key] !== 'object') {
            oldState[key] = newState[key]
          } else {
            merge(oldState[key], newState[key]);
          }
        }
    }

    merge(this.state, newState);
    this.update();
  }

}

function replaceContent(range, node) {
  range.insertNode(node);
  range.setStartAfter(node);
  
  range.deleteContents();

  range.setStartBefore(node);
  range.setEndAfter(node);

}

class ElementWrapper extends Component {
    constructor(type) {
      super(type);
      this.type = type;
    }

    get vdom() {
      this.vchildren = this.children.map(item => item.vdom);
      return this;
    }

    [RENDER_TO_DOM](range) {
      this._range = range;
      let root = document.createElement(this.type);

      // 第一部分的for循环其实做的就是 setAttribute 的事情, 将属性赋值到元素上,
      for (const name in this.props) {
        let value = this.props[name];
        // 只有元素节点上才能绑定事件, 因此我们肯定是在ElementWrapper类中进行修改。
        // 我们写一个简单的正则来匹配所有on开头的事件, 比如onClick, onHover, onMouseUp.....
        if (name.match(/^on([\s\S]+)/)) {
          root.addEventListener(RegExp.$1.replace(/^[\s\S]/, s => s.toLowerCase()), value);
        }
        // 如果属性是className，则需要把className转为css能够识别的class，这样样式才能生效
        if (name === 'className') {
          root.setAttribute('class', value);
        } else {
          root.setAttribute(name, value);
        }
      }

      if(!this.vchildren)
      this.vchildren = this.children.map(item => item.vdom);
      
      // 第二部分的for循环做的事情则是通过递归的方式插入child.
      for (const child of this.vchildren) {
          const childRange = document.createRange();
          childRange.setStart(root, root.childNodes.length);
          childRange.setEnd(root, root.childNodes.length);
          child[RENDER_TO_DOM](childRange);
      }

      replaceContent(range, root);

    }

  
}

class TextNodeWrapper extends Component {
  constructor(content) {
    super(content);
    this.root = document.createTextNode(content);
    this.content = content;
    this.type = "#text";
  }

  get vdom() {
    return this;
  }

  [RENDER_TO_DOM](range) {
    this._range = range;
    let root = document.createTextNode(this.content);
    replaceContent(range, root);
  }
}



export const ToyReact = {
  createElement(type, attributes, ...children) {
    let element;
    if(typeof type === 'string') {
       element = new ElementWrapper(type);
    } else {
      element = new type;
    }

    for (let name in attributes) {
      element.setAttribute(name, attributes[name])
    }

    function insertChildren(children) {
      for (let child of children) {
        if(typeof child === 'string') {
          child = new TextNodeWrapper(child)
        }
        if(!child) {
          return;
        }
        if(typeof child === 'object' && child instanceof Array) {
          insertChildren(child);
          return;
        }
        element.appendChild(child)
      }
    }

    insertChildren(children);
    
    return element;
  },

  render(component, parentElement) {
    const range = document.createRange();
    range.setStart(parentElement, 0);
    range.setEnd(parentElement, parentElement.childNodes.length);
    range.deleteContents();
    component[RENDER_TO_DOM](range)
  }
}