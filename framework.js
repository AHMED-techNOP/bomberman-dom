const SimpleReact = (function() {
  
  let currentVTree = null; // Store the current virtual DOM

  //------------------------------------------------------------

  let states = [];
  let stateIndex = 0;
  let isRendering = false; // Prevent recursive renders

  function useState(initialValue) {
    const currentIndex = stateIndex;
    states[currentIndex] = states[currentIndex] !== undefined ? states[currentIndex] : initialValue;

    function setState(newValue) {
      const nextValue = typeof newValue === 'function' ? newValue(states[currentIndex]) : newValue;
      if (!Object.is(states[currentIndex], nextValue)) {
        states[currentIndex] = nextValue;
        if (!isRendering) {
          render();
        }
      }
    }

    stateIndex++;
    return [states[currentIndex], setState];
  }

    //------------------------------------------------------------


  let cleanups = [];
  let effects = [];
  let effectIndex = 0;

  function useEffect(callback, dependencies) {
    const oldDependencies = effects[effectIndex];
    let hasChanged = true;

    if (oldDependencies) {
      hasChanged = dependencies.some((dep, i) => !Object.is(dep, oldDependencies[i]));
    }

    if (hasChanged) {
      // Call previous cleanup if it exists
      if (cleanups[effectIndex]) cleanups[effectIndex]();
      // Store new cleanup (if any)
      cleanups[effectIndex] = callback() || null;
    }

    effects[effectIndex] = dependencies;
    effectIndex++;
  }


    //------------------------------------------------------------



  function jsx(tag, props, ...children) {
    if (typeof tag === 'function') {
      return tag({ ...(props || {}), children });
    }
    return { tag, props: props || {}, children };
  }


    //------------------------------------------------------------




  function createElement(node) {
    // Handle null, undefined, false, true
    if (node === null || node === undefined || node === false || node === true) {
      return document.createTextNode('');
    }
    
    if (typeof node === 'string' || typeof node === 'number') {
      return document.createTextNode(String(node));
    }

    const element = document.createElement(node.tag);

    for (let [name, value] of Object.entries(node.props || {})) {
      if (name.startsWith('on') && typeof value === 'function') {
        element.addEventListener(name.slice(2).toLowerCase(), value);
      } else if (name === 'className') {
        element.className = value;
      } else if (name === 'id') {
        element.id = value;
      } else if (name === 'value' && element.tagName === 'INPUT') {
        element.value = value;  
      } else if (name === 'checked' && element.tagName === 'INPUT') {
        element.checked = value;   
      } else if (name === 'style' && typeof value === 'object' && value !== null) {
        for (let [k, v] of Object.entries(value)) {
          element.style[k] = v;
        }
      } else {
        element.setAttribute(name, value);
      }
    }

    for (let child of (node.children || []).flat()) {
      if (child === null || child === undefined || child === false || child === true) {
        // Skip null, undefined, false, true
        continue;
      }
      
      if (typeof child === 'string' || typeof child === 'number') {
        element.appendChild(document.createTextNode(String(child)));
      } else {
        element.appendChild(createElement(child));
      }
    }
    return element;
  }


    //------------------------------------------------------------




  // virtual DOM diffing
  function diff(oldNode, newNode, element) {
    // Handle null, undefined, false, true for both old and new nodes
    if (oldNode === null || oldNode === undefined || oldNode === false || oldNode === true) {
      oldNode = '';
    }
    if (newNode === null || newNode === undefined || newNode === false || newNode === true) {
      newNode = '';
    }

    if (!oldNode) {
      return createElement(newNode);
    }
    if (!newNode) {
      element.remove();
      return null;
    }
    
    if (typeof oldNode === 'string' || typeof oldNode === 'number') {
      if (typeof newNode === 'string' || typeof newNode === 'number') {
        if (oldNode !== newNode) {
          element.textContent = String(newNode);
        }
        return element;
      } else {
        const newElement = createElement(newNode);
        element.parentNode.replaceChild(newElement, element);
        return newElement;
      }
    }
    
    if (oldNode.tag !== newNode.tag) {
      const newElement = createElement(newNode);
      element.parentNode.replaceChild(newElement, element);
      return newElement;
    }
    
    // Update props before children to ensure event handlers are properly set
    updateProps(element, oldNode.props || {}, newNode.props || {});
    
    // Filter out falsy values from children
    const oldChildren = (oldNode.children || []).flat().filter(child => 
      child !== null && child !== undefined && child !== false && child !== true
    );
    const newChildren = (newNode.children || []).flat().filter(child => 
      child !== null && child !== undefined && child !== false && child !== true
    );
    
    // Remove extra children first
    while (element.childNodes.length > newChildren.length) {
      element.removeChild(element.lastChild);
    }
    
    // Update or add children
    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      const oldChild = oldChildren[i];
      
      if (i >= element.childNodes.length) {
        // Add new child
        element.appendChild(createElement(newChild));
      } else {
        // Update existing child
        diff(oldChild, newChild, element.childNodes[i]);
      }
    }
    
    return element;
  }



    //------------------------------------------------------------




  
  function updateProps(element, oldProps, newProps) {
    for (let name in oldProps) {
      if (!(name in newProps)) {
        if (name.startsWith('on')) {
          element.removeEventListener(name.slice(2).toLowerCase(), oldProps[name]);
        } else if (name === 'className') {
          element.className = '';
        } else if (name === 'id') {
          element.id = '';
        } else if (name === 'style') {
          // Remove all old styles
          for (let k in oldProps.style) {
            element.style[k] = '';
          }
        } else {
          element.removeAttribute(name);
        }
      }
    }
    
    for (let name in newProps) {
      if (oldProps[name] !== newProps[name]) {
        if (name.startsWith('on') && typeof newProps[name] === 'function') {
          if (oldProps[name]) {
            element.removeEventListener(name.slice(2).toLowerCase(), oldProps[name]);
          }
          element.addEventListener(name.slice(2).toLowerCase(), newProps[name]);
        } else if (name === 'className') {
          element.className = newProps[name];
        } else if (name === 'id') {
          element.id = newProps[name];
        } else if (name === 'value' && element.tagName === 'INPUT') {
          element.value = newProps[name];  // Update value directly
        } else if (name === 'checked' && element.tagName === 'INPUT') {
          element.checked = newProps[name];  // Update checked state
        } else if (name === 'style' && typeof newProps[name] === 'object' && newProps[name] !== null) {
          // Remove all old styles first
          if (oldProps.style) {
            for (let k in oldProps.style) {
              element.style[k] = '';
            }
          }
          // Apply new styles
          for (let k in newProps.style) {
            element.style[k] = newProps.style[k];
          }
        } else {
          element.setAttribute(name, newProps[name]);
        }
      }
    }
  }


    //------------------------------------------------------------


    

  function render() {
    isRendering = true; // Set rendering flag
    stateIndex = 0;
    effectIndex = 0;
    const root = document.getElementById('root');
    const newVTree = App();
    
    if (!currentVTree) {
      // First render
      root.innerHTML = '';
      root.appendChild(createElement(newVTree));
    } else {
      // Use diffing for updates
      diff(currentVTree, newVTree, root.firstChild);
    }
    
    currentVTree = newVTree;
    isRendering = false; // Reset rendering flag
  }

  //------------------------------------------------------------

  // Simple Router
  let currentRoute = window.location.hash || '#/';
  let routeCallbacks = [];

  function useRouter() {
    const [route, setRoute] = useState(currentRoute);

    useEffect(() => {
      function handleHashChange() {
        const newRoute = window.location.hash || '#/';
        currentRoute = newRoute;
        setRoute(newRoute);
        // Notify all route callbacks
        routeCallbacks.forEach(callback => callback(newRoute));
      }

      window.addEventListener('hashchange', handleHashChange);
      
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }, []);

    function navigate(path) {
      window.location.hash = path;
    }

    function getParams() {
      const hash = currentRoute.replace('#/', '');
      return hash || 'all';
    }

    return { route, navigate, getParams };
  }

  //------------------------------------------------------------

  return { useState, useEffect, jsx, createElement, render, useRouter };
})();

const { useState, useEffect, jsx,createElement, render, useRouter } = SimpleReact;
