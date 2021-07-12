/**
 * A reference to globalThis, with support
 * for browsers that don't yet support the spec.
 * @public
 */
const $global = function () {
  if (typeof globalThis !== "undefined") {
    // We're running in a modern environment.
    return globalThis;
  }

  if (typeof global !== "undefined") {
    // We're running in NodeJS
    return global;
  }

  if (typeof self !== "undefined") {
    // We're running in a worker.
    return self;
  }

  if (typeof window !== "undefined") {
    // We're running in the browser's main thread.
    return window;
  }

  try {
    // Hopefully we never get here...
    // Not all environments allow eval and Function. Use only as a last resort:
    // eslint-disable-next-line no-new-func
    return new Function("return this")();
  } catch (_a) {
    // If all fails, give up and create an object.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {};
  }
}(); // API-only Polyfill for trustedTypes

if ($global.trustedTypes === void 0) {
  $global.trustedTypes = {
    createPolicy: (n, r) => r
  };
}
/**
 * A readonly, empty array.
 * @remarks
 * Typically returned by APIs that return arrays when there are
 * no actual items to return.
 * @internal
 */


const emptyArray = Object.freeze([]);

const updateQueue = [];
/* eslint-disable */

const fastHTMLPolicy = $global.trustedTypes.createPolicy("fast-html", {
  createHTML: html => html
});
/* eslint-enable */

let htmlPolicy = fastHTMLPolicy;

function processQueue() {
  const capacity = 1024;
  let index = 0;

  while (index < updateQueue.length) {
    const task = updateQueue[index];
    task.call();
    index++; // Prevent leaking memory for long chains of recursive calls to `queueMicroTask`.
    // If we call `queueMicroTask` within a MicroTask scheduled by `queueMicroTask`, the queue will
    // grow, but to avoid an O(n) walk for every MicroTask we execute, we don't
    // shift MicroTasks off the queue after they have been executed.
    // Instead, we periodically shift 1024 MicroTasks off the queue.

    if (index > capacity) {
      // Manually shift all values starting at the index back to the
      // beginning of the queue.
      for (let scan = 0, newLength = updateQueue.length - index; scan < newLength; scan++) {
        updateQueue[scan] = updateQueue[scan + index];
      }

      updateQueue.length -= index;
      index = 0;
    }
  }

  updateQueue.length = 0;
}

const marker = `fast-${Math.random().toString(36).substring(2, 8)}`;
/** @internal */

const _interpolationStart = `${marker}{`;
/** @internal */

const _interpolationEnd = `}${marker}`;
/**
 * Common DOM APIs.
 * @public
 */

const DOM = Object.freeze({
  /**
   * Indicates whether the DOM supports the adoptedStyleSheets feature.
   */
  supportsAdoptedStyleSheets: Array.isArray(document.adoptedStyleSheets) && "replace" in CSSStyleSheet.prototype,

  /**
   * Sets the HTML trusted types policy used by the templating engine.
   * @param policy - The policy to set for HTML.
   * @remarks
   * This API can only be called once, for security reasons. It should be
   * called by the application developer at the start of their program.
   */
  setHTMLPolicy(policy) {
    if (htmlPolicy !== fastHTMLPolicy) {
      throw new Error("The HTML policy can only be set once.");
    }

    htmlPolicy = policy;
  },

  /**
   * Turns a string into trusted HTML using the configured trusted types policy.
   * @param html - The string to turn into trusted HTML.
   * @remarks
   * Used internally by the template engine when creating templates
   * and setting innerHTML.
   */
  createHTML(html) {
    return htmlPolicy.createHTML(html);
  },

  /**
   * Determines if the provided node is a template marker used by the runtime.
   * @param node - The node to test.
   */
  isMarker(node) {
    return node && node.nodeType === 8 && node.data.startsWith(marker);
  },

  /**
   * Given a marker node, extract the {@link HTMLDirective} index from the placeholder.
   * @param node - The marker node to extract the index from.
   */
  extractDirectiveIndexFromMarker(node) {
    return parseInt(node.data.replace(`${marker}:`, ""));
  },

  /**
   * Creates a placeholder string suitable for marking out a location *within*
   * an attribute value or HTML content.
   * @param index - The directive index to create the placeholder for.
   * @remarks
   * Used internally by binding directives.
   */
  createInterpolationPlaceholder(index) {
    return `${_interpolationStart}${index}${_interpolationEnd}`;
  },

  /**
   * Creates a placeholder that manifests itself as an attribute on an
   * element.
   * @param attributeName - The name of the custom attribute.
   * @param index - The directive index to create the placeholder for.
   * @remarks
   * Used internally by attribute directives such as `ref`, `slotted`, and `children`.
   */
  createCustomAttributePlaceholder(attributeName, index) {
    return `${attributeName}="${this.createInterpolationPlaceholder(index)}"`;
  },

  /**
   * Creates a placeholder that manifests itself as a marker within the DOM structure.
   * @param index - The directive index to create the placeholder for.
   * @remarks
   * Used internally by structural directives such as `repeat`.
   */
  createBlockPlaceholder(index) {
    return `<!--${marker}:${index}-->`;
  },

  /**
   * Schedules DOM update work in the next async batch.
   * @param callable - The callable function or object to queue.
   */
  queueUpdate(callable) {
    if (updateQueue.length < 1) {
      window.requestAnimationFrame(processQueue);
    }

    updateQueue.push(callable);
  },

  /**
   * Resolves with the next DOM update.
   */
  nextUpdate() {
    return new Promise(resolve => {
      DOM.queueUpdate(resolve);
    });
  },

  /**
   * Sets an attribute value on an element.
   * @param element - The element to set the attribute value on.
   * @param attributeName - The attribute name to set.
   * @param value - The value of the attribute to set.
   * @remarks
   * If the value is `null` or `undefined`, the attribute is removed, otherwise
   * it is set to the provided value using the standard `setAttribute` API.
   */
  setAttribute(element, attributeName, value) {
    if (value === null || value === undefined) {
      element.removeAttribute(attributeName);
    } else {
      element.setAttribute(attributeName, value);
    }
  },

  /**
   * Sets a boolean attribute value.
   * @param element - The element to set the boolean attribute value on.
   * @param attributeName - The attribute name to set.
   * @param value - The value of the attribute to set.
   * @remarks
   * If the value is true, the attribute is added; otherwise it is removed.
   */
  setBooleanAttribute(element, attributeName, value) {
    value ? element.setAttribute(attributeName, "") : element.removeAttribute(attributeName);
  },

  /**
   * Removes all the child nodes of the provided parent node.
   * @param parent - The node to remove the children from.
   */
  removeChildNodes(parent) {
    for (let child = parent.firstChild; child !== null; child = parent.firstChild) {
      parent.removeChild(child);
    }
  },

  /**
   * Creates a TreeWalker configured to walk a template fragment.
   * @param fragment - The fragment to walk.
   */
  createTemplateWalker(fragment) {
    return document.createTreeWalker(fragment, 133, // element, text, comment
    null, false);
  }

});

function spilloverSubscribe(subscriber) {
  const spillover = this.spillover;
  const index = spillover.indexOf(subscriber);

  if (index === -1) {
    spillover.push(subscriber);
  }
}

function spilloverUnsubscribe(subscriber) {
  const spillover = this.spillover;
  const index = spillover.indexOf(subscriber);

  if (index !== -1) {
    spillover.splice(index, 1);
  }
}

function spilloverNotifySubscribers(args) {
  const spillover = this.spillover;
  const source = this.source;

  for (let i = 0, ii = spillover.length; i < ii; ++i) {
    spillover[i].handleChange(source, args);
  }
}

function spilloverHas(subscriber) {
  return this.spillover.indexOf(subscriber) !== -1;
}
/**
 * An implementation of {@link Notifier} that efficiently keeps track of
 * subscribers interested in a specific change notification on an
 * observable source.
 *
 * @remarks
 * This set is optimized for the most common scenario of 1 or 2 subscribers.
 * With this in mind, it can store a subscriber in an internal field, allowing it to avoid Array#push operations.
 * If the set ever exceeds two subscribers, it upgrades to an array automatically.
 * @public
 */


class SubscriberSet {
  /**
   * Creates an instance of SubscriberSet for the specified source.
   * @param source - The object source that subscribers will receive notifications from.
   * @param initialSubscriber - An initial subscriber to changes.
   */
  constructor(source, initialSubscriber) {
    this.sub1 = void 0;
    this.sub2 = void 0;
    this.spillover = void 0;
    this.source = source;
    this.sub1 = initialSubscriber;
  }
  /**
   * Checks whether the provided subscriber has been added to this set.
   * @param subscriber - The subscriber to test for inclusion in this set.
   */


  has(subscriber) {
    return this.sub1 === subscriber || this.sub2 === subscriber;
  }
  /**
   * Subscribes to notification of changes in an object's state.
   * @param subscriber - The object that is subscribing for change notification.
   */


  subscribe(subscriber) {
    if (this.has(subscriber)) {
      return;
    }

    if (this.sub1 === void 0) {
      this.sub1 = subscriber;
      return;
    }

    if (this.sub2 === void 0) {
      this.sub2 = subscriber;
      return;
    }

    this.spillover = [this.sub1, this.sub2, subscriber];
    this.subscribe = spilloverSubscribe;
    this.unsubscribe = spilloverUnsubscribe;
    this.notify = spilloverNotifySubscribers;
    this.has = spilloverHas;
    this.sub1 = void 0;
    this.sub2 = void 0;
  }
  /**
   * Unsubscribes from notification of changes in an object's state.
   * @param subscriber - The object that is unsubscribing from change notification.
   */


  unsubscribe(subscriber) {
    if (this.sub1 === subscriber) {
      this.sub1 = void 0;
    } else if (this.sub2 === subscriber) {
      this.sub2 = void 0;
    }
  }
  /**
   * Notifies all subscribers.
   * @param args - Data passed along to subscribers during notification.
   */


  notify(args) {
    const sub1 = this.sub1;
    const sub2 = this.sub2;
    const source = this.source;

    if (sub1 !== void 0) {
      sub1.handleChange(source, args);
    }

    if (sub2 !== void 0) {
      sub2.handleChange(source, args);
    }
  }

}
/**
 * An implementation of Notifier that allows subscribers to be notified
 * of individual property changes on an object.
 * @public
 */

class PropertyChangeNotifier {
  /**
   * Creates an instance of PropertyChangeNotifier for the specified source.
   * @param source - The object source that subscribers will receive notifications from.
   */
  constructor(source) {
    this.subscribers = {};
    this.source = source;
  }
  /**
   * Notifies all subscribers, based on the specified property.
   * @param propertyName - The property name, passed along to subscribers during notification.
   */


  notify(propertyName) {
    const subscribers = this.subscribers[propertyName];

    if (subscribers !== void 0) {
      subscribers.notify(propertyName);
    }
  }
  /**
   * Subscribes to notification of changes in an object's state.
   * @param subscriber - The object that is subscribing for change notification.
   * @param propertyToWatch - The name of the property that the subscriber is interested in watching for changes.
   */


  subscribe(subscriber, propertyToWatch) {
    let subscribers = this.subscribers[propertyToWatch];

    if (subscribers === void 0) {
      this.subscribers[propertyToWatch] = subscribers = new SubscriberSet(this.source);
    }

    subscribers.subscribe(subscriber);
  }
  /**
   * Unsubscribes from notification of changes in an object's state.
   * @param subscriber - The object that is unsubscribing from change notification.
   * @param propertyToUnwatch - The name of the property that the subscriber is no longer interested in watching.
   */


  unsubscribe(subscriber, propertyToUnwatch) {
    const subscribers = this.subscribers[propertyToUnwatch];

    if (subscribers === void 0) {
      return;
    }

    subscribers.unsubscribe(subscriber);
  }

}

const volatileRegex = /(:|&&|\|\||if)/;
const notifierLookup = new WeakMap();
const accessorLookup = new WeakMap();
let watcher = void 0;

let createArrayObserver = array => {
  throw new Error("Must call enableArrayObservation before observing arrays.");
};

class DefaultObservableAccessor {
  constructor(name) {
    this.name = name;
    this.field = `_${name}`;
    this.callback = `${name}Changed`;
  }

  getValue(source) {
    if (watcher !== void 0) {
      watcher.watch(source, this.name);
    }

    return source[this.field];
  }

  setValue(source, newValue) {
    const field = this.field;
    const oldValue = source[field];

    if (oldValue !== newValue) {
      source[field] = newValue;
      const callback = source[this.callback];

      if (typeof callback === "function") {
        callback.call(source, oldValue, newValue);
      }
      /* eslint-disable-next-line @typescript-eslint/no-use-before-define */


      getNotifier(source).notify(this.name);
    }
  }

}
/**
 * Common Observable APIs.
 * @public
 */


const Observable = Object.freeze({
  /**
   * @internal
   * @param factory - The factory used to create array observers.
   */
  setArrayObserverFactory(factory) {
    createArrayObserver = factory;
  },

  /**
   * Gets a notifier for an object or Array.
   * @param source - The object or Array to get the notifier for.
   */
  getNotifier(source) {
    let found = source.$fastController || notifierLookup.get(source);

    if (found === void 0) {
      if (Array.isArray(source)) {
        found = createArrayObserver(source);
      } else {
        notifierLookup.set(source, found = new PropertyChangeNotifier(source));
      }
    }

    return found;
  },

  /**
   * Records a property change for a source object.
   * @param source - The object to record the change against.
   * @param propertyName - The property to track as changed.
   */
  track(source, propertyName) {
    if (watcher !== void 0) {
      watcher.watch(source, propertyName);
    }
  },

  /**
   * Notifies watchers that the currently executing property getter or function is volatile
   * with respect to its observable dependencies.
   */
  trackVolatile() {
    if (watcher !== void 0) {
      watcher.needsRefresh = true;
    }
  },

  /**
   * Notifies subscribers of a source object of changes.
   * @param source - the object to notify of changes.
   * @param args - The change args to pass to subscribers.
   */
  notify(source, args) {
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    getNotifier(source).notify(args);
  },

  /**
   * Defines an observable property on an object or prototype.
   * @param target - The target object to define the observable on.
   * @param nameOrAccessor - The name of the property to define as observable;
   * or a custom accessor that specifies the property name and accessor implementation.
   */
  defineProperty(target, nameOrAccessor) {
    if (typeof nameOrAccessor === "string") {
      nameOrAccessor = new DefaultObservableAccessor(nameOrAccessor);
    }

    this.getAccessors(target).push(nameOrAccessor);
    Reflect.defineProperty(target, nameOrAccessor.name, {
      enumerable: true,
      get: function () {
        return nameOrAccessor.getValue(this);
      },
      set: function (newValue) {
        nameOrAccessor.setValue(this, newValue);
      }
    });
  },

  /**
   * Finds all the observable accessors defined on the target,
   * including its prototype chain.
   * @param target - The target object to search for accessor on.
   */
  getAccessors(target) {
    let accessors = accessorLookup.get(target);

    if (accessors === void 0) {
      let currentTarget = Reflect.getPrototypeOf(target);

      while (accessors === void 0 && currentTarget !== null) {
        accessors = accessorLookup.get(currentTarget);
        currentTarget = Reflect.getPrototypeOf(currentTarget);
      }

      if (accessors === void 0) {
        accessors = [];
      } else {
        accessors = accessors.slice(0);
      }

      accessorLookup.set(target, accessors);
    }

    return accessors;
  },

  /**
   * Creates a {@link BindingObserver} that can watch the
   * provided {@link Binding} for changes.
   * @param binding - The binding to observe.
   * @param initialSubscriber - An initial subscriber to changes in the binding value.
   * @param isVolatileBinding - Indicates whether the binding's dependency list must be re-evaluated on every value evaluation.
   */
  binding(binding, initialSubscriber, isVolatileBinding = this.isVolatileBinding(binding)) {
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    return new BindingObserverImplementation(binding, initialSubscriber, isVolatileBinding);
  },

  /**
   * Determines whether a binding expression is volatile and needs to have its dependency list re-evaluated
   * on every evaluation of the value.
   * @param binding - The binding to inspect.
   */
  isVolatileBinding(binding) {
    return volatileRegex.test(binding.toString());
  }

});
const getNotifier = Observable.getNotifier;
Observable.trackVolatile;
const queueUpdate = DOM.queueUpdate;
/**
 * Decorator: Defines an observable property on the target.
 * @param target - The target to define the observable on.
 * @param nameOrAccessor - The property name or accessor to define the observable as.
 * @public
 */

function observable(target, nameOrAccessor) {
  Observable.defineProperty(target, nameOrAccessor);
}
let currentEvent = null;
/**
 * @param event - The event to set as current for the context.
 * @internal
 */

function setCurrentEvent(event) {
  currentEvent = event;
}
/**
 * Provides additional contextual information available to behaviors and expressions.
 * @public
 */

class ExecutionContext {
  constructor() {
    /**
     * The index of the current item within a repeat context.
     */
    this.index = 0;
    /**
     * The length of the current collection within a repeat context.
     */

    this.length = 0;
    /**
     * The parent data object within a repeat context.
     */

    this.parent = null;
    /**
     * The parent execution context when in nested context scenarios.
     */

    this.parentContext = null;
  }
  /**
   * The current event within an event handler.
   */


  get event() {
    return currentEvent;
  }
  /**
   * Indicates whether the current item within a repeat context
   * has an even index.
   */


  get isEven() {
    return this.index % 2 === 0;
  }
  /**
   * Indicates whether the current item within a repeat context
   * has an odd index.
   */


  get isOdd() {
    return this.index % 2 !== 0;
  }
  /**
   * Indicates whether the current item within a repeat context
   * is the first item in the collection.
   */


  get isFirst() {
    return this.index === 0;
  }
  /**
   * Indicates whether the current item within a repeat context
   * is somewhere in the middle of the collection.
   */


  get isInMiddle() {
    return !this.isFirst && !this.isLast;
  }
  /**
   * Indicates whether the current item within a repeat context
   * is the last item in the collection.
   */


  get isLast() {
    return this.index === this.length - 1;
  }

}
Observable.defineProperty(ExecutionContext.prototype, "index");
Observable.defineProperty(ExecutionContext.prototype, "length");
/**
 * The default execution context used in binding expressions.
 * @public
 */

const defaultExecutionContext = Object.seal(new ExecutionContext());

class BindingObserverImplementation extends SubscriberSet {
  constructor(binding, initialSubscriber, isVolatileBinding = false) {
    super(binding, initialSubscriber);
    this.binding = binding;
    this.isVolatileBinding = isVolatileBinding;
    this.needsRefresh = true;
    this.needsQueue = true;
    this.first = this;
    this.last = null;
    this.propertySource = void 0;
    this.propertyName = void 0;
    this.notifier = void 0;
    this.next = void 0;
  }

  observe(source, context) {
    if (this.needsRefresh && this.last !== null) {
      this.disconnect();
    }

    const previousWatcher = watcher;
    watcher = this.needsRefresh ? this : void 0;
    this.needsRefresh = this.isVolatileBinding;
    const result = this.binding(source, context);
    watcher = previousWatcher;
    return result;
  }

  disconnect() {
    if (this.last !== null) {
      let current = this.first;

      while (current !== void 0) {
        current.notifier.unsubscribe(this, current.propertyName);
        current = current.next;
      }

      this.last = null;
      this.needsRefresh = this.needsQueue = true;
    }
  }
  /** @internal */


  watch(propertySource, propertyName) {
    const prev = this.last;
    const notifier = getNotifier(propertySource);
    const current = prev === null ? this.first : {};
    current.propertySource = propertySource;
    current.propertyName = propertyName;
    current.notifier = notifier;
    notifier.subscribe(this, propertyName);

    if (prev !== null) {
      if (!this.needsRefresh) {
        watcher = void 0;
        const prevValue = prev.propertySource[prev.propertyName];
        watcher = this;

        if (propertySource === prevValue) {
          this.needsRefresh = true;
        }
      }

      prev.next = current;
    }

    this.last = current;
  }
  /** @internal */


  handleChange() {
    if (this.needsQueue) {
      this.needsQueue = false;
      queueUpdate(this);
    }
  }
  /** @internal */


  call() {
    if (this.last !== null) {
      this.needsQueue = true;
      this.notify(this);
    }
  }

  records() {
    let next = this.first;
    return {
      next: () => {
        const current = next;

        if (current === undefined) {
          return {
            value: void 0,
            done: true
          };
        } else {
          next = next.next;
          return {
            value: current,
            done: false
          };
        }
      },
      [Symbol.iterator]: function () {
        return this;
      }
    };
  }

}

/**
 * Instructs the template engine to apply behavior to a node.
 * @public
 */

class HTMLDirective {
  constructor() {
    /**
     * The index of the DOM node to which the created behavior will apply.
     */
    this.targetIndex = 0;
  }

}
/**
 * A {@link HTMLDirective} that targets a named attribute or property on a node.
 * @public
 */

class TargetedHTMLDirective extends HTMLDirective {
  constructor() {
    super(...arguments);
    /**
     * Creates a placeholder string based on the directive's index within the template.
     * @param index - The index of the directive within the template.
     */

    this.createPlaceholder = DOM.createInterpolationPlaceholder;
  }

}
/**
 * A directive that attaches special behavior to an element via a custom attribute.
 * @public
 */

class AttachedBehaviorHTMLDirective extends HTMLDirective {
  /**
   *
   * @param name - The name of the behavior; used as a custom attribute on the element.
   * @param behavior - The behavior to instantiate and attach to the element.
   * @param options - Options to pass to the behavior during creation.
   */
  constructor(name, behavior, options) {
    super();
    this.name = name;
    this.behavior = behavior;
    this.options = options;
  }
  /**
   * Creates a placeholder string based on the directive's index within the template.
   * @param index - The index of the directive within the template.
   * @remarks
   * Creates a custom attribute placeholder.
   */


  createPlaceholder(index) {
    return DOM.createCustomAttributePlaceholder(this.name, index);
  }
  /**
   * Creates a behavior for the provided target node.
   * @param target - The node instance to create the behavior for.
   * @remarks
   * Creates an instance of the `behavior` type this directive was constructed with
   * and passes the target and options to that `behavior`'s constructor.
   */


  createBehavior(target) {
    return new this.behavior(target, this.options);
  }

}

function normalBind(source, context) {
  this.source = source;
  this.context = context;

  if (this.bindingObserver === null) {
    this.bindingObserver = Observable.binding(this.binding, this, this.isBindingVolatile);
  }

  this.updateTarget(this.bindingObserver.observe(source, context));
}

function triggerBind(source, context) {
  this.source = source;
  this.context = context;
  this.target.addEventListener(this.targetName, this);
}

function normalUnbind() {
  this.bindingObserver.disconnect();
  this.source = null;
  this.context = null;
}

function contentUnbind() {
  this.bindingObserver.disconnect();
  this.source = null;
  this.context = null;
  const view = this.target.$fastView;

  if (view !== void 0 && view.isComposed) {
    view.unbind();
    view.needsBindOnly = true;
  }
}

function triggerUnbind() {
  this.target.removeEventListener(this.targetName, this);
  this.source = null;
  this.context = null;
}

function updateAttributeTarget(value) {
  DOM.setAttribute(this.target, this.targetName, value);
}

function updateBooleanAttributeTarget(value) {
  DOM.setBooleanAttribute(this.target, this.targetName, value);
}

function updateContentTarget(value) {
  // If there's no actual value, then this equates to the
  // empty string for the purposes of content bindings.
  if (value === null || value === undefined) {
    value = "";
  } // If the value has a "create" method, then it's a template-like.


  if (value.create) {
    this.target.textContent = "";
    let view = this.target.$fastView; // If there's no previous view that we might be able to
    // reuse then create a new view from the template.

    if (view === void 0) {
      view = value.create();
    } else {
      // If there is a previous view, but it wasn't created
      // from the same template as the new value, then we
      // need to remove the old view if it's still in the DOM
      // and create a new view from the template.
      if (this.target.$fastTemplate !== value) {
        if (view.isComposed) {
          view.remove();
          view.unbind();
        }

        view = value.create();
      }
    } // It's possible that the value is the same as the previous template
    // and that there's actually no need to compose it.


    if (!view.isComposed) {
      view.isComposed = true;
      view.bind(this.source, this.context);
      view.insertBefore(this.target);
      this.target.$fastView = view;
      this.target.$fastTemplate = value;
    } else if (view.needsBindOnly) {
      view.needsBindOnly = false;
      view.bind(this.source, this.context);
    }
  } else {
    const view = this.target.$fastView; // If there is a view and it's currently composed into
    // the DOM, then we need to remove it.

    if (view !== void 0 && view.isComposed) {
      view.isComposed = false;
      view.remove();

      if (view.needsBindOnly) {
        view.needsBindOnly = false;
      } else {
        view.unbind();
      }
    }

    this.target.textContent = value;
  }
}

function updatePropertyTarget(value) {
  this.target[this.targetName] = value;
}

function updateClassTarget(value) {
  const classVersions = this.classVersions || Object.create(null);
  const target = this.target;
  let version = this.version || 0; // Add the classes, tracking the version at which they were added.

  if (value !== null && value !== undefined && value.length) {
    const names = value.split(/\s+/);

    for (let i = 0, ii = names.length; i < ii; ++i) {
      const currentName = names[i];

      if (currentName === "") {
        continue;
      }

      classVersions[currentName] = version;
      target.classList.add(currentName);
    }
  }

  this.classVersions = classVersions;
  this.version = version + 1; // If this is the first call to add classes, there's no need to remove old ones.

  if (version === 0) {
    return;
  } // Remove classes from the previous version.


  version -= 1;

  for (const name in classVersions) {
    if (classVersions[name] === version) {
      target.classList.remove(name);
    }
  }
}
/**
 * A directive that configures data binding to element content and attributes.
 * @public
 */


class HTMLBindingDirective extends TargetedHTMLDirective {
  /**
   * Creates an instance of BindingDirective.
   * @param binding - A binding that returns the data used to update the DOM.
   */
  constructor(binding) {
    super();
    this.binding = binding;
    this.bind = normalBind;
    this.unbind = normalUnbind;
    this.updateTarget = updateAttributeTarget;
    this.isBindingVolatile = Observable.isVolatileBinding(this.binding);
  }
  /**
   * Gets/sets the name of the attribute or property that this
   * binding is targeting.
   */


  get targetName() {
    return this.originalTargetName;
  }

  set targetName(value) {
    this.originalTargetName = value;

    if (value === void 0) {
      return;
    }

    switch (value[0]) {
      case ":":
        this.cleanedTargetName = value.substr(1);
        this.updateTarget = updatePropertyTarget;

        if (this.cleanedTargetName === "innerHTML") {
          const binding = this.binding;
          /* eslint-disable-next-line */

          this.binding = (s, c) => DOM.createHTML(binding(s, c));
        }

        break;

      case "?":
        this.cleanedTargetName = value.substr(1);
        this.updateTarget = updateBooleanAttributeTarget;
        break;

      case "@":
        this.cleanedTargetName = value.substr(1);
        this.bind = triggerBind;
        this.unbind = triggerUnbind;
        break;

      default:
        this.cleanedTargetName = value;

        if (value === "class") {
          this.updateTarget = updateClassTarget;
        }

        break;
    }
  }
  /**
   * Makes this binding target the content of an element rather than
   * a particular attribute or property.
   */


  targetAtContent() {
    this.updateTarget = updateContentTarget;
    this.unbind = contentUnbind;
  }
  /**
   * Creates the runtime BindingBehavior instance based on the configuration
   * information stored in the BindingDirective.
   * @param target - The target node that the binding behavior should attach to.
   */


  createBehavior(target) {
    /* eslint-disable-next-line @typescript-eslint/no-use-before-define */
    return new BindingBehavior(target, this.binding, this.isBindingVolatile, this.bind, this.unbind, this.updateTarget, this.cleanedTargetName);
  }

}
/**
 * A behavior that updates content and attributes based on a configured
 * BindingDirective.
 * @public
 */

class BindingBehavior {
  /**
   * Creates an instance of BindingBehavior.
   * @param target - The target of the data updates.
   * @param binding - The binding that returns the latest value for an update.
   * @param isBindingVolatile - Indicates whether the binding has volatile dependencies.
   * @param bind - The operation to perform during binding.
   * @param unbind - The operation to perform during unbinding.
   * @param updateTarget - The operation to perform when updating.
   * @param targetName - The name of the target attribute or property to update.
   */
  constructor(target, binding, isBindingVolatile, bind, unbind, updateTarget, targetName) {
    /** @internal */
    this.source = null;
    /** @internal */

    this.context = null;
    /** @internal */

    this.bindingObserver = null;
    this.target = target;
    this.binding = binding;
    this.isBindingVolatile = isBindingVolatile;
    this.bind = bind;
    this.unbind = unbind;
    this.updateTarget = updateTarget;
    this.targetName = targetName;
  }
  /** @internal */


  handleChange() {
    this.updateTarget(this.bindingObserver.observe(this.source, this.context));
  }
  /** @internal */


  handleEvent(event) {
    setCurrentEvent(event);
    const result = this.binding(this.source, this.context);
    setCurrentEvent(null);

    if (result !== true) {
      event.preventDefault();
    }
  }

}

let sharedContext = null;

class CompilationContext {
  addFactory(factory) {
    factory.targetIndex = this.targetIndex;
    this.behaviorFactories.push(factory);
  }

  captureContentBinding(directive) {
    directive.targetAtContent();
    this.addFactory(directive);
  }

  reset() {
    this.behaviorFactories = [];
    this.targetIndex = -1;
  }

  release() {
    sharedContext = this;
  }

  static borrow(directives) {
    const shareable = sharedContext || new CompilationContext();
    shareable.directives = directives;
    shareable.reset();
    sharedContext = null;
    return shareable;
  }

}

function createAggregateBinding(parts) {
  if (parts.length === 1) {
    return parts[0];
  }

  let targetName;
  const partCount = parts.length;
  const finalParts = parts.map(x => {
    if (typeof x === "string") {
      return () => x;
    }

    targetName = x.targetName || targetName;
    return x.binding;
  });

  const binding = (scope, context) => {
    let output = "";

    for (let i = 0; i < partCount; ++i) {
      output += finalParts[i](scope, context);
    }

    return output;
  };

  const directive = new HTMLBindingDirective(binding);
  directive.targetName = targetName;
  return directive;
}

const interpolationEndLength = _interpolationEnd.length;

function parseContent(context, value) {
  const valueParts = value.split(_interpolationStart);

  if (valueParts.length === 1) {
    return null;
  }

  const bindingParts = [];

  for (let i = 0, ii = valueParts.length; i < ii; ++i) {
    const current = valueParts[i];
    const index = current.indexOf(_interpolationEnd);
    let literal;

    if (index === -1) {
      literal = current;
    } else {
      const directiveIndex = parseInt(current.substring(0, index));
      bindingParts.push(context.directives[directiveIndex]);
      literal = current.substring(index + interpolationEndLength);
    }

    if (literal !== "") {
      bindingParts.push(literal);
    }
  }

  return bindingParts;
}

function compileAttributes(context, node, includeBasicValues = false) {
  const attributes = node.attributes;

  for (let i = 0, ii = attributes.length; i < ii; ++i) {
    const attr = attributes[i];
    const attrValue = attr.value;
    const parseResult = parseContent(context, attrValue);
    let result = null;

    if (parseResult === null) {
      if (includeBasicValues) {
        result = new HTMLBindingDirective(() => attrValue);
        result.targetName = attr.name;
      }
    } else {
      result = createAggregateBinding(parseResult);
    }

    if (result !== null) {
      node.removeAttributeNode(attr);
      i--;
      ii--;
      context.addFactory(result);
    }
  }
}

function compileContent(context, node, walker) {
  const parseResult = parseContent(context, node.textContent);

  if (parseResult !== null) {
    let lastNode = node;

    for (let i = 0, ii = parseResult.length; i < ii; ++i) {
      const currentPart = parseResult[i];
      const currentNode = i === 0 ? node : lastNode.parentNode.insertBefore(document.createTextNode(""), lastNode.nextSibling);

      if (typeof currentPart === "string") {
        currentNode.textContent = currentPart;
      } else {
        currentNode.textContent = " ";
        context.captureContentBinding(currentPart);
      }

      lastNode = currentNode;
      context.targetIndex++;

      if (currentNode !== node) {
        walker.nextNode();
      }
    }

    context.targetIndex--;
  }
}
/**
 * Compiles a template and associated directives into a raw compilation
 * result which include a cloneable DocumentFragment and factories capable
 * of attaching runtime behavior to nodes within the fragment.
 * @param template - The template to compile.
 * @param directives - The directives referenced by the template.
 * @remarks
 * The template that is provided for compilation is altered in-place
 * and cannot be compiled again. If the original template must be preserved,
 * it is recommended that you clone the original and pass the clone to this API.
 * @public
 */


function compileTemplate(template, directives) {
  const fragment = template.content; // https://bugs.chromium.org/p/chromium/issues/detail?id=1111864

  document.adoptNode(fragment);
  const context = CompilationContext.borrow(directives);
  compileAttributes(context, template, true);
  const hostBehaviorFactories = context.behaviorFactories;
  context.reset();
  const walker = DOM.createTemplateWalker(fragment);
  let node;

  while (node = walker.nextNode()) {
    context.targetIndex++;

    switch (node.nodeType) {
      case 1:
        // element node
        compileAttributes(context, node);
        break;

      case 3:
        // text node
        compileContent(context, node, walker);
        break;

      case 8:
        // comment
        if (DOM.isMarker(node)) {
          context.addFactory(directives[DOM.extractDirectiveIndexFromMarker(node)]);
        }

    }
  }

  let targetOffset = 0;

  if ( // If the first node in a fragment is a marker, that means it's an unstable first node,
  // because something like a when, repeat, etc. could add nodes before the marker.
  // To mitigate this, we insert a stable first node. However, if we insert a node,
  // that will alter the result of the TreeWalker. So, we also need to offset the target index.
  DOM.isMarker(fragment.firstChild) || // Or if there is only one node and a directive, it means the template's content
  // is *only* the directive. In that case, HTMLView.dispose() misses any nodes inserted by
  // the directive. Inserting a new node ensures proper disposal of nodes added by the directive.
  fragment.childNodes.length === 1 && directives.length) {
    fragment.insertBefore(document.createComment(""), fragment.firstChild);
    targetOffset = -1;
  }

  const viewBehaviorFactories = context.behaviorFactories;
  context.release();
  return {
    fragment,
    viewBehaviorFactories,
    hostBehaviorFactories,
    targetOffset
  };
}

// A singleton Range instance used to efficiently remove ranges of DOM nodes.
// See the implementation of HTMLView below for further details.
const range = document.createRange();
/**
 * The standard View implementation, which also implements ElementView and SyntheticView.
 * @public
 */

class HTMLView {
  /**
   * Constructs an instance of HTMLView.
   * @param fragment - The html fragment that contains the nodes for this view.
   * @param behaviors - The behaviors to be applied to this view.
   */
  constructor(fragment, behaviors) {
    this.fragment = fragment;
    this.behaviors = behaviors;
    /**
     * The data that the view is bound to.
     */

    this.source = null;
    /**
     * The execution context the view is running within.
     */

    this.context = null;
    this.firstChild = fragment.firstChild;
    this.lastChild = fragment.lastChild;
  }
  /**
   * Appends the view's DOM nodes to the referenced node.
   * @param node - The parent node to append the view's DOM nodes to.
   */


  appendTo(node) {
    node.appendChild(this.fragment);
  }
  /**
   * Inserts the view's DOM nodes before the referenced node.
   * @param node - The node to insert the view's DOM before.
   */


  insertBefore(node) {
    if (this.fragment.hasChildNodes()) {
      node.parentNode.insertBefore(this.fragment, node);
    } else {
      const parentNode = node.parentNode;
      const end = this.lastChild;
      let current = this.firstChild;
      let next;

      while (current !== end) {
        next = current.nextSibling;
        parentNode.insertBefore(current, node);
        current = next;
      }

      parentNode.insertBefore(end, node);
    }
  }
  /**
   * Removes the view's DOM nodes.
   * The nodes are not disposed and the view can later be re-inserted.
   */


  remove() {
    const fragment = this.fragment;
    const end = this.lastChild;
    let current = this.firstChild;
    let next;

    while (current !== end) {
      next = current.nextSibling;
      fragment.appendChild(current);
      current = next;
    }

    fragment.appendChild(end);
  }
  /**
   * Removes the view and unbinds its behaviors, disposing of DOM nodes afterward.
   * Once a view has been disposed, it cannot be inserted or bound again.
   */


  dispose() {
    const parent = this.firstChild.parentNode;
    const end = this.lastChild;
    let current = this.firstChild;
    let next;

    while (current !== end) {
      next = current.nextSibling;
      parent.removeChild(current);
      current = next;
    }

    parent.removeChild(end);
    const behaviors = this.behaviors;
    const oldSource = this.source;

    for (let i = 0, ii = behaviors.length; i < ii; ++i) {
      behaviors[i].unbind(oldSource);
    }
  }
  /**
   * Binds a view's behaviors to its binding source.
   * @param source - The binding source for the view's binding behaviors.
   * @param context - The execution context to run the behaviors within.
   */


  bind(source, context) {
    const behaviors = this.behaviors;

    if (this.source === source) {
      return;
    } else if (this.source !== null) {
      const oldSource = this.source;
      this.source = source;
      this.context = context;

      for (let i = 0, ii = behaviors.length; i < ii; ++i) {
        const current = behaviors[i];
        current.unbind(oldSource);
        current.bind(source, context);
      }
    } else {
      this.source = source;
      this.context = context;

      for (let i = 0, ii = behaviors.length; i < ii; ++i) {
        behaviors[i].bind(source, context);
      }
    }
  }
  /**
   * Unbinds a view's behaviors from its binding source.
   */


  unbind() {
    if (this.source === null) {
      return;
    }

    const behaviors = this.behaviors;
    const oldSource = this.source;

    for (let i = 0, ii = behaviors.length; i < ii; ++i) {
      behaviors[i].unbind(oldSource);
    }

    this.source = null;
  }
  /**
   * Efficiently disposes of a contiguous range of synthetic view instances.
   * @param views - A contiguous range of views to be disposed.
   */


  static disposeContiguousBatch(views) {
    if (views.length === 0) {
      return;
    }

    range.setStartBefore(views[0].firstChild);
    range.setEndAfter(views[views.length - 1].lastChild);
    range.deleteContents();

    for (let i = 0, ii = views.length; i < ii; ++i) {
      const view = views[i];
      const behaviors = view.behaviors;
      const oldSource = view.source;

      for (let j = 0, jj = behaviors.length; j < jj; ++j) {
        behaviors[j].unbind(oldSource);
      }
    }
  }

}

/**
 * A template capable of creating HTMLView instances or rendering directly to DOM.
 * @public
 */

class ViewTemplate {
  /**
   * Creates an instance of ViewTemplate.
   * @param html - The html representing what this template will instantiate, including placeholders for directives.
   * @param directives - The directives that will be connected to placeholders in the html.
   */
  constructor(html, directives) {
    this.behaviorCount = 0;
    this.hasHostBehaviors = false;
    this.fragment = null;
    this.targetOffset = 0;
    this.viewBehaviorFactories = null;
    this.hostBehaviorFactories = null;
    this.html = html;
    this.directives = directives;
  }
  /**
   * Creates an HTMLView instance based on this template definition.
   * @param hostBindingTarget - The element that host behaviors will be bound to.
   */


  create(hostBindingTarget) {
    if (this.fragment === null) {
      let template;
      const html = this.html;

      if (typeof html === "string") {
        template = document.createElement("template");
        template.innerHTML = DOM.createHTML(html);
        const fec = template.content.firstElementChild;

        if (fec !== null && fec.tagName === "TEMPLATE") {
          template = fec;
        }
      } else {
        template = html;
      }

      const result = compileTemplate(template, this.directives);
      this.fragment = result.fragment;
      this.viewBehaviorFactories = result.viewBehaviorFactories;
      this.hostBehaviorFactories = result.hostBehaviorFactories;
      this.targetOffset = result.targetOffset;
      this.behaviorCount = this.viewBehaviorFactories.length + this.hostBehaviorFactories.length;
      this.hasHostBehaviors = this.hostBehaviorFactories.length > 0;
    }

    const fragment = this.fragment.cloneNode(true);
    const viewFactories = this.viewBehaviorFactories;
    const behaviors = new Array(this.behaviorCount);
    const walker = DOM.createTemplateWalker(fragment);
    let behaviorIndex = 0;
    let targetIndex = this.targetOffset;
    let node = walker.nextNode();

    for (let ii = viewFactories.length; behaviorIndex < ii; ++behaviorIndex) {
      const factory = viewFactories[behaviorIndex];
      const factoryIndex = factory.targetIndex;

      while (node !== null) {
        if (targetIndex === factoryIndex) {
          behaviors[behaviorIndex] = factory.createBehavior(node);
          break;
        } else {
          node = walker.nextNode();
          targetIndex++;
        }
      }
    }

    if (this.hasHostBehaviors) {
      const hostFactories = this.hostBehaviorFactories;

      for (let i = 0, ii = hostFactories.length; i < ii; ++i, ++behaviorIndex) {
        behaviors[behaviorIndex] = hostFactories[i].createBehavior(hostBindingTarget);
      }
    }

    return new HTMLView(fragment, behaviors);
  }
  /**
   * Creates an HTMLView from this template, binds it to the source, and then appends it to the host.
   * @param source - The data source to bind the template to.
   * @param host - The Element where the template will be rendered.
   * @param hostBindingTarget - An HTML element to target the host bindings at if different from the
   * host that the template is being attached to.
   */


  render(source, host, hostBindingTarget) {
    if (typeof host === "string") {
      host = document.getElementById(host);
    }

    if (hostBindingTarget === void 0) {
      hostBindingTarget = host;
    }

    const view = this.create(hostBindingTarget);
    view.bind(source, defaultExecutionContext);
    view.appendTo(host);
    return view;
  }

} // Much thanks to LitHTML for working this out!

const lastAttributeNameRegex = // eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;
/**
 * Transforms a template literal string into a renderable ViewTemplate.
 * @param strings - The string fragments that are interpolated with the values.
 * @param values - The values that are interpolated with the string fragments.
 * @remarks
 * The html helper supports interpolation of strings, numbers, binding expressions,
 * other template instances, and Directive instances.
 * @public
 */

function html(strings, ...values) {
  const directives = [];
  let html = "";

  for (let i = 0, ii = strings.length - 1; i < ii; ++i) {
    const currentString = strings[i];
    let value = values[i];
    html += currentString;

    if (value instanceof ViewTemplate) {
      const template = value;

      value = () => template;
    }

    if (typeof value === "function") {
      value = new HTMLBindingDirective(value);
    }

    if (value instanceof TargetedHTMLDirective) {
      const match = lastAttributeNameRegex.exec(currentString);

      if (match !== null) {
        value.targetName = match[2];
      }
    }

    if (value instanceof HTMLDirective) {
      // Since not all values are directives, we can't use i
      // as the index for the placeholder. Instead, we need to
      // use directives.length to get the next index.
      html += value.createPlaceholder(directives.length);
      directives.push(value);
    } else {
      html += value;
    }
  }

  html += strings[strings.length - 1];
  return new ViewTemplate(html, directives);
}

/**
 * Represents styles that can be applied to a custom element.
 * @public
 */

class ElementStyles {
  constructor() {
    this.targets = new WeakSet();
    /** @internal */

    this.behaviors = null;
  }
  /** @internal */


  addStylesTo(target) {
    this.targets.add(target);
  }
  /** @internal */


  removeStylesFrom(target) {
    this.targets.delete(target);
  }
  /** @internal */


  isAttachedTo(target) {
    return this.targets.has(target);
  }
  /**
   * Associates behaviors with this set of styles.
   * @param behaviors - The behaviors to associate.
   */


  withBehaviors(...behaviors) {
    this.behaviors = this.behaviors === null ? behaviors : this.behaviors.concat(behaviors);
    return this;
  }

}
/**
 * Create ElementStyles from ComposableStyles.
 */

ElementStyles.create = (() => {
  if (DOM.supportsAdoptedStyleSheets) {
    const styleSheetCache = new Map();
    return styles => // eslint-disable-next-line @typescript-eslint/no-use-before-define
    new AdoptedStyleSheetsStyles(styles, styleSheetCache);
  } // eslint-disable-next-line @typescript-eslint/no-use-before-define


  return styles => new StyleElementStyles(styles);
})();

function reduceStyles(styles) {
  return styles.map(x => x instanceof ElementStyles ? reduceStyles(x.styles) : [x]).reduce((prev, curr) => prev.concat(curr), []);
}

function reduceBehaviors(styles) {
  return styles.map(x => x instanceof ElementStyles ? x.behaviors : null).reduce((prev, curr) => {
    if (curr === null) {
      return prev;
    }

    if (prev === null) {
      prev = [];
    }

    return prev.concat(curr);
  }, null);
}
/**
 * https://wicg.github.io/construct-stylesheets/
 * https://developers.google.com/web/updates/2019/02/constructable-stylesheets
 *
 * @internal
 */


class AdoptedStyleSheetsStyles extends ElementStyles {
  constructor(styles, styleSheetCache) {
    super();
    this.styles = styles;
    this.styleSheetCache = styleSheetCache;
    this._styleSheets = void 0;
    this.behaviors = reduceBehaviors(styles);
  }

  get styleSheets() {
    if (this._styleSheets === void 0) {
      const styles = this.styles;
      const styleSheetCache = this.styleSheetCache;
      this._styleSheets = reduceStyles(styles).map(x => {
        if (x instanceof CSSStyleSheet) {
          return x;
        }

        let sheet = styleSheetCache.get(x);

        if (sheet === void 0) {
          sheet = new CSSStyleSheet();
          sheet.replaceSync(x);
          styleSheetCache.set(x, sheet);
        }

        return sheet;
      });
    }

    return this._styleSheets;
  }

  addStylesTo(target) {
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, ...this.styleSheets];
    super.addStylesTo(target);
  }

  removeStylesFrom(target) {
    const sourceSheets = this.styleSheets;
    target.adoptedStyleSheets = target.adoptedStyleSheets.filter(x => sourceSheets.indexOf(x) === -1);
    super.removeStylesFrom(target);
  }

}
let styleClassId = 0;

function getNextStyleClass() {
  return `fast-style-class-${++styleClassId}`;
}
/**
 * @internal
 */


class StyleElementStyles extends ElementStyles {
  constructor(styles) {
    super();
    this.styles = styles;
    this.behaviors = null;
    this.behaviors = reduceBehaviors(styles);
    this.styleSheets = reduceStyles(styles);
    this.styleClass = getNextStyleClass();
  }

  addStylesTo(target) {
    const styleSheets = this.styleSheets;
    const styleClass = this.styleClass;
    target = this.normalizeTarget(target);

    for (let i = styleSheets.length - 1; i > -1; --i) {
      const element = document.createElement("style");
      element.innerHTML = styleSheets[i];
      element.className = styleClass;
      target.prepend(element);
    }

    super.addStylesTo(target);
  }

  removeStylesFrom(target) {
    target = this.normalizeTarget(target);
    const styles = target.querySelectorAll(`.${this.styleClass}`);

    for (let i = 0, ii = styles.length; i < ii; ++i) {
      target.removeChild(styles[i]);
    }

    super.removeStylesFrom(target);
  }

  isAttachedTo(target) {
    return super.isAttachedTo(this.normalizeTarget(target));
  }

  normalizeTarget(target) {
    return target === document ? document.body : target;
  }

}

/**
 * A {@link ValueConverter} that converts to and from `boolean` values.
 * @remarks
 * Used automatically when the `boolean` {@link AttributeMode} is selected.
 * @public
 */

const booleanConverter = {
  toView(value) {
    return value ? "true" : "false";
  },

  fromView(value) {
    if (value === null || value === void 0 || value === "false" || value === false || value === 0) {
      return false;
    }

    return true;
  }

};
/**
 * A {@link ValueConverter} that converts to and from `number` values.
 * @remarks
 * This converter allows for nullable numbers, returning `null` if the
 * input was `null`, `undefined`, or `NaN`.
 * @public
 */

const nullableNumberConverter = {
  toView(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const number = value * 1;
    return isNaN(number) ? null : number.toString();
  },

  fromView(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const number = value * 1;
    return isNaN(number) ? null : number;
  }

};
/**
 * An implementation of {@link Accessor} that supports reactivity,
 * change callbacks, attribute reflection, and type conversion for
 * custom elements.
 * @public
 */

class AttributeDefinition {
  /**
   * Creates an instance of AttributeDefinition.
   * @param Owner - The class constructor that owns this attribute.
   * @param name - The name of the property associated with the attribute.
   * @param attribute - The name of the attribute in HTML.
   * @param mode - The {@link AttributeMode} that describes the behavior of this attribute.
   * @param converter - A {@link ValueConverter} that integrates with the property getter/setter
   * to convert values to and from a DOM string.
   */
  constructor(Owner, name, attribute = name.toLowerCase(), mode = "reflect", converter) {
    this.guards = new Set();
    this.Owner = Owner;
    this.name = name;
    this.attribute = attribute;
    this.mode = mode;
    this.converter = converter;
    this.fieldName = `_${name}`;
    this.callbackName = `${name}Changed`;
    this.hasCallback = this.callbackName in Owner.prototype;

    if (mode === "boolean" && converter === void 0) {
      this.converter = booleanConverter;
    }
  }
  /**
   * Sets the value of the attribute/property on the source element.
   * @param source - The source element to access.
   * @param value - The value to set the attribute/property to.
   */


  setValue(source, newValue) {
    const oldValue = source[this.fieldName];
    const converter = this.converter;

    if (converter !== void 0) {
      newValue = converter.fromView(newValue);
    }

    if (oldValue !== newValue) {
      source[this.fieldName] = newValue;
      this.tryReflectToAttribute(source);

      if (this.hasCallback) {
        source[this.callbackName](oldValue, newValue);
      }

      source.$fastController.notify(this.name);
    }
  }
  /**
   * Gets the value of the attribute/property on the source element.
   * @param source - The source element to access.
   */


  getValue(source) {
    Observable.track(source, this.name);
    return source[this.fieldName];
  }
  /** @internal */


  onAttributeChangedCallback(element, value) {
    if (this.guards.has(element)) {
      return;
    }

    this.guards.add(element);
    this.setValue(element, value);
    this.guards.delete(element);
  }

  tryReflectToAttribute(element) {
    const mode = this.mode;
    const guards = this.guards;

    if (guards.has(element) || mode === "fromView") {
      return;
    }

    DOM.queueUpdate(() => {
      guards.add(element);
      const latestValue = element[this.fieldName];

      switch (mode) {
        case "reflect":
          const converter = this.converter;
          DOM.setAttribute(element, this.attribute, converter !== void 0 ? converter.toView(latestValue) : latestValue);
          break;

        case "boolean":
          DOM.setBooleanAttribute(element, this.attribute, latestValue);
          break;
      }

      guards.delete(element);
    });
  }
  /**
   * Collects all attribute definitions associated with the owner.
   * @param Owner - The class constructor to collect attribute for.
   * @param attributeLists - Any existing attributes to collect and merge with those associated with the owner.
   * @internal
   */


  static collect(Owner, ...attributeLists) {
    const attributes = [];
    attributeLists.push(Owner.attributes);

    for (let i = 0, ii = attributeLists.length; i < ii; ++i) {
      const list = attributeLists[i];

      if (list === void 0) {
        continue;
      }

      for (let j = 0, jj = list.length; j < jj; ++j) {
        const config = list[j];

        if (typeof config === "string") {
          attributes.push(new AttributeDefinition(Owner, config));
        } else {
          attributes.push(new AttributeDefinition(Owner, config.property, config.attribute, config.mode, config.converter));
        }
      }
    }

    return attributes;
  }

}
function attr(configOrTarget, prop) {
  let config;

  function decorator($target, $prop) {
    if (arguments.length > 1) {
      // Non invocation:
      // - @attr
      // Invocation with or w/o opts:
      // - @attr()
      // - @attr({...opts})
      config.property = $prop;
    }

    const attributes = $target.constructor.attributes || ($target.constructor.attributes = []);
    attributes.push(config);
  }

  if (arguments.length > 1) {
    // Non invocation:
    // - @attr
    config = {};
    decorator(configOrTarget, prop);
    return;
  } // Invocation with or w/o opts:
  // - @attr()
  // - @attr({...opts})


  config = configOrTarget === void 0 ? {} : configOrTarget;
  return decorator;
}

const defaultShadowOptions = {
  mode: "open"
};
const defaultElementOptions = {};
const fastDefinitions = new Map();
/**
 * Defines metadata for a FASTElement.
 * @public
 */

class FASTElementDefinition {
  /**
   * Creates an instance of FASTElementDefinition.
   * @param type - The type this definition is being created for.
   * @param nameOrConfig - The name of the element to define or a config object
   * that describes the element to define.
   */
  constructor(type, nameOrConfig = type.definition) {
    if (typeof nameOrConfig === "string") {
      nameOrConfig = {
        name: nameOrConfig
      };
    }

    this.type = type;
    this.name = nameOrConfig.name;
    this.template = nameOrConfig.template;
    const attributes = AttributeDefinition.collect(type, nameOrConfig.attributes);
    const observedAttributes = new Array(attributes.length);
    const propertyLookup = {};
    const attributeLookup = {};

    for (let i = 0, ii = attributes.length; i < ii; ++i) {
      const current = attributes[i];
      observedAttributes[i] = current.attribute;
      propertyLookup[current.name] = current;
      attributeLookup[current.attribute] = current;
    }

    this.attributes = attributes;
    this.observedAttributes = observedAttributes;
    this.propertyLookup = propertyLookup;
    this.attributeLookup = attributeLookup;
    this.shadowOptions = nameOrConfig.shadowOptions === void 0 ? defaultShadowOptions : nameOrConfig.shadowOptions === null ? void 0 : Object.assign(Object.assign({}, defaultShadowOptions), nameOrConfig.shadowOptions);
    this.elementOptions = nameOrConfig.elementOptions === void 0 ? defaultElementOptions : Object.assign(Object.assign({}, defaultElementOptions), nameOrConfig.elementOptions);
    this.styles = nameOrConfig.styles === void 0 ? void 0 : Array.isArray(nameOrConfig.styles) ? ElementStyles.create(nameOrConfig.styles) : nameOrConfig.styles instanceof ElementStyles ? nameOrConfig.styles : ElementStyles.create([nameOrConfig.styles]);
  }
  /**
   * Defines a custom element based on this definition.
   * @param registry - The element registry to define the element in.
   */


  define(registry = customElements) {
    const type = this.type;

    if (!this.isDefined) {
      const attributes = this.attributes;
      const proto = type.prototype;

      for (let i = 0, ii = attributes.length; i < ii; ++i) {
        Observable.defineProperty(proto, attributes[i]);
      }

      Reflect.defineProperty(type, "observedAttributes", {
        value: this.observedAttributes,
        enumerable: true
      });
      fastDefinitions.set(type, this);
      this.isDefined = true;
    }

    if (!registry.get(this.name)) {
      registry.define(this.name, type, this.elementOptions);
    }

    return this;
  }
  /**
   * Gets the element definition associated with the specified type.
   * @param type - The custom element type to retrieve the definition for.
   */


  static forType(type) {
    return fastDefinitions.get(type);
  }

}

const shadowRoots = new WeakMap();
const defaultEventOptions = {
  bubbles: true,
  composed: true,
  cancelable: true
};

function getShadowRoot(element) {
  return element.shadowRoot || shadowRoots.get(element) || null;
}
/**
 * Controls the lifecycle and rendering of a `FASTElement`.
 * @public
 */


class Controller extends PropertyChangeNotifier {
  /**
   * Creates a Controller to control the specified element.
   * @param element - The element to be controlled by this controller.
   * @param definition - The element definition metadata that instructs this
   * controller in how to handle rendering and other platform integrations.
   * @internal
   */
  constructor(element, definition) {
    super(element);
    this.boundObservables = null;
    this.behaviors = null;
    this.needsInitialization = true;
    this._template = null;
    this._styles = null;
    this._isConnected = false;
    /**
     * The view associated with the custom element.
     * @remarks
     * If `null` then the element is managing its own rendering.
     */

    this.view = null;
    this.element = element;
    this.definition = definition;
    const shadowOptions = definition.shadowOptions;

    if (shadowOptions !== void 0) {
      const shadowRoot = element.attachShadow(shadowOptions);

      if (shadowOptions.mode === "closed") {
        shadowRoots.set(element, shadowRoot);
      }
    } // Capture any observable values that were set by the binding engine before
    // the browser upgraded the element. Then delete the property since it will
    // shadow the getter/setter that is required to make the observable operate.
    // Later, in the connect callback, we'll re-apply the values.


    const accessors = Observable.getAccessors(element);

    if (accessors.length > 0) {
      const boundObservables = this.boundObservables = Object.create(null);

      for (let i = 0, ii = accessors.length; i < ii; ++i) {
        const propertyName = accessors[i].name;
        const value = element[propertyName];

        if (value !== void 0) {
          delete element[propertyName];
          boundObservables[propertyName] = value;
        }
      }
    }
  }
  /**
   * Indicates whether or not the custom element has been
   * connected to the document.
   */


  get isConnected() {
    Observable.track(this, "isConnected");
    return this._isConnected;
  }

  setIsConnected(value) {
    this._isConnected = value;
    Observable.notify(this, "isConnected");
  }
  /**
   * Gets/sets the template used to render the component.
   * @remarks
   * This value can only be accurately read after connect but can be set at any time.
   */


  get template() {
    return this._template;
  }

  set template(value) {
    if (this._template === value) {
      return;
    }

    this._template = value;

    if (!this.needsInitialization) {
      this.renderTemplate(value);
    }
  }
  /**
   * Gets/sets the primary styles used for the component.
   * @remarks
   * This value can only be accurately read after connect but can be set at any time.
   */


  get styles() {
    return this._styles;
  }

  set styles(value) {
    if (this._styles === value) {
      return;
    }

    if (this._styles !== null) {
      this.removeStyles(this._styles);
    }

    this._styles = value;

    if (!this.needsInitialization && value !== null) {
      this.addStyles(value);
    }
  }
  /**
   * Adds styles to this element. Providing an HTMLStyleElement will attach the element instance to the shadowRoot.
   * @param styles - The styles to add.
   */


  addStyles(styles) {
    const target = getShadowRoot(this.element) || this.element.getRootNode();

    if (styles instanceof HTMLStyleElement) {
      target.prepend(styles);
    } else if (!styles.isAttachedTo(target)) {
      const sourceBehaviors = styles.behaviors;
      styles.addStylesTo(target);

      if (sourceBehaviors !== null) {
        this.addBehaviors(sourceBehaviors);
      }
    }
  }
  /**
   * Removes styles from this element. Providing an HTMLStyleElement will detach the element instance from the shadowRoot.
   * @param styles - the styles to remove.
   */


  removeStyles(styles) {
    const target = getShadowRoot(this.element) || this.element.getRootNode();

    if (styles instanceof HTMLStyleElement) {
      target.removeChild(styles);
    } else if (styles.isAttachedTo(target)) {
      const sourceBehaviors = styles.behaviors;
      styles.removeStylesFrom(target);

      if (sourceBehaviors !== null) {
        this.removeBehaviors(sourceBehaviors);
      }
    }
  }
  /**
   * Adds behaviors to this element.
   * @param behaviors - The behaviors to add.
   */


  addBehaviors(behaviors) {
    const targetBehaviors = this.behaviors || (this.behaviors = new Map());
    const length = behaviors.length;
    const behaviorsToBind = [];

    for (let i = 0; i < length; ++i) {
      const behavior = behaviors[i];

      if (targetBehaviors.has(behavior)) {
        targetBehaviors.set(behavior, targetBehaviors.get(behavior) + 1);
      } else {
        targetBehaviors.set(behavior, 1);
        behaviorsToBind.push(behavior);
      }
    }

    if (this._isConnected) {
      const element = this.element;

      for (let i = 0; i < behaviorsToBind.length; ++i) {
        behaviorsToBind[i].bind(element, defaultExecutionContext);
      }
    }
  }
  /**
   * Removes behaviors from this element.
   * @param behaviors - The behaviors to remove.
   * @param force - Forces unbinding of behaviors.
   */


  removeBehaviors(behaviors, force = false) {
    const targetBehaviors = this.behaviors;

    if (targetBehaviors === null) {
      return;
    }

    const length = behaviors.length;
    const behaviorsToUnbind = [];

    for (let i = 0; i < length; ++i) {
      const behavior = behaviors[i];

      if (targetBehaviors.has(behavior)) {
        const count = targetBehaviors.get(behavior) - 1;
        count === 0 || force ? targetBehaviors.delete(behavior) && behaviorsToUnbind.push(behavior) : targetBehaviors.set(behavior, count);
      }
    }

    if (this._isConnected) {
      const element = this.element;

      for (let i = 0; i < behaviorsToUnbind.length; ++i) {
        behaviorsToUnbind[i].unbind(element);
      }
    }
  }
  /**
   * Runs connected lifecycle behavior on the associated element.
   */


  onConnectedCallback() {
    if (this._isConnected) {
      return;
    }

    const element = this.element;

    if (this.needsInitialization) {
      this.finishInitialization();
    } else if (this.view !== null) {
      this.view.bind(element, defaultExecutionContext);
    }

    const behaviors = this.behaviors;

    if (behaviors !== null) {
      for (const [behavior] of behaviors) {
        behavior.bind(element, defaultExecutionContext);
      }
    }

    this.setIsConnected(true);
  }
  /**
   * Runs disconnected lifecycle behavior on the associated element.
   */


  onDisconnectedCallback() {
    if (!this._isConnected) {
      return;
    }

    this.setIsConnected(false);
    const view = this.view;

    if (view !== null) {
      view.unbind();
    }

    const behaviors = this.behaviors;

    if (behaviors !== null) {
      const element = this.element;

      for (const [behavior] of behaviors) {
        behavior.unbind(element);
      }
    }
  }
  /**
   * Runs the attribute changed callback for the associated element.
   * @param name - The name of the attribute that changed.
   * @param oldValue - The previous value of the attribute.
   * @param newValue - The new value of the attribute.
   */


  onAttributeChangedCallback(name, oldValue, newValue) {
    const attrDef = this.definition.attributeLookup[name];

    if (attrDef !== void 0) {
      attrDef.onAttributeChangedCallback(this.element, newValue);
    }
  }
  /**
   * Emits a custom HTML event.
   * @param type - The type name of the event.
   * @param detail - The event detail object to send with the event.
   * @param options - The event options. By default bubbles and composed.
   * @remarks
   * Only emits events if connected.
   */


  emit(type, detail, options) {
    if (this._isConnected) {
      return this.element.dispatchEvent(new CustomEvent(type, Object.assign(Object.assign({
        detail
      }, defaultEventOptions), options)));
    }

    return false;
  }

  finishInitialization() {
    const element = this.element;
    const boundObservables = this.boundObservables; // If we have any observables that were bound, re-apply their values.

    if (boundObservables !== null) {
      const propertyNames = Object.keys(boundObservables);

      for (let i = 0, ii = propertyNames.length; i < ii; ++i) {
        const propertyName = propertyNames[i];
        element[propertyName] = boundObservables[propertyName];
      }

      this.boundObservables = null;
    }

    const definition = this.definition; // 1. Template overrides take top precedence.

    if (this._template === null) {
      if (this.element.resolveTemplate) {
        // 2. Allow for element instance overrides next.
        this._template = this.element.resolveTemplate();
      } else if (definition.template) {
        // 3. Default to the static definition.
        this._template = definition.template || null;
      }
    } // If we have a template after the above process, render it.
    // If there's no template, then the element author has opted into
    // custom rendering and they will managed the shadow root's content themselves.


    if (this._template !== null) {
      this.renderTemplate(this._template);
    } // 1. Styles overrides take top precedence.


    if (this._styles === null) {
      if (this.element.resolveStyles) {
        // 2. Allow for element instance overrides next.
        this._styles = this.element.resolveStyles();
      } else if (definition.styles) {
        // 3. Default to the static definition.
        this._styles = definition.styles || null;
      }
    } // If we have styles after the above process, add them.


    if (this._styles !== null) {
      this.addStyles(this._styles);
    }

    this.needsInitialization = false;
  }

  renderTemplate(template) {
    const element = this.element; // When getting the host to render to, we start by looking
    // up the shadow root. If there isn't one, then that means
    // we're doing a Light DOM render to the element's direct children.

    const host = getShadowRoot(element) || element;

    if (this.view !== null) {
      // If there's already a view, we need to unbind and remove through dispose.
      this.view.dispose();
      this.view = null;
    } else if (!this.needsInitialization) {
      // If there was previous custom rendering, we need to clear out the host.
      DOM.removeChildNodes(host);
    }

    if (template) {
      // If a new template was provided, render it.
      this.view = template.render(element, host, element);
    }
  }
  /**
   * Locates or creates a controller for the specified element.
   * @param element - The element to return the controller for.
   * @remarks
   * The specified element must have a {@link FASTElementDefinition}
   * registered either through the use of the {@link customElement}
   * decorator or a call to `FASTElement.define`.
   */


  static forCustomElement(element) {
    const controller = element.$fastController;

    if (controller !== void 0) {
      return controller;
    }

    const definition = FASTElementDefinition.forType(element.constructor);

    if (definition === void 0) {
      throw new Error("Missing FASTElement definition.");
    }

    return element.$fastController = new Controller(element, definition);
  }

}

/* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */

function createFASTElement(BaseType) {
  return class extends BaseType {
    constructor() {
      /* eslint-disable-next-line */
      super();
      Controller.forCustomElement(this);
    }

    $emit(type, detail, options) {
      return this.$fastController.emit(type, detail, options);
    }

    connectedCallback() {
      this.$fastController.onConnectedCallback();
    }

    disconnectedCallback() {
      this.$fastController.onDisconnectedCallback();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      this.$fastController.onAttributeChangedCallback(name, oldValue, newValue);
    }

  };
}
/**
 * A minimal base class for FASTElements that also provides
 * static helpers for working with FASTElements.
 * @public
 */


const FASTElement = Object.assign(createFASTElement(HTMLElement), {
  /**
   * Creates a new FASTElement base class inherited from the
   * provided base type.
   * @param BaseType - The base element type to inherit from.
   */
  from(BaseType) {
    return createFASTElement(BaseType);
  },

  /**
   * Defines a platform custom element based on the provided type and definition.
   * @param type - The custom element type to define.
   * @param nameOrDef - The name of the element to define or a definition object
   * that describes the element to define.
   */
  define(type, nameOrDef) {
    return new FASTElementDefinition(type, nameOrDef).define().type;
  }

});

/**
 * Directive for use in {@link css}.
 *
 * @public
 */
class CSSDirective {
  /**
   * Creates a CSS fragment to interpolate into the CSS document.
   * @returns - the string to interpolate into CSS
   */
  createCSS() {
    return "";
  }
  /**
   * Creates a behavior to bind to the host element.
   * @returns - the behavior to bind to the host element, or undefined.
   */


  createBehavior() {
    return undefined;
  }

}

function collectStyles(strings, values) {
  const styles = [];
  let cssString = "";
  const behaviors = [];

  for (let i = 0, ii = strings.length - 1; i < ii; ++i) {
    cssString += strings[i];
    let value = values[i];

    if (value instanceof CSSDirective) {
      const behavior = value.createBehavior();
      value = value.createCSS();

      if (behavior) {
        behaviors.push(behavior);
      }
    }

    if (value instanceof ElementStyles || value instanceof CSSStyleSheet) {
      if (cssString.trim() !== "") {
        styles.push(cssString);
        cssString = "";
      }

      styles.push(value);
    } else {
      cssString += value;
    }
  }

  cssString += strings[strings.length - 1];

  if (cssString.trim() !== "") {
    styles.push(cssString);
  }

  return {
    styles,
    behaviors
  };
}
/**
 * Transforms a template literal string into styles.
 * @param strings - The string fragments that are interpolated with the values.
 * @param values - The values that are interpolated with the string fragments.
 * @remarks
 * The css helper supports interpolation of strings and ElementStyle instances.
 * @public
 */


function css(strings, ...values) {
  const {
    styles,
    behaviors
  } = collectStyles(strings, values);
  const elementStyles = ElementStyles.create(styles);

  if (behaviors.length) {
    elementStyles.withBehaviors(...behaviors);
  }

  return elementStyles;
}

class CSSPartial extends CSSDirective {
  constructor(styles, behaviors) {
    super();
    this.behaviors = behaviors;
    this.css = "";
    const stylesheets = styles.reduce((accumulated, current) => {
      if (typeof current === "string") {
        this.css += current;
      } else {
        accumulated.push(current);
      }

      return accumulated;
    }, []);

    if (stylesheets.length) {
      this.styles = ElementStyles.create(stylesheets);
    }
  }

  createBehavior() {
    return this;
  }

  createCSS() {
    return this.css;
  }

  bind(el) {
    if (this.styles) {
      el.$fastController.addStyles(this.styles);
    }

    if (this.behaviors.length) {
      el.$fastController.addBehaviors(this.behaviors);
    }
  }

  unbind(el) {
    if (this.styles) {
      el.$fastController.removeStyles(this.styles);
    }

    if (this.behaviors.length) {
      el.$fastController.removeBehaviors(this.behaviors);
    }
  }

}
/**
 * Transforms a template literal string into partial CSS.
 * @param strings - The string fragments that are interpolated with the values.
 * @param values - The values that are interpolated with the string fragments.
 * @public
 */


function cssPartial(strings, ...values) {
  const {
    styles,
    behaviors
  } = collectStyles(strings, values);
  return new CSSPartial(styles, behaviors);
}

/** @internal */

function newSplice(index, removed, addedCount) {
  return {
    index: index,
    removed: removed,
    addedCount: addedCount
  };
}
const EDIT_LEAVE = 0;
const EDIT_UPDATE = 1;
const EDIT_ADD = 2;
const EDIT_DELETE = 3; // Note: This function is *based* on the computation of the Levenshtein
// "edit" distance. The one change is that "updates" are treated as two
// edits - not one. With Array splices, an update is really a delete
// followed by an add. By retaining this, we optimize for "keeping" the
// maximum array items in the original array. For example:
//
//   'xxxx123' -> '123yyyy'
//
// With 1-edit updates, the shortest path would be just to update all seven
// characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
// leaves the substring '123' intact.

function calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd) {
  // "Deletion" columns
  const rowCount = oldEnd - oldStart + 1;
  const columnCount = currentEnd - currentStart + 1;
  const distances = new Array(rowCount);
  let north;
  let west; // "Addition" rows. Initialize null column.

  for (let i = 0; i < rowCount; ++i) {
    distances[i] = new Array(columnCount);
    distances[i][0] = i;
  } // Initialize null row


  for (let j = 0; j < columnCount; ++j) {
    distances[0][j] = j;
  }

  for (let i = 1; i < rowCount; ++i) {
    for (let j = 1; j < columnCount; ++j) {
      if (current[currentStart + j - 1] === old[oldStart + i - 1]) {
        distances[i][j] = distances[i - 1][j - 1];
      } else {
        north = distances[i - 1][j] + 1;
        west = distances[i][j - 1] + 1;
        distances[i][j] = north < west ? north : west;
      }
    }
  }

  return distances;
} // This starts at the final weight, and walks "backward" by finding
// the minimum previous weight recursively until the origin of the weight
// matrix.


function spliceOperationsFromEditDistances(distances) {
  let i = distances.length - 1;
  let j = distances[0].length - 1;
  let current = distances[i][j];
  const edits = [];

  while (i > 0 || j > 0) {
    if (i === 0) {
      edits.push(EDIT_ADD);
      j--;
      continue;
    }

    if (j === 0) {
      edits.push(EDIT_DELETE);
      i--;
      continue;
    }

    const northWest = distances[i - 1][j - 1];
    const west = distances[i - 1][j];
    const north = distances[i][j - 1];
    let min;

    if (west < north) {
      min = west < northWest ? west : northWest;
    } else {
      min = north < northWest ? north : northWest;
    }

    if (min === northWest) {
      if (northWest === current) {
        edits.push(EDIT_LEAVE);
      } else {
        edits.push(EDIT_UPDATE);
        current = northWest;
      }

      i--;
      j--;
    } else if (min === west) {
      edits.push(EDIT_DELETE);
      i--;
      current = west;
    } else {
      edits.push(EDIT_ADD);
      j--;
      current = north;
    }
  }

  edits.reverse();
  return edits;
}

function sharedPrefix(current, old, searchLength) {
  for (let i = 0; i < searchLength; ++i) {
    if (current[i] !== old[i]) {
      return i;
    }
  }

  return searchLength;
}

function sharedSuffix(current, old, searchLength) {
  let index1 = current.length;
  let index2 = old.length;
  let count = 0;

  while (count < searchLength && current[--index1] === old[--index2]) {
    count++;
  }

  return count;
}

function intersect(start1, end1, start2, end2) {
  // Disjoint
  if (end1 < start2 || end2 < start1) {
    return -1;
  } // Adjacent


  if (end1 === start2 || end2 === start1) {
    return 0;
  } // Non-zero intersect, span1 first


  if (start1 < start2) {
    if (end1 < end2) {
      return end1 - start2; // Overlap
    }

    return end2 - start2; // Contained
  } // Non-zero intersect, span2 first


  if (end2 < end1) {
    return end2 - start1; // Overlap
  }

  return end1 - start1; // Contained
}
/**
 * Splice Projection functions:
 *
 * A splice map is a representation of how a previous array of items
 * was transformed into a new array of items. Conceptually it is a list of
 * tuples of
 *
 *   <index, removed, addedCount>
 *
 * which are kept in ascending index order of. The tuple represents that at
 * the |index|, |removed| sequence of items were removed, and counting forward
 * from |index|, |addedCount| items were added.
 */

/**
 * @internal
 * @remarks
 * Lacking individual splice mutation information, the minimal set of
 * splices can be synthesized given the previous state and final state of an
 * array. The basic approach is to calculate the edit distance matrix and
 * choose the shortest path through it.
 *
 * Complexity: O(l * p)
 *   l: The length of the current array
 *   p: The length of the old array
 */


function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
  let prefixCount = 0;
  let suffixCount = 0;
  const minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);

  if (currentStart === 0 && oldStart === 0) {
    prefixCount = sharedPrefix(current, old, minLength);
  }

  if (currentEnd === current.length && oldEnd === old.length) {
    suffixCount = sharedSuffix(current, old, minLength - prefixCount);
  }

  currentStart += prefixCount;
  oldStart += prefixCount;
  currentEnd -= suffixCount;
  oldEnd -= suffixCount;

  if (currentEnd - currentStart === 0 && oldEnd - oldStart === 0) {
    return emptyArray;
  }

  if (currentStart === currentEnd) {
    const splice = newSplice(currentStart, [], 0);

    while (oldStart < oldEnd) {
      splice.removed.push(old[oldStart++]);
    }

    return [splice];
  } else if (oldStart === oldEnd) {
    return [newSplice(currentStart, [], currentEnd - currentStart)];
  }

  const ops = spliceOperationsFromEditDistances(calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));
  const splices = [];
  let splice = void 0;
  let index = currentStart;
  let oldIndex = oldStart;

  for (let i = 0; i < ops.length; ++i) {
    switch (ops[i]) {
      case EDIT_LEAVE:
        if (splice !== void 0) {
          splices.push(splice);
          splice = void 0;
        }

        index++;
        oldIndex++;
        break;

      case EDIT_UPDATE:
        if (splice === void 0) {
          splice = newSplice(index, [], 0);
        }

        splice.addedCount++;
        index++;
        splice.removed.push(old[oldIndex]);
        oldIndex++;
        break;

      case EDIT_ADD:
        if (splice === void 0) {
          splice = newSplice(index, [], 0);
        }

        splice.addedCount++;
        index++;
        break;

      case EDIT_DELETE:
        if (splice === void 0) {
          splice = newSplice(index, [], 0);
        }

        splice.removed.push(old[oldIndex]);
        oldIndex++;
        break;
      // no default
    }
  }

  if (splice !== void 0) {
    splices.push(splice);
  }

  return splices;
}
const $push = Array.prototype.push;

function mergeSplice(splices, index, removed, addedCount) {
  const splice = newSplice(index, removed, addedCount);
  let inserted = false;
  let insertionOffset = 0;

  for (let i = 0; i < splices.length; i++) {
    const current = splices[i];
    current.index += insertionOffset;

    if (inserted) {
      continue;
    }

    const intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);

    if (intersectCount >= 0) {
      // Merge the two splices
      splices.splice(i, 1);
      i--;
      insertionOffset -= current.addedCount - current.removed.length;
      splice.addedCount += current.addedCount - intersectCount;
      const deleteCount = splice.removed.length + current.removed.length - intersectCount;

      if (!splice.addedCount && !deleteCount) {
        // merged splice is a noop. discard.
        inserted = true;
      } else {
        let currentRemoved = current.removed;

        if (splice.index < current.index) {
          // some prefix of splice.removed is prepended to current.removed.
          const prepend = splice.removed.slice(0, current.index - splice.index);
          $push.apply(prepend, currentRemoved);
          currentRemoved = prepend;
        }

        if (splice.index + splice.removed.length > current.index + current.addedCount) {
          // some suffix of splice.removed is appended to current.removed.
          const append = splice.removed.slice(current.index + current.addedCount - splice.index);
          $push.apply(currentRemoved, append);
        }

        splice.removed = currentRemoved;

        if (current.index < splice.index) {
          splice.index = current.index;
        }
      }
    } else if (splice.index < current.index) {
      // Insert splice here.
      inserted = true;
      splices.splice(i, 0, splice);
      i++;
      const offset = splice.addedCount - splice.removed.length;
      current.index += offset;
      insertionOffset += offset;
    }
  }

  if (!inserted) {
    splices.push(splice);
  }
}

function createInitialSplices(changeRecords) {
  const splices = [];

  for (let i = 0, ii = changeRecords.length; i < ii; i++) {
    const record = changeRecords[i];
    mergeSplice(splices, record.index, record.removed, record.addedCount);
  }

  return splices;
}
/** @internal */


function projectArraySplices(array, changeRecords) {
  let splices = [];
  const initialSplices = createInitialSplices(changeRecords);

  for (let i = 0, ii = initialSplices.length; i < ii; ++i) {
    const splice = initialSplices[i];

    if (splice.addedCount === 1 && splice.removed.length === 1) {
      if (splice.removed[0] !== array[splice.index]) {
        splices.push(splice);
      }

      continue;
    }

    splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length));
  }

  return splices;
}

let arrayObservationEnabled = false;

function adjustIndex(changeRecord, array) {
  let index = changeRecord.index;
  const arrayLength = array.length;

  if (index > arrayLength) {
    index = arrayLength - changeRecord.addedCount;
  } else if (index < 0) {
    index = arrayLength + changeRecord.removed.length + index - changeRecord.addedCount;
  }

  if (index < 0) {
    index = 0;
  }

  changeRecord.index = index;
  return changeRecord;
}

class ArrayObserver extends SubscriberSet {
  constructor(source) {
    super(source);
    this.oldCollection = void 0;
    this.splices = void 0;
    this.needsQueue = true;
    this.call = this.flush;
    source.$fastController = this;
  }

  addSplice(splice) {
    if (this.splices === void 0) {
      this.splices = [splice];
    } else {
      this.splices.push(splice);
    }

    if (this.needsQueue) {
      this.needsQueue = false;
      DOM.queueUpdate(this);
    }
  }

  reset(oldCollection) {
    this.oldCollection = oldCollection;

    if (this.needsQueue) {
      this.needsQueue = false;
      DOM.queueUpdate(this);
    }
  }

  flush() {
    const splices = this.splices;
    const oldCollection = this.oldCollection;

    if (splices === void 0 && oldCollection === void 0) {
      return;
    }

    this.needsQueue = true;
    this.splices = void 0;
    this.oldCollection = void 0;
    const finalSplices = oldCollection === void 0 ? projectArraySplices(this.source, splices) : calcSplices(this.source, 0, this.source.length, oldCollection, 0, oldCollection.length);
    this.notify(finalSplices);
  }

}
/* eslint-disable prefer-rest-params */

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/**
 * Enables the array observation mechanism.
 * @remarks
 * Array observation is enabled automatically when using the
 * {@link RepeatDirective}, so calling this API manually is
 * not typically necessary.
 * @public
 */


function enableArrayObservation() {
  if (arrayObservationEnabled) {
    return;
  }

  arrayObservationEnabled = true;
  Observable.setArrayObserverFactory(collection => {
    return new ArrayObserver(collection);
  });
  const arrayProto = Array.prototype;
  const pop = arrayProto.pop;
  const push = arrayProto.push;
  const reverse = arrayProto.reverse;
  const shift = arrayProto.shift;
  const sort = arrayProto.sort;
  const splice = arrayProto.splice;
  const unshift = arrayProto.unshift;

  arrayProto.pop = function () {
    const notEmpty = this.length > 0;
    const methodCallResult = pop.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0 && notEmpty) {
      o.addSplice(newSplice(this.length, [methodCallResult], 0));
    }

    return methodCallResult;
  };

  arrayProto.push = function () {
    const methodCallResult = push.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0) {
      o.addSplice(adjustIndex(newSplice(this.length - arguments.length, [], arguments.length), this));
    }

    return methodCallResult;
  };

  arrayProto.reverse = function () {
    let oldArray;
    const o = this.$fastController;

    if (o !== void 0) {
      o.flush();
      oldArray = this.slice();
    }

    const methodCallResult = reverse.apply(this, arguments);

    if (o !== void 0) {
      o.reset(oldArray);
    }

    return methodCallResult;
  };

  arrayProto.shift = function () {
    const notEmpty = this.length > 0;
    const methodCallResult = shift.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0 && notEmpty) {
      o.addSplice(newSplice(0, [methodCallResult], 0));
    }

    return methodCallResult;
  };

  arrayProto.sort = function () {
    let oldArray;
    const o = this.$fastController;

    if (o !== void 0) {
      o.flush();
      oldArray = this.slice();
    }

    const methodCallResult = sort.apply(this, arguments);

    if (o !== void 0) {
      o.reset(oldArray);
    }

    return methodCallResult;
  };

  arrayProto.splice = function () {
    const methodCallResult = splice.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0) {
      o.addSplice(adjustIndex(newSplice(+arguments[0], methodCallResult, arguments.length > 2 ? arguments.length - 2 : 0), this));
    }

    return methodCallResult;
  };

  arrayProto.unshift = function () {
    const methodCallResult = unshift.apply(this, arguments);
    const o = this.$fastController;

    if (o !== void 0) {
      o.addSplice(adjustIndex(newSplice(0, [], arguments.length), this));
    }

    return methodCallResult;
  };
}
/* eslint-enable prefer-rest-params */

/* eslint-enable @typescript-eslint/explicit-function-return-type */

/**
 * The runtime behavior for template references.
 * @public
 */

class RefBehavior {
  /**
   * Creates an instance of RefBehavior.
   * @param target - The element to reference.
   * @param propertyName - The name of the property to assign the reference to.
   */
  constructor(target, propertyName) {
    this.target = target;
    this.propertyName = propertyName;
  }
  /**
   * Bind this behavior to the source.
   * @param source - The source to bind to.
   * @param context - The execution context that the binding is operating within.
   */


  bind(source) {
    source[this.propertyName] = this.target;
  }
  /**
   * Unbinds this behavior from the source.
   * @param source - The source to unbind from.
   */

  /* eslint-disable-next-line @typescript-eslint/no-empty-function */


  unbind() {}

}
/**
 * A directive that observes the updates a property with a reference to the element.
 * @param propertyName - The name of the property to assign the reference to.
 * @public
 */

function ref(propertyName) {
  return new AttachedBehaviorHTMLDirective("fast-ref", RefBehavior, propertyName);
}

/**
 * A directive that enables basic conditional rendering in a template.
 * @param binding - The condition to test for rendering.
 * @param templateOrTemplateBinding - The template or a binding that gets
 * the template to render when the condition is true.
 * @public
 */
function when(binding, templateOrTemplateBinding) {
  const getTemplate = typeof templateOrTemplateBinding === "function" ? templateOrTemplateBinding : () => templateOrTemplateBinding;
  return (source, context) => binding(source, context) ? getTemplate(source, context) : null;
}

Object.freeze({
  positioning: false
});

function bindWithoutPositioning(view, items, index, context) {
  view.bind(items[index], context);
}

function bindWithPositioning(view, items, index, context) {
  const childContext = Object.create(context);
  childContext.index = index;
  childContext.length = items.length;
  view.bind(items[index], childContext);
}
/**
 * A behavior that renders a template for each item in an array.
 * @public
 */


class RepeatBehavior {
  /**
   * Creates an instance of RepeatBehavior.
   * @param location - The location in the DOM to render the repeat.
   * @param itemsBinding - The array to render.
   * @param isItemsBindingVolatile - Indicates whether the items binding has volatile dependencies.
   * @param templateBinding - The template to render for each item.
   * @param isTemplateBindingVolatile - Indicates whether the template binding has volatile dependencies.
   * @param options - Options used to turn on special repeat features.
   */
  constructor(location, itemsBinding, isItemsBindingVolatile, templateBinding, isTemplateBindingVolatile, options) {
    this.location = location;
    this.itemsBinding = itemsBinding;
    this.templateBinding = templateBinding;
    this.options = options;
    this.source = null;
    this.views = [];
    this.items = null;
    this.itemsObserver = null;
    this.originalContext = void 0;
    this.childContext = void 0;
    this.bindView = bindWithoutPositioning;
    this.itemsBindingObserver = Observable.binding(itemsBinding, this, isItemsBindingVolatile);
    this.templateBindingObserver = Observable.binding(templateBinding, this, isTemplateBindingVolatile);

    if (options.positioning) {
      this.bindView = bindWithPositioning;
    }
  }
  /**
   * Bind this behavior to the source.
   * @param source - The source to bind to.
   * @param context - The execution context that the binding is operating within.
   */


  bind(source, context) {
    this.source = source;
    this.originalContext = context;
    this.childContext = Object.create(context);
    this.childContext.parent = source;
    this.childContext.parentContext = this.originalContext;
    this.items = this.itemsBindingObserver.observe(source, this.originalContext);
    this.template = this.templateBindingObserver.observe(source, this.originalContext);
    this.observeItems(true);
    this.refreshAllViews();
  }
  /**
   * Unbinds this behavior from the source.
   * @param source - The source to unbind from.
   */


  unbind() {
    this.source = null;
    this.items = null;

    if (this.itemsObserver !== null) {
      this.itemsObserver.unsubscribe(this);
    }

    this.unbindAllViews();
    this.itemsBindingObserver.disconnect();
    this.templateBindingObserver.disconnect();
  }
  /** @internal */


  handleChange(source, args) {
    if (source === this.itemsBinding) {
      this.items = this.itemsBindingObserver.observe(this.source, this.originalContext);
      this.observeItems();
      this.refreshAllViews();
    } else if (source === this.templateBinding) {
      this.template = this.templateBindingObserver.observe(this.source, this.originalContext);
      this.refreshAllViews(true);
    } else {
      this.updateViews(args);
    }
  }

  observeItems(force = false) {
    if (!this.items) {
      this.items = emptyArray;
      return;
    }

    const oldObserver = this.itemsObserver;
    const newObserver = this.itemsObserver = Observable.getNotifier(this.items);
    const hasNewObserver = oldObserver !== newObserver;

    if (hasNewObserver && oldObserver !== null) {
      oldObserver.unsubscribe(this);
    }

    if (hasNewObserver || force) {
      newObserver.subscribe(this);
    }
  }

  updateViews(splices) {
    const childContext = this.childContext;
    const views = this.views;
    const totalRemoved = [];
    const bindView = this.bindView;
    let removeDelta = 0;

    for (let i = 0, ii = splices.length; i < ii; ++i) {
      const splice = splices[i];
      const removed = splice.removed;
      totalRemoved.push(...views.splice(splice.index + removeDelta, removed.length));
      removeDelta -= splice.addedCount;
    }

    const items = this.items;
    const template = this.template;

    for (let i = 0, ii = splices.length; i < ii; ++i) {
      const splice = splices[i];
      let addIndex = splice.index;
      const end = addIndex + splice.addedCount;

      for (; addIndex < end; ++addIndex) {
        const neighbor = views[addIndex];
        const location = neighbor ? neighbor.firstChild : this.location;
        const view = totalRemoved.length > 0 ? totalRemoved.shift() : template.create();
        views.splice(addIndex, 0, view);
        bindView(view, items, addIndex, childContext);
        view.insertBefore(location);
      }
    }

    for (let i = 0, ii = totalRemoved.length; i < ii; ++i) {
      totalRemoved[i].dispose();
    }

    if (this.options.positioning) {
      for (let i = 0, ii = views.length; i < ii; ++i) {
        const currentContext = views[i].context;
        currentContext.length = ii;
        currentContext.index = i;
      }
    }
  }

  refreshAllViews(templateChanged = false) {
    const items = this.items;
    const childContext = this.childContext;
    const template = this.template;
    const location = this.location;
    const bindView = this.bindView;
    let itemsLength = items.length;
    let views = this.views;
    let viewsLength = views.length;

    if (itemsLength === 0 || templateChanged) {
      // all views need to be removed
      HTMLView.disposeContiguousBatch(views);
      viewsLength = 0;
    }

    if (viewsLength === 0) {
      // all views need to be created
      this.views = views = new Array(itemsLength);

      for (let i = 0; i < itemsLength; ++i) {
        const view = template.create();
        bindView(view, items, i, childContext);
        views[i] = view;
        view.insertBefore(location);
      }
    } else {
      // attempt to reuse existing views with new data
      let i = 0;

      for (; i < itemsLength; ++i) {
        if (i < viewsLength) {
          const view = views[i];
          bindView(view, items, i, childContext);
        } else {
          const view = template.create();
          bindView(view, items, i, childContext);
          views.push(view);
          view.insertBefore(location);
        }
      }

      const removed = views.splice(i, viewsLength - i);

      for (i = 0, itemsLength = removed.length; i < itemsLength; ++i) {
        removed[i].dispose();
      }
    }
  }

  unbindAllViews() {
    const views = this.views;

    for (let i = 0, ii = views.length; i < ii; ++i) {
      views[i].unbind();
    }
  }

}
/**
 * A directive that configures list rendering.
 * @public
 */

class RepeatDirective extends HTMLDirective {
  /**
   * Creates an instance of RepeatDirective.
   * @param itemsBinding - The binding that provides the array to render.
   * @param templateBinding - The template binding used to obtain a template to render for each item in the array.
   * @param options - Options used to turn on special repeat features.
   */
  constructor(itemsBinding, templateBinding, options) {
    super();
    this.itemsBinding = itemsBinding;
    this.templateBinding = templateBinding;
    this.options = options;
    /**
     * Creates a placeholder string based on the directive's index within the template.
     * @param index - The index of the directive within the template.
     */

    this.createPlaceholder = DOM.createBlockPlaceholder;
    enableArrayObservation();
    this.isItemsBindingVolatile = Observable.isVolatileBinding(itemsBinding);
    this.isTemplateBindingVolatile = Observable.isVolatileBinding(templateBinding);
  }
  /**
   * Creates a behavior for the provided target node.
   * @param target - The node instance to create the behavior for.
   */


  createBehavior(target) {
    return new RepeatBehavior(target, this.itemsBinding, this.isItemsBindingVolatile, this.templateBinding, this.isTemplateBindingVolatile, this.options);
  }

}

/**
 * Creates a function that can be used to filter a Node array, selecting only elements.
 * @param selector - An optional selector to restrict the filter to.
 * @public
 */

function elements(selector) {
  if (selector) {
    return function (value, index, array) {
      return value.nodeType === 1 && value.matches(selector);
    };
  }

  return function (value, index, array) {
    return value.nodeType === 1;
  };
}
/**
 * A base class for node observation.
 * @internal
 */

class NodeObservationBehavior {
  /**
   * Creates an instance of NodeObservationBehavior.
   * @param target - The target to assign the nodes property on.
   * @param options - The options to use in configuring node observation.
   */
  constructor(target, options) {
    this.target = target;
    this.options = options;
    this.source = null;
  }
  /**
   * Bind this behavior to the source.
   * @param source - The source to bind to.
   * @param context - The execution context that the binding is operating within.
   */


  bind(source) {
    const name = this.options.property;
    this.shouldUpdate = Observable.getAccessors(source).some(x => x.name === name);
    this.source = source;
    this.updateTarget(this.computeNodes());

    if (this.shouldUpdate) {
      this.observe();
    }
  }
  /**
   * Unbinds this behavior from the source.
   * @param source - The source to unbind from.
   */


  unbind() {
    this.updateTarget(emptyArray);
    this.source = null;

    if (this.shouldUpdate) {
      this.disconnect();
    }
  }
  /** @internal */


  handleEvent() {
    this.updateTarget(this.computeNodes());
  }

  computeNodes() {
    let nodes = this.getNodes();

    if (this.options.filter !== void 0) {
      nodes = nodes.filter(this.options.filter);
    }

    return nodes;
  }

  updateTarget(value) {
    this.source[this.options.property] = value;
  }

}

/**
 * The runtime behavior for slotted node observation.
 * @public
 */

class SlottedBehavior extends NodeObservationBehavior {
  /**
   * Creates an instance of SlottedBehavior.
   * @param target - The slot element target to observe.
   * @param options - The options to use when observing the slot.
   */
  constructor(target, options) {
    super(target, options);
  }
  /**
   * Begins observation of the nodes.
   */


  observe() {
    this.target.addEventListener("slotchange", this);
  }
  /**
   * Disconnects observation of the nodes.
   */


  disconnect() {
    this.target.removeEventListener("slotchange", this);
  }
  /**
   * Retrieves the nodes that should be assigned to the target.
   */


  getNodes() {
    return this.target.assignedNodes(this.options);
  }

}
/**
 * A directive that observes the `assignedNodes()` of a slot and updates a property
 * whenever they change.
 * @param propertyOrOptions - The options used to configure slotted node observation.
 * @public
 */

function slotted(propertyOrOptions) {
  if (typeof propertyOrOptions === "string") {
    propertyOrOptions = {
      property: propertyOrOptions
    };
  }

  return new AttachedBehaviorHTMLDirective("fast-slotted", SlottedBehavior, propertyOrOptions);
}

/**
 * The runtime behavior for child node observation.
 * @public
 */

class ChildrenBehavior extends NodeObservationBehavior {
  /**
   * Creates an instance of ChildrenBehavior.
   * @param target - The element target to observe children on.
   * @param options - The options to use when observing the element children.
   */
  constructor(target, options) {
    super(target, options);
    this.observer = null;
    options.childList = true;
  }
  /**
   * Begins observation of the nodes.
   */


  observe() {
    if (this.observer === null) {
      this.observer = new MutationObserver(this.handleEvent.bind(this));
    }

    this.observer.observe(this.target, this.options);
  }
  /**
   * Disconnects observation of the nodes.
   */


  disconnect() {
    this.observer.disconnect();
  }
  /**
   * Retrieves the nodes that should be assigned to the target.
   */


  getNodes() {
    if ("subtree" in this.options) {
      return Array.from(this.target.querySelectorAll(this.options.selector));
    }

    return Array.from(this.target.childNodes);
  }

}
/**
 * A directive that observes the `childNodes` of an element and updates a property
 * whenever they change.
 * @param propertyOrOptions - The options used to configure child node observation.
 * @public
 */

function children(propertyOrOptions) {
  if (typeof propertyOrOptions === "string") {
    propertyOrOptions = {
      property: propertyOrOptions
    };
  }

  return new AttachedBehaviorHTMLDirective("fast-children", ChildrenBehavior, propertyOrOptions);
}

/**
 * A mixin class implementing start and end elements.
 * These are generally used to decorate text elements with icons or other visual indicators.
 * @public
 */

class StartEnd {
  handleStartContentChange() {
    this.startContainer.classList.toggle("start", this.start.assignedNodes().length > 0);
  }

  handleEndContentChange() {
    this.endContainer.classList.toggle("end", this.end.assignedNodes().length > 0);
  }

}
/**
 * The template for the end element.
 * For use with {@link StartEnd}
 *
 * @public
 */

const endTemplate = html`<span part="end" ${ref("endContainer")}><slot name="end" ${ref("end")}@slotchange="${x => x.handleEndContentChange()}"></slot></span>`;
/**
 * The template for the start element.
 * For use with {@link StartEnd}
 *
 * @public
 */

const startTemplate = html`<span part="start" ${ref("startContainer")}><slot name="start" ${ref("start")}@slotchange="${x => x.handleStartContentChange()}"></slot></span>`;

/**
 * The template for the {@link @microsoft/fast-foundation#(AccordionItem:class)} component.
 * @public
 */

const accordionItemTemplate = (context, definition) => html`<template class="${x => x.expanded ? "expanded" : ""}" slot="item"><div class="heading" part="heading" role="heading" aria-level="${x => x.headinglevel}"><button class="button" part="button" ${ref("expandbutton")}aria-expanded="${x => x.expanded}" aria-controls="${x => x.id}-panel" id="${x => x.id}" @click="${(x, c) => x.clickHandler(c.event)}"><span class="heading"><slot name="heading" part="heading"></slot></span></button>${startTemplate} ${endTemplate}<span class="icon" part="icon" aria-hidden="true"><slot name="expanded-icon" part="expanded-icon">${definition.expandedIcon || ""}</slot><slot name="collapsed-icon" part="collapsed-icon">${definition.collapsedIcon || ""}</slot><span></div><div class="region" part="region" id="${x => x.id}-panel" role="region" aria-labelledby="${x => x.id}"><slot></slot></div></template>`;

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
function __decorate(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/**
 * Big thanks to https://github.com/fkleuver and the https://github.com/aurelia/aurelia project
 * for the bulk of this code and many of the associated tests.
 */

const metadataByTarget = new Map();

if (!("metadata" in Reflect)) {
  Reflect.metadata = function (key, value) {
    return function (target) {
      Reflect.defineMetadata(key, value, target);
    };
  };

  Reflect.defineMetadata = function (key, value, target) {
    let metadata = metadataByTarget.get(target);

    if (metadata === void 0) {
      metadataByTarget.set(target, metadata = new Map());
    }

    metadata.set(key, value);
  };

  Reflect.getOwnMetadata = function (key, target) {
    const metadata = metadataByTarget.get(target);

    if (metadata !== void 0) {
      return metadata.get(key);
    }

    return void 0;
  };
}
/**
 * @alpha
 */


class ResolverBuilder {
  constructor(container, key) {
    this.container = container;
    this.key = key;
  }

  instance(value) {
    return this.registerResolver(0
    /* instance */
    , value);
  }

  singleton(value) {
    return this.registerResolver(1
    /* singleton */
    , value);
  }

  transient(value) {
    return this.registerResolver(2
    /* transient */
    , value);
  }

  callback(value) {
    return this.registerResolver(3
    /* callback */
    , value);
  }

  cachedCallback(value) {
    return this.registerResolver(3
    /* callback */
    , cacheCallbackResult(value));
  }

  aliasTo(destinationKey) {
    return this.registerResolver(5
    /* alias */
    , destinationKey);
  }

  registerResolver(strategy, state) {
    const {
      container,
      key
    } = this;
    this.container = this.key = void 0;
    return container.registerResolver(key, new ResolverImpl(key, strategy, state));
  }

}

function cloneArrayWithPossibleProps(source) {
  const clone = source.slice();
  const keys = Object.keys(source);
  const len = keys.length;
  let key;

  for (let i = 0; i < len; ++i) {
    key = keys[i];

    if (!isArrayIndex(key)) {
      clone[key] = source[key];
    }
  }

  return clone;
}
/**
 * @alpha
 */


const DefaultResolver = Object.freeze({
  none(key) {
    throw Error(`${key.toString()} not registered, did you forget to add @singleton()?`);
  },

  singleton(key) {
    return new ResolverImpl(key, 1
    /* singleton */
    , key);
  },

  transient(key) {
    return new ResolverImpl(key, 2
    /* transient */
    , key);
  }

});
/**
 * @alpha
 */

const ContainerConfiguration = Object.freeze({
  default: Object.freeze({
    parentLocator: () => null,
    responsibleForOwnerRequests: false,
    defaultResolver: DefaultResolver.singleton
  })
});
const dependencyLookup = new Map();

function getParamTypes(key) {
  return Type => {
    return Reflect.getOwnMetadata(key, Type);
  };
}
/**
 * @alpha
 */


const DI = Object.freeze({
  createContainer(config) {
    return new ContainerImpl(null, Object.assign({}, ContainerConfiguration.default, config));
  },

  findResponsibleContainer(element) {
    const owned = element.$$container$$;

    if (owned && owned.responsibleForOwnerRequests) {
      return owned;
    }

    return DI.findParentContainer(element);
  },

  findParentContainer(element) {
    const event = new CustomEvent(DILocateParentEventType, {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {
        container: void 0
      }
    });
    element.dispatchEvent(event);
    return event.detail.container || DI.getOrCreateDOMContainer();
  },

  getOrCreateDOMContainer(element = document.body, config) {
    return element.$$container$$ || new ContainerImpl(element, Object.assign({}, ContainerConfiguration.default, config, {
      parentLocator: element === document.body ? () => null : DI.findParentContainer
    }));
  },

  getDesignParamtypes: getParamTypes("design:paramtypes"),
  getAnnotationParamtypes: getParamTypes("di:paramtypes"),

  getOrCreateAnnotationParamTypes(Type) {
    let annotationParamtypes = this.getAnnotationParamtypes(Type);

    if (annotationParamtypes === void 0) {
      Reflect.defineMetadata("di:paramtypes", annotationParamtypes = [], Type);
    }

    return annotationParamtypes;
  },

  getDependencies(Type) {
    // Note: Every detail of this getDependencies method is pretty deliberate at the moment, and probably not yet 100% tested from every possible angle,
    // so be careful with making changes here as it can have a huge impact on complex end user apps.
    // Preferably, only make changes to the dependency resolution process via a RFC.
    let dependencies = dependencyLookup.get(Type);

    if (dependencies === void 0) {
      // Type.length is the number of constructor parameters. If this is 0, it could mean the class has an empty constructor
      // but it could also mean the class has no constructor at all (in which case it inherits the constructor from the prototype).
      // Non-zero constructor length + no paramtypes means emitDecoratorMetadata is off, or the class has no decorator.
      // We're not doing anything with the above right now, but it's good to keep in mind for any future issues.
      const inject = Type.inject;

      if (inject === void 0) {
        // design:paramtypes is set by tsc when emitDecoratorMetadata is enabled.
        const designParamtypes = DI.getDesignParamtypes(Type); // di:paramtypes is set by the parameter decorator from DI.createInterface or by @inject

        const annotationParamtypes = DI.getAnnotationParamtypes(Type);

        if (designParamtypes === void 0) {
          if (annotationParamtypes === void 0) {
            // Only go up the prototype if neither static inject nor any of the paramtypes is defined, as
            // there is no sound way to merge a type's deps with its prototype's deps
            const Proto = Object.getPrototypeOf(Type);

            if (typeof Proto === "function" && Proto !== Function.prototype) {
              dependencies = cloneArrayWithPossibleProps(DI.getDependencies(Proto));
            } else {
              dependencies = [];
            }
          } else {
            // No design:paramtypes so just use the di:paramtypes
            dependencies = cloneArrayWithPossibleProps(annotationParamtypes);
          }
        } else if (annotationParamtypes === void 0) {
          // No di:paramtypes so just use the design:paramtypes
          dependencies = cloneArrayWithPossibleProps(designParamtypes);
        } else {
          // We've got both, so merge them (in case of conflict on same index, di:paramtypes take precedence)
          dependencies = cloneArrayWithPossibleProps(designParamtypes);
          let len = annotationParamtypes.length;
          let auAnnotationParamtype;

          for (let i = 0; i < len; ++i) {
            auAnnotationParamtype = annotationParamtypes[i];

            if (auAnnotationParamtype !== void 0) {
              dependencies[i] = auAnnotationParamtype;
            }
          }

          const keys = Object.keys(annotationParamtypes);
          len = keys.length;
          let key;

          for (let i = 0; i < len; ++i) {
            key = keys[i];

            if (!isArrayIndex(key)) {
              dependencies[key] = annotationParamtypes[key];
            }
          }
        }
      } else {
        // Ignore paramtypes if we have static inject
        dependencies = cloneArrayWithPossibleProps(inject);
      }

      dependencyLookup.set(Type, dependencies);
    }

    return dependencies;
  },

  defineProperty(target, propertyName, key, respectConnection = false) {
    const diPropertyKey = `$di_${propertyName}`;
    Reflect.defineProperty(target, propertyName, {
      get: function () {
        let value = this[diPropertyKey];

        if (value === void 0) {
          const container = this instanceof HTMLElement ? DI.findResponsibleContainer(this) : DI.getOrCreateDOMContainer();
          value = container.get(key);
          this[diPropertyKey] = value;

          if (respectConnection && this instanceof FASTElement) {
            const notifier = this.$fastController;

            const handleChange = () => {
              const newContainer = DI.findResponsibleContainer(this);
              const newValue = newContainer.get(key);
              const oldValue = this[diPropertyKey];

              if (newValue !== oldValue) {
                this[diPropertyKey] = value;
                notifier.notify(propertyName);
              }
            };

            notifier.subscribe({
              handleChange
            }, "isConnected");
          }
        }

        return value;
      }
    });
  },

  createInterface(nameConfigOrCallback, configuror) {
    const configure = typeof nameConfigOrCallback === "function" ? nameConfigOrCallback : configuror;
    const friendlyName = typeof nameConfigOrCallback === "string" ? nameConfigOrCallback : nameConfigOrCallback && "friendlyName" in nameConfigOrCallback ? nameConfigOrCallback.friendlyName || defaultFriendlyName : defaultFriendlyName;
    const respectConnection = typeof nameConfigOrCallback === "string" ? false : nameConfigOrCallback && "respectConnection" in nameConfigOrCallback ? nameConfigOrCallback.respectConnection || false : false;

    const Interface = function (target, property, index) {
      if (target == null || new.target !== undefined) {
        throw new Error(`No registration for interface: '${Interface.friendlyName}'`);
      }

      if (property) {
        DI.defineProperty(target, property, Interface, respectConnection);
      } else {
        const annotationParamtypes = DI.getOrCreateAnnotationParamTypes(target);
        annotationParamtypes[index] = Interface;
      }
    };

    Interface.$isInterface = true;
    Interface.friendlyName = friendlyName == null ? "(anonymous)" : friendlyName;

    if (configure != null) {
      Interface.register = function (container, key) {
        return configure(new ResolverBuilder(container, key !== null && key !== void 0 ? key : Interface));
      };
    }

    Interface.toString = function toString() {
      return `InterfaceSymbol<${Interface.friendlyName}>`;
    };

    return Interface;
  },

  inject(...dependencies) {
    return function (target, key, descriptor) {
      if (typeof descriptor === "number") {
        // It's a parameter decorator.
        const annotationParamtypes = DI.getOrCreateAnnotationParamTypes(target);
        const dep = dependencies[0];

        if (dep !== void 0) {
          annotationParamtypes[descriptor] = dep;
        }
      } else if (key) {
        DI.defineProperty(target, key, dependencies[0]);
      } else {
        const annotationParamtypes = descriptor ? DI.getOrCreateAnnotationParamTypes(descriptor.value) : DI.getOrCreateAnnotationParamTypes(target);
        let dep;

        for (let i = 0; i < dependencies.length; ++i) {
          dep = dependencies[i];

          if (dep !== void 0) {
            annotationParamtypes[i] = dep;
          }
        }
      }
    };
  },

  /**
   * Registers the `target` class as a transient dependency; each time the dependency is resolved
   * a new instance will be created.
   *
   * @param target - The class / constructor function to register as transient.
   * @returns The same class, with a static `register` method that takes a container and returns the appropriate resolver.
   *
   * @example
   * ```ts
   * // On an existing class
   * class Foo { }
   * DI.transient(Foo);
   *
   * // Inline declaration
   * const Foo = DI.transient(class { });
   * // Foo is now strongly typed with register
   * Foo.register(container);
   * ```
   */
  transient(target) {
    target.register = function register(container) {
      const registration = Registration.transient(target, target);
      return registration.register(container, target);
    };

    target.registerInRequestor = false;
    return target;
  },

  /**
   * Registers the `target` class as a singleton dependency; the class will only be created once. Each
   * consecutive time the dependency is resolved, the same instance will be returned.
   *
   * @param target - The class / constructor function to register as a singleton.
   * @returns The same class, with a static `register` method that takes a container and returns the appropriate resolver.
   * @example
   * ```ts
   * // On an existing class
   * class Foo { }
   * DI.singleton(Foo);
   *
   * // Inline declaration
   * const Foo = DI.singleton(class { });
   * // Foo is now strongly typed with register
   * Foo.register(container);
   * ```
   *
   * @alpha
   */
  singleton(target, options = defaultSingletonOptions) {
    target.register = function register(container) {
      const registration = Registration.singleton(target, target);
      return registration.register(container, target);
    };

    target.registerInRequestor = options.scoped;
    return target;
  }

});
/**
 * @alpha
 */

const Container = DI.createInterface("Container");
/**
 * @alpha
 */


DI.inject;
const defaultSingletonOptions = {
  scoped: false
};
/** @internal */


class ResolverImpl {
  constructor(key, strategy, state) {
    this.key = key;
    this.strategy = strategy;
    this.state = state;
    this.resolving = false;
  }

  get $isResolver() {
    return true;
  }

  register(container, key) {
    return container.registerResolver(key || this.key, this);
  }

  resolve(handler, requestor) {
    switch (this.strategy) {
      case 0
      /* instance */
      :
        return this.state;

      case 1
      /* singleton */
      :
        {
          if (this.resolving) {
            throw new Error(`Cyclic dependency found: ${this.state.name}`);
          }

          this.resolving = true;
          this.state = handler.getFactory(this.state).construct(requestor);
          this.strategy = 0
          /* instance */
          ;
          this.resolving = false;
          return this.state;
        }

      case 2
      /* transient */
      :
        {
          // Always create transients from the requesting container
          const factory = handler.getFactory(this.state);

          if (factory === null) {
            throw new Error(`Resolver for ${String(this.key)} returned a null factory`);
          }

          return factory.construct(requestor);
        }

      case 3
      /* callback */
      :
        return this.state(handler, requestor, this);

      case 4
      /* array */
      :
        return this.state[0].resolve(handler, requestor);

      case 5
      /* alias */
      :
        return requestor.get(this.state);

      default:
        throw new Error(`Invalid resolver strategy specified: ${this.strategy}.`);
    }
  }

  getFactory(container) {
    var _a, _b, _c;

    switch (this.strategy) {
      case 1
      /* singleton */
      :
      case 2
      /* transient */
      :
        return container.getFactory(this.state);

      case 5
      /* alias */
      :
        return (_c = (_b = (_a = container.getResolver(this.state)) === null || _a === void 0 ? void 0 : _a.getFactory) === null || _b === void 0 ? void 0 : _b.call(_a, container)) !== null && _c !== void 0 ? _c : null;

      default:
        return null;
    }
  }

}

function containerGetKey(d) {
  return this.get(d);
}

function transformInstance(inst, transform) {
  return transform(inst);
}
/** @internal */


class FactoryImpl {
  constructor(Type, dependencies) {
    this.Type = Type;
    this.dependencies = dependencies;
    this.transformers = null;
  }

  construct(container, dynamicDependencies) {
    let instance;

    if (dynamicDependencies === void 0) {
      instance = new this.Type(...this.dependencies.map(containerGetKey, container));
    } else {
      instance = new this.Type(...this.dependencies.map(containerGetKey, container), ...dynamicDependencies);
    }

    if (this.transformers == null) {
      return instance;
    }

    return this.transformers.reduce(transformInstance, instance);
  }

  registerTransformer(transformer) {
    (this.transformers || (this.transformers = [])).push(transformer);
  }

}
const containerResolver = {
  $isResolver: true,

  resolve(handler, requestor) {
    return requestor;
  }

};

function isRegistry(obj) {
  return typeof obj.register === "function";
}

function isSelfRegistry(obj) {
  return isRegistry(obj) && typeof obj.registerInRequestor === "boolean";
}

function isRegisterInRequester(obj) {
  return isSelfRegistry(obj) && obj.registerInRequestor;
}

function isClass(obj) {
  return obj.prototype !== void 0;
}

const InstrinsicTypeNames = new Set(["Array", "ArrayBuffer", "Boolean", "DataView", "Date", "Error", "EvalError", "Float32Array", "Float64Array", "Function", "Int8Array", "Int16Array", "Int32Array", "Map", "Number", "Object", "Promise", "RangeError", "ReferenceError", "RegExp", "Set", "SharedArrayBuffer", "String", "SyntaxError", "TypeError", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "URIError", "WeakMap", "WeakSet"]);
const DILocateParentEventType = "__DI_LOCATE_PARENT__";
const factories = new Map();
/**
 * @alpha
 */

class ContainerImpl {
  constructor(owner, config) {
    this.owner = owner;
    this.config = config;
    this._parent = void 0;
    this.registerDepth = 0;

    if (owner !== null) {
      owner.$$container$$ = this;
    }

    this.resolvers = new Map();
    this.resolvers.set(Container, containerResolver);

    if (owner instanceof HTMLElement) {
      owner.addEventListener(DILocateParentEventType, e => {
        if (e.composedPath()[0] !== this.owner) {
          e.detail.container = this;
          e.stopImmediatePropagation();
        }
      });
    }
  }

  get parent() {
    if (this._parent === void 0) {
      this._parent = this.config.parentLocator(this.owner);
    }

    return this._parent;
  }

  get depth() {
    return this.parent === null ? 0 : this.parent.depth + 1;
  }

  get responsibleForOwnerRequests() {
    return this.config.responsibleForOwnerRequests;
  }

  register(...params) {
    if (++this.registerDepth === 100) {
      throw new Error("Unable to autoregister dependency"); // Most likely cause is trying to register a plain object that does not have a
      // register method and is not a class constructor
    }

    let current;
    let keys;
    let value;
    let j;
    let jj;

    for (let i = 0, ii = params.length; i < ii; ++i) {
      current = params[i];

      if (!isObject(current)) {
        continue;
      }

      if (isRegistry(current)) {
        current.register(this);
      } else if (isClass(current)) {
        Registration.singleton(current, current).register(this);
      } else {
        keys = Object.keys(current);
        j = 0;
        jj = keys.length;

        for (; j < jj; ++j) {
          value = current[keys[j]];

          if (!isObject(value)) {
            continue;
          } // note: we could remove this if-branch and call this.register directly
          // - the extra check is just a perf tweak to create fewer unnecessary arrays by the spread operator


          if (isRegistry(value)) {
            value.register(this);
          } else {
            this.register(value);
          }
        }
      }
    }

    --this.registerDepth;
    return this;
  }

  registerResolver(key, resolver) {
    validateKey(key);
    const resolvers = this.resolvers;
    const result = resolvers.get(key);

    if (result == null) {
      resolvers.set(key, resolver);
    } else if (result instanceof ResolverImpl && result.strategy === 4
    /* array */
    ) {
        result.state.push(resolver);
      } else {
      resolvers.set(key, new ResolverImpl(key, 4
      /* array */
      , [result, resolver]));
    }

    return resolver;
  }

  registerTransformer(key, transformer) {
    const resolver = this.getResolver(key);

    if (resolver == null) {
      return false;
    }

    if (resolver.getFactory) {
      const factory = resolver.getFactory(this);

      if (factory == null) {
        return false;
      } // This type cast is a bit of a hacky one, necessary due to the duplicity of IResolverLike.
      // Problem is that that interface's type arg can be of type Key, but the getFactory method only works on
      // type Constructable. So the return type of that optional method has this additional constraint, which
      // seems to confuse the type checker.


      factory.registerTransformer(transformer);
      return true;
    }

    return false;
  }

  getResolver(key, autoRegister = true) {
    validateKey(key);

    if (key.resolve !== void 0) {
      return key;
    }
    /* eslint-disable-next-line */


    let current = this;
    let resolver;

    while (current != null) {
      resolver = current.resolvers.get(key);

      if (resolver == null) {
        if (current.parent == null) {
          const handler = isRegisterInRequester(key) ? this : current;
          return autoRegister ? this.jitRegister(key, handler) : null;
        }

        current = current.parent;
      } else {
        return resolver;
      }
    }

    return null;
  }

  has(key, searchAncestors = false) {
    return this.resolvers.has(key) ? true : searchAncestors && this.parent != null ? this.parent.has(key, true) : false;
  }

  get(key) {
    validateKey(key);

    if (key.$isResolver) {
      return key.resolve(this, this);
    }
    /* eslint-disable-next-line */


    let current = this;
    let resolver;

    while (current != null) {
      resolver = current.resolvers.get(key);

      if (resolver == null) {
        if (current.parent == null) {
          const handler = isRegisterInRequester(key) ? this : current;
          resolver = this.jitRegister(key, handler);
          return resolver.resolve(current, this);
        }

        current = current.parent;
      } else {
        return resolver.resolve(current, this);
      }
    }

    throw new Error(`Unable to resolve key: ${key}`);
  }

  getAll(key, searchAncestors = false) {
    validateKey(key);
    /* eslint-disable-next-line */

    const requestor = this;
    let current = requestor;
    let resolver;

    if (searchAncestors) {
      let resolutions = emptyArray;

      while (current != null) {
        resolver = current.resolvers.get(key);

        if (resolver != null) {
          resolutions = resolutions.concat(buildAllResponse(resolver, current, requestor));
        }

        current = current.parent;
      }

      return resolutions;
    } else {
      while (current != null) {
        resolver = current.resolvers.get(key);

        if (resolver == null) {
          current = current.parent;

          if (current == null) {
            return emptyArray;
          }
        } else {
          return buildAllResponse(resolver, current, requestor);
        }
      }
    }

    return emptyArray;
  }

  getFactory(Type) {
    let factory = factories.get(Type);

    if (factory === void 0) {
      if (isNativeFunction(Type)) {
        throw new Error(`${Type.name} is a native function and therefore cannot be safely constructed by DI. If this is intentional, please use a callback or cachedCallback resolver.`);
      }

      factories.set(Type, factory = new FactoryImpl(Type, DI.getDependencies(Type)));
    }

    return factory;
  }

  registerFactory(key, factory) {
    factories.set(key, factory);
  }

  createChild(config) {
    return new ContainerImpl(null, Object.assign({}, this.config, config, {
      parentLocator: () => this
    }));
  }

  jitRegister(keyAsValue, handler) {
    if (typeof keyAsValue !== "function") {
      throw new Error(`Attempted to jitRegister something that is not a constructor: '${keyAsValue}'. Did you forget to register this resource?`);
    }

    if (InstrinsicTypeNames.has(keyAsValue.name)) {
      throw new Error(`Attempted to jitRegister an intrinsic type: ${keyAsValue.name}. Did you forget to add @inject(Key)`);
    }

    if (isRegistry(keyAsValue)) {
      const registrationResolver = keyAsValue.register(handler, keyAsValue);

      if (!(registrationResolver instanceof Object) || registrationResolver.resolve == null) {
        const newResolver = handler.resolvers.get(keyAsValue);

        if (newResolver != void 0) {
          return newResolver;
        }

        throw new Error("A valid resolver was not returned from the static register method");
      }

      return registrationResolver;
    } else if (keyAsValue.$isInterface) {
      throw new Error(`Attempted to jitRegister an interface: ${keyAsValue.friendlyName}`);
    } else {
      const resolver = this.config.defaultResolver(keyAsValue, handler);
      handler.resolvers.set(keyAsValue, resolver);
      return resolver;
    }
  }

}
const cache = new WeakMap();

function cacheCallbackResult(fun) {
  return function (handler, requestor, resolver) {
    if (cache.has(resolver)) {
      return cache.get(resolver);
    }

    const t = fun(handler, requestor, resolver);
    cache.set(resolver, t);
    return t;
  };
}
/**
 * You can use the resulting Registration of any of the factory methods
 * to register with the container, e.g.
 * ```
 * class Foo {}
 * const container = DI.createContainer();
 * container.register(Registration.instance(Foo, new Foo()));
 * container.get(Foo);
 * ```
 *
 * @alpha
 */


const Registration = Object.freeze({
  /**
   * allows you to pass an instance.
   * Every time you request this {@link Key} you will get this instance back.
   * ```
   * Registration.instance(Foo, new Foo()));
   * ```
   *
   * @param key -
   * @param value -
   */
  instance(key, value) {
    return new ResolverImpl(key, 0
    /* instance */
    , value);
  },

  /**
   * Creates an instance from the class.
   * Every time you request this {@link Key} you will get the same one back.
   * ```
   * Registration.singleton(Foo, Foo);
   * ```
   *
   * @param key -
   * @param value -
   */
  singleton(key, value) {
    return new ResolverImpl(key, 1
    /* singleton */
    , value);
  },

  /**
   * Creates an instance from a class.
   * Every time you request this {@link Key} you will get a new instance.
   * ```
   * Registration.instance(Foo, Foo);
   * ```
   *
   * @param key -
   * @param value -
   */
  transient(key, value) {
    return new ResolverImpl(key, 2
    /* transient */
    , value);
  },

  /**
   * Creates an instance from the method passed.
   * Every time you request this {@link Key} you will get a new instance.
   * ```
   * Registration.callback(Foo, () => new Foo());
   * Registration.callback(Bar, (c: IContainer) => new Bar(c.get(Foo)));
   * ```
   *
   * @param key -
   * @param callback -
   */
  callback(key, callback) {
    return new ResolverImpl(key, 3
    /* callback */
    , callback);
  },

  /**
   * Creates an instance from the method passed.
   * On the first request for the {@link Key} your callback is called and returns an instance.
   * subsequent requests for the {@link Key}, the initial instance returned will be returned.
   * If you pass the same Registration to another container the same cached value will be used.
   * Should all references to the resolver returned be removed, the cache will expire.
   * ```
   * Registration.cachedCallback(Foo, () => new Foo());
   * Registration.cachedCallback(Bar, (c: IContainer) => new Bar(c.get(Foo)));
   * ```
   *
   * @param key -
   * @param callback -
   */
  cachedCallback(key, callback) {
    return new ResolverImpl(key, 3
    /* callback */
    , cacheCallbackResult(callback));
  },

  /**
   * creates an alternate {@link Key} to retrieve an instance by.
   * Returns the same scope as the original {@link Key}.
   * ```
   * Register.singleton(Foo, Foo)
   * Register.aliasTo(Foo, MyFoos);
   *
   * container.getAll(MyFoos) // contains an instance of Foo
   * ```
   *
   * @param originalKey -
   * @param aliasKey -
   */
  aliasTo(originalKey, aliasKey) {
    return new ResolverImpl(aliasKey, 5
    /* alias */
    , originalKey);
  }

});
/** @internal */

function validateKey(key) {
  if (key === null || key === void 0) {
    throw new Error("key/value cannot be null or undefined. Are you trying to inject/register something that doesn't exist with DI?");
  }
}

function buildAllResponse(resolver, handler, requestor) {
  if (resolver instanceof ResolverImpl && resolver.strategy === 4
  /* array */
  ) {
      const state = resolver.state;
      let i = state.length;
      const results = new Array(i);

      while (i--) {
        results[i] = state[i].resolve(handler, requestor);
      }

      return results;
    }

  return [resolver.resolve(handler, requestor)];
}

const defaultFriendlyName = "(anonymous)";
/* eslint-disable-next-line */

function isObject(value) {
  return typeof value === "object" && value !== null || typeof value === "function";
}
/**
 * Determine whether the value is a native function.
 *
 * @param fn - The function to check.
 * @returns `true` is the function is a native function, otherwise `false`
 */


const isNativeFunction = function () {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const lookup = new WeakMap();
  let isNative = false;
  let sourceText = "";
  let i = 0; // eslint-disable-next-line @typescript-eslint/ban-types

  return function (fn) {
    isNative = lookup.get(fn);

    if (isNative === void 0) {
      sourceText = fn.toString();
      i = sourceText.length; // http://www.ecma-international.org/ecma-262/#prod-NativeFunction

      isNative = // 29 is the length of 'function () { [native code] }' which is the smallest length of a native function string
      i >= 29 && // 100 seems to be a safe upper bound of the max length of a native function. In Chrome and FF it's 56, in Edge it's 61.
      i <= 100 && // This whole heuristic *could* be tricked by a comment. Do we need to care about that?
      sourceText.charCodeAt(i - 1) === 0x7d && // }
      // TODO: the spec is a little vague about the precise constraints, so we do need to test this across various browsers to make sure just one whitespace is a safe assumption.
      sourceText.charCodeAt(i - 2) <= 0x20 && // whitespace
      sourceText.charCodeAt(i - 3) === 0x5d && // ]
      sourceText.charCodeAt(i - 4) === 0x65 && // e
      sourceText.charCodeAt(i - 5) === 0x64 && // d
      sourceText.charCodeAt(i - 6) === 0x6f && // o
      sourceText.charCodeAt(i - 7) === 0x63 && // c
      sourceText.charCodeAt(i - 8) === 0x20 && //
      sourceText.charCodeAt(i - 9) === 0x65 && // e
      sourceText.charCodeAt(i - 10) === 0x76 && // v
      sourceText.charCodeAt(i - 11) === 0x69 && // i
      sourceText.charCodeAt(i - 12) === 0x74 && // t
      sourceText.charCodeAt(i - 13) === 0x61 && // a
      sourceText.charCodeAt(i - 14) === 0x6e && // n
      sourceText.charCodeAt(i - 15) === 0x58; // [

      lookup.set(fn, isNative);
    }

    return isNative;
  };
}();

const isNumericLookup = {};

function isArrayIndex(value) {
  switch (typeof value) {
    case "number":
      return value >= 0 && (value | 0) === value;

    case "string":
      {
        const result = isNumericLookup[value];

        if (result !== void 0) {
          return result;
        }

        const length = value.length;

        if (length === 0) {
          return isNumericLookup[value] = false;
        }

        let ch = 0;

        for (let i = 0; i < length; ++i) {
          ch = value.charCodeAt(i);

          if (i === 0 && ch === 0x30 && length > 1 ||
          /* must not start with 0 */
          ch < 0x30
          /* 0 */
          || ch > 0x39
          /* 9 */
          ) {
              return isNumericLookup[value] = false;
            }
        }

        return isNumericLookup[value] = true;
      }

    default:
      return false;
  }
}

function presentationKeyFromTag(tagName) {
  return `${tagName.toLowerCase()}:presentation`;
}

const presentationRegistry = new Map();
/**
 * An API gateway to component presentation features.
 * @public
 */

const ComponentPresentation = Object.freeze({
  /**
   * Defines a component presentation for an element.
   * @param tagName - The element name to define the presentation for.
   * @param presentation - The presentation that will be applied to matching elements.
   * @param container - The dependency injection container to register the configuration in.
   * @public
   */
  define(tagName, presentation, container) {
    const key = presentationKeyFromTag(tagName);
    const existing = presentationRegistry.get(key);

    if (existing === void 0) {
      presentationRegistry.set(key, presentation);
    } else {
      // false indicates that we have more than one presentation
      // registered for a tagName and we must resolve through DI
      presentationRegistry.set(key, false);
    }

    container.register(Registration.instance(key, presentation));
  },

  /**
   * Finds a component presentation for the specified element name,
   * searching the DOM hierarchy starting from the provided element.
   * @param tagName - The name of the element to locate the presentation for.
   * @param element - The element to begin the search from.
   * @returns The component presentation or null if none is found.
   * @public
   */
  forTag(tagName, element) {
    const key = presentationKeyFromTag(tagName);
    const existing = presentationRegistry.get(key);

    if (existing === false) {
      const container = DI.findResponsibleContainer(element);
      return container.get(key);
    }

    return existing || null;
  }

});
/**
 * The default implementation of ComponentPresentation, used by FoundationElement.
 * @public
 */

class DefaultComponentPresentation {
  /**
   * Creates an instance of DefaultComponentPresentation.
   * @param template - The template to apply to the element.
   * @param styles - The styles to apply to the element.
   * @public
   */
  constructor(template, styles) {
    this.template = template || null;
    this.styles = styles === void 0 ? null : Array.isArray(styles) ? ElementStyles.create(styles) : styles instanceof ElementStyles ? styles : ElementStyles.create([styles]);
  }
  /**
   * Applies the presentation details to the specified element.
   * @param element - The element to apply the presentation details to.
   * @public
   */


  applyTo(element) {
    const controller = element.$fastController;

    if (controller.template === null) {
      controller.template = this.template;
    }

    if (controller.styles === null) {
      controller.styles = this.styles;
    }
  }

}

/**
 * Design system contextual APIs and configuration usable within component
 * registries.
 * @public
 */

const DesignSystemRegistrationContext = DI.createInterface();
const elementTypesByTag = new Map();
const elementTagsByType = new Map();
const designSystemKey = DI.createInterface(x => x.cachedCallback(handler => {
  const element = document.body;
  const owned = element.$$designSystem$$;

  if (owned) {
    return owned;
  }

  return new DefaultDesignSystem(element, handler);
}));
/**
 * An API gateway to design system features.
 * @public
 */

const DesignSystem = Object.freeze({
  /**
   * Returns the HTML element name that the type is defined as.
   * @param type - The type to lookup.
   * @public
   */
  tagFor(type) {
    return elementTagsByType.get(type);
  },

  /**
   * Searches the DOM hierarchy for the design system that is responsible
   * for the provided element.
   * @param element - The element to locate the design system for.
   * @returns The located design system.
   * @public
   */
  responsibleFor(element) {
    const owned = element.$$designSystem$$;

    if (owned) {
      return owned;
    }

    const container = DI.findResponsibleContainer(element);
    return container.get(designSystemKey);
  },

  /**
   * Gets the DesignSystem if one is explicitly defined on the provided element;
   * otherwise creates a design system defined directly on the element.
   * @param element - The element to get or create a design system for.
   * @returns The design system.
   * @public
   */
  getOrCreate(element = document.body) {
    const owned = element.$$designSystem$$;

    if (owned) {
      return owned;
    }

    const container = DI.getOrCreateDOMContainer(element);

    if (!container.has(designSystemKey, false)) {
      container.register(Registration.instance(designSystemKey, new DefaultDesignSystem(element, container)));
    }

    return container.get(designSystemKey);
  }

});

class DefaultDesignSystem {
  constructor(host, container) {
    this.host = host;
    this.container = container;
    this.prefix = "fast";
    this.shadowRootMode = undefined;

    this.disambiguate = () => null;

    host.$$designSystem$$ = this;
    container.register(Registration.callback(DesignSystemRegistrationContext, () => this.context));
  }

  withPrefix(prefix) {
    this.prefix = prefix;
    return this;
  }

  withShadowRootMode(mode) {
    this.shadowRootMode = mode;
    return this;
  }

  withElementDisambiguation(callback) {
    this.disambiguate = callback;
    return this;
  }

  register(...registrations) {
    const container = this.container;
    const elementDefinitionEntries = [];
    const disambiguate = this.disambiguate;
    const shadowRootMode = this.shadowRootMode;
    this.context = {
      elementPrefix: this.prefix,

      tryDefineElement(name, type, callback) {
        let elementName = name;
        let foundByName = elementTypesByTag.get(elementName);

        while (foundByName && elementName) {
          elementName = disambiguate(elementName, type, foundByName);

          if (elementName) {
            foundByName = elementTypesByTag.get(elementName);
          }
        }

        const willDefine = !!elementName;

        if (willDefine) {
          if (elementTagsByType.has(type)) {
            type = class extends type {};
          }

          elementTypesByTag.set(elementName, type);
          elementTagsByType.set(type, elementName);
        }

        elementDefinitionEntries.push(new ElementDefinitionEntry(container, elementName || name, type, shadowRootMode, callback, willDefine));
      }

    };
    container.register(...registrations);

    for (const entry of elementDefinitionEntries) {
      entry.callback(entry);

      if (entry.willDefine && entry.definition !== null) {
        entry.definition.define();
      }
    }

    return this;
  }

}

class ElementDefinitionEntry {
  constructor(container, name, type, shadowRootMode, callback, willDefine) {
    this.container = container;
    this.name = name;
    this.type = type;
    this.shadowRootMode = shadowRootMode;
    this.callback = callback;
    this.willDefine = willDefine;
    this.definition = null;
  }

  definePresentation(presentation) {
    ComponentPresentation.define(this.name, presentation, this.container);
  }

  defineElement(definition) {
    this.definition = new FASTElementDefinition(this.type, Object.assign(Object.assign({}, definition), {
      name: this.name
    }));
  }

  tagFor(type) {
    return DesignSystem.tagFor(type);
  }

}

/**
 * Defines a foundation element class that:
 * 1. Connects the element to its ComponentPresentation
 * 2. Allows resolving the element template from the instance or ComponentPresentation
 * 3. Allows resolving the element styles from the instance or ComponentPresentation
 *
 * @public
 */

class FoundationElement extends FASTElement {
  constructor() {
    super(...arguments);
    this._presentation = void 0;
  }
  /**
   * A property which resolves the ComponentPresentation instance
   * for the current component.
   * @public
   */


  get $presentation() {
    if (this._presentation === void 0) {
      this._presentation = ComponentPresentation.forTag(this.tagName, this);
    }

    return this._presentation;
  }

  templateChanged() {
    if (this.template !== undefined) {
      this.$fastController.template = this.template;
    }
  }

  stylesChanged() {
    if (this.styles !== undefined) {
      this.$fastController.styles = this.styles;
    }
  }
  /**
   * The connected callback for this FASTElement.
   * @remarks
   * This method is invoked by the platform whenever this FoundationElement
   * becomes connected to the document.
   * @public
   */


  connectedCallback() {
    if (this.$presentation !== null) {
      this.$presentation.applyTo(this);
    }

    super.connectedCallback();
  }
  /**
   * Defines an element registry function with a set of element definition defaults.
   * @param elementDefinition - The definition of the element to create the registry
   * function for.
   * @public
   */


  static compose(elementDefinition) {
    return (overrideDefinition = {}) => new FoundationElementRegistry(this === FoundationElement ? class extends FoundationElement {} : this, elementDefinition, overrideDefinition);
  }

}

__decorate([observable], FoundationElement.prototype, "template", void 0);

__decorate([observable], FoundationElement.prototype, "styles", void 0);

function resolveOption(option, context, definition) {
  if (typeof option === "function") {
    return option(context, definition);
  }

  return option;
}
/**
 * Registry capable of defining presentation properties for a DOM Container hierarchy.
 *
 * @internal
 */


class FoundationElementRegistry {
  constructor(type, elementDefinition, overrideDefinition) {
    this.type = type;
    this.elementDefinition = elementDefinition;
    this.overrideDefinition = overrideDefinition;
    this.definition = Object.assign(Object.assign({}, this.elementDefinition), this.overrideDefinition);
  }

  register(container) {
    const definition = this.definition;
    const overrideDefinition = this.overrideDefinition;
    const context = container.get(DesignSystemRegistrationContext);
    const prefix = definition.prefix || context.elementPrefix;
    const name = `${prefix}-${definition.baseName}`;
    context.tryDefineElement(name, this.type, x => {
      const presentation = new DefaultComponentPresentation(resolveOption(definition.template, x, definition), resolveOption(definition.styles, x, definition));
      x.definePresentation(presentation);
      let shadowOptions = resolveOption(definition.shadowOptions, x, definition);

      if (x.shadowRootMode) {
        // If the design system has overridden the shadow root mode, we need special handling.
        if (shadowOptions) {
          // If there are shadow options present in the definition, then
          // either the component itself has specified an option or the
          // registry function has overridden it.
          if (!overrideDefinition.shadowOptions) {
            // There were shadow options provided by the component and not overridden by
            // the registry.
            shadowOptions.mode = x.shadowRootMode;
          }
        } else if (shadowOptions !== null) {
          // If the component author did not provide shadow options,
          // and did not null them out (light dom opt-in) then they
          // were relying on the FASTElement default. So, if the
          // design system provides a mode, we need to create the options
          // to override the default.
          shadowOptions = {
            mode: x.shadowRootMode
          };
        }
      }

      x.defineElement({
        elementOptions: resolveOption(definition.elementOptions, x, definition),
        shadowOptions,
        attributes: resolveOption(definition.attributes, x, definition)
      });
    });
  }

}

/**
 * Apply mixins to a constructor.
 * Sourced from {@link https://www.typescriptlang.org/docs/handbook/mixins.html | TypeScript Documentation }.
 * @public
 */
function applyMixins(derivedCtor, ...baseCtors) {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      if (name !== "constructor") {
        Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
      }
    });

    if (baseCtor.attributes) {
      const existing = derivedCtor.attributes || [];
      derivedCtor.attributes = existing.concat(baseCtor.attributes);
    }
  });
}

/**
 * An individual item in an {@link @microsoft/fast-foundation#(Accordion:class) }.
 * @public
 */

class AccordionItem extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * Configures the {@link https://www.w3.org/TR/wai-aria-1.1/#aria-level | level} of the
     * heading element.
     *
     * @defaultValue 2
     * @public
     * @remarks
     * HTML attribute: heading-level
     */

    this.headinglevel = 2;
    /**
     * Expands or collapses the item.
     *
     * @public
     * @remarks
     * HTML attribute: expanded
     */

    this.expanded = false;
    /**
     * @internal
     */

    this.clickHandler = e => {
      this.expanded = !this.expanded;
      this.change();
    };

    this.change = () => {
      this.$emit("change");
    };
  }

}

__decorate([attr({
  attribute: "heading-level",
  mode: "fromView",
  converter: nullableNumberConverter
})], AccordionItem.prototype, "headinglevel", void 0);

__decorate([attr({
  mode: "boolean"
})], AccordionItem.prototype, "expanded", void 0);

__decorate([attr], AccordionItem.prototype, "id", void 0);

applyMixins(AccordionItem, StartEnd);

/**
 * The template for the {@link @microsoft/fast-foundation#Accordion} component.
 * @public
 */

const accordionTemplate = (context, definition) => html`<template><slot name="item" part="item" ${slotted("accordionItems")}></slot></template>`;

var Orientation;

(function (Orientation) {
  Orientation["horizontal"] = "horizontal";
  Orientation["vertical"] = "vertical";
})(Orientation || (Orientation = {}));

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */

var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
/** Used as a reference to the global object. */

var root = freeGlobal || freeSelf || Function('return this')();

/** Built-in value references. */

var Symbol$1 = root.Symbol;

/** Used for built-in method references. */

var objectProto = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty = objectProto.hasOwnProperty;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */

var nativeObjectToString = objectProto.toString;
/** Built-in value references. */

var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;
/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */

function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);

  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }

  return result;
}

/** Used for built-in method references. */
var objectProto$1 = Object.prototype;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */

var nativeObjectToString$1 = objectProto$1.toString;
/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */

function objectToString(value) {
  return nativeObjectToString$1.call(value);
}

/** `Object#toString` result references. */

var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';
/** Built-in value references. */

var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : undefined;
/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */

function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }

  return symToStringTag$1 && symToStringTag$1 in Object(value) ? getRawTag(value) : objectToString(value);
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/** `Object#toString` result references. */

var symbolTag = '[object Symbol]';
/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */

function isSymbol(value) {
  return typeof value == 'symbol' || isObjectLike(value) && baseGetTag(value) == symbolTag;
}

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }

  return result;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/** Used as references for various `Number` constants. */

var INFINITY = 1 / 0;
/** Used to convert symbols to primitives and strings. */

var symbolProto = Symbol$1 ? Symbol$1.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;
/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */

function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }

  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }

  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }

  var result = value + '';
  return result == '0' && 1 / value == -INFINITY ? '-0' : result;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject$1(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/** Used as references for various `Number` constants. */

var NAN = 0 / 0;
/** Used to match leading and trailing whitespace. */

var reTrim = /^\s+|\s+$/g;
/** Used to detect bad signed hexadecimal string values. */

var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
/** Used to detect binary string values. */

var reIsBinary = /^0b[01]+$/i;
/** Used to detect octal string values. */

var reIsOctal = /^0o[0-7]+$/i;
/** Built-in method references without a dependency on `root`. */

var freeParseInt = parseInt;
/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */

function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }

  if (isSymbol(value)) {
    return NAN;
  }

  if (isObject$1(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject$1(other) ? other + '' : other;
  }

  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }

  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
}

/** Used as references for various `Number` constants. */

var INFINITY$1 = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308;
/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */

function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }

  value = toNumber(value);

  if (value === INFINITY$1 || value === -INFINITY$1) {
    var sign = value < 0 ? -1 : 1;
    return sign * MAX_INTEGER;
  }

  return value === value ? value : 0;
}

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

/** `Object#toString` result references. */

var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';
/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */

function isFunction(value) {
  if (!isObject$1(value)) {
    return false;
  } // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.


  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new constant function.
 * @example
 *
 * var objects = _.times(2, _.constant({ 'a': 1 }));
 *
 * console.log(objects);
 * // => [{ 'a': 1 }, { 'a': 1 }]
 *
 * console.log(objects[0] === objects[1]);
 * // => true
 */
function constant(value) {
  return function () {
    return value;
  };
}

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;
/** Used to detect unsigned integer values. */

var reIsUint = /^(?:0|[1-9]\d*)$/;
/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */

function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length && (type == 'number' || type != 'symbol' && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
}

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER$1 = 9007199254740991;
/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */

function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER$1;
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */

function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/** Used for built-in method references. */
var objectProto$2 = Object.prototype;
/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */

function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = typeof Ctor == 'function' && Ctor.prototype || objectProto$2;
  return value === proto;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }

  return result;
}

/** `Object#toString` result references. */

var argsTag = '[object Arguments]';
/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */

function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

/** Used for built-in method references. */

var objectProto$3 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$1 = objectProto$3.hasOwnProperty;
/** Built-in value references. */

var propertyIsEnumerable = objectProto$3.propertyIsEnumerable;
/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */

var isArguments = baseIsArguments(function () {
  return arguments;
}()) ? baseIsArguments : function (value) {
  return isObjectLike(value) && hasOwnProperty$1.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
};

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

/** Detect free variable `exports`. */

var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */

var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;
/** Detect the popular CommonJS extension `module.exports`. */

var moduleExports = freeModule && freeModule.exports === freeExports;
/** Built-in value references. */

var Buffer = moduleExports ? root.Buffer : undefined;
/* Built-in method references for those with the same name as other `lodash` methods. */

var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */

var isBuffer = nativeIsBuffer || stubFalse;

/** `Object#toString` result references. */

var argsTag$1 = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag$1 = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';
var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';
/** Used to identify `toStringTag` values of typed arrays. */

var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag$1] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag$1] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */

function baseIsTypedArray(value) {
  return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function (value) {
    return func(value);
  };
}

/** Detect free variable `exports`. */

var freeExports$1 = typeof exports == 'object' && exports && !exports.nodeType && exports;
/** Detect free variable `module`. */

var freeModule$1 = freeExports$1 && typeof module == 'object' && module && !module.nodeType && module;
/** Detect the popular CommonJS extension `module.exports`. */

var moduleExports$1 = freeModule$1 && freeModule$1.exports === freeExports$1;
/** Detect free variable `process` from Node.js. */

var freeProcess = moduleExports$1 && freeGlobal.process;
/** Used to access faster Node.js helpers. */

var nodeUtil = function () {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule$1 && freeModule$1.require && freeModule$1.require('util').types;

    if (types) {
      return types;
    } // Legacy `process.binding('util')` for Node.js < 10.


    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}();

/* Node.js helper references. */

var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */

var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/** Used for built-in method references. */

var objectProto$4 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$2 = objectProto$4.hasOwnProperty;
/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */

function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty$2.call(value, key)) && !(skipIndexes && ( // Safari 9 has enumerable `arguments.length` in strict mode.
    key == 'length' || // Node.js 0.10 has enumerable non-index properties on buffers.
    isBuff && (key == 'offset' || key == 'parent') || // PhantomJS 2 has enumerable non-index properties on typed arrays.
    isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset') || // Skip index properties.
    isIndex(key, length)))) {
      result.push(key);
    }
  }

  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function (arg) {
    return func(transform(arg));
  };
}

/* Built-in method references for those with the same name as other `lodash` methods. */

var nativeKeys = overArg(Object.keys, Object);

/** Used for built-in method references. */

var objectProto$5 = Object.prototype;
/** Used to check objects for own properties. */

var hasOwnProperty$3 = objectProto$5.hasOwnProperty;
/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */

function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }

  var result = [];

  for (var key in Object(object)) {
    if (hasOwnProperty$3.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }

  return result;
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */

function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */

function toString(value) {
  return value == null ? '' : baseToString(value);
}

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function (object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];

      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }

    return object;
  };
}

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */

var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */

function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;
/**
 * The base implementation of `_.inRange` which doesn't coerce arguments.
 *
 * @private
 * @param {number} number The number to check.
 * @param {number} start The start of the range.
 * @param {number} end The end of the range.
 * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
 */

function baseInRange(number, start, end) {
  return number >= nativeMin(start, end) && number < nativeMax(start, end);
}

/**
 * Checks if `n` is between `start` and up to, but not including, `end`. If
 * `end` is not specified, it's set to `start` with `start` then set to `0`.
 * If `start` is greater than `end` the params are swapped to support
 * negative ranges.
 *
 * @static
 * @memberOf _
 * @since 3.3.0
 * @category Number
 * @param {number} number The number to check.
 * @param {number} [start=0] The start of the range.
 * @param {number} end The end of the range.
 * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
 * @see _.range, _.rangeRight
 * @example
 *
 * _.inRange(3, 2, 4);
 * // => true
 *
 * _.inRange(4, 8);
 * // => true
 *
 * _.inRange(4, 2);
 * // => false
 *
 * _.inRange(2, 2);
 * // => false
 *
 * _.inRange(1.2, 2);
 * // => true
 *
 * _.inRange(5.2, 4);
 * // => false
 *
 * _.inRange(-3, -2, -6);
 * // => true
 */

function inRange(number, start, end) {
  start = toFinite(start);

  if (end === undefined) {
    end = start;
    start = 0;
  } else {
    end = toFinite(end);
  }

  number = toNumber(number);
  return baseInRange(number, start, end);
}

/**
 * The base implementation of `_.invert` and `_.invertBy` which inverts
 * `object` with values transformed by `iteratee` and set by `setter`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} setter The function to set `accumulator` values.
 * @param {Function} iteratee The iteratee to transform values.
 * @param {Object} accumulator The initial inverted object.
 * @returns {Function} Returns `accumulator`.
 */

function baseInverter(object, setter, iteratee, accumulator) {
  baseForOwn(object, function (value, key, object) {
    setter(accumulator, iteratee(value), key, object);
  });
  return accumulator;
}

/**
 * Creates a function like `_.invertBy`.
 *
 * @private
 * @param {Function} setter The function to set accumulator values.
 * @param {Function} toIteratee The function to resolve iteratees.
 * @returns {Function} Returns the new inverter function.
 */

function createInverter(setter, toIteratee) {
  return function (object, iteratee) {
    return baseInverter(object, setter, toIteratee(iteratee), {});
  };
}

/** Used for built-in method references. */

var objectProto$6 = Object.prototype;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */

var nativeObjectToString$2 = objectProto$6.toString;
/**
 * Creates an object composed of the inverted keys and values of `object`.
 * If `object` contains duplicate values, subsequent values overwrite
 * property assignments of previous values.
 *
 * @static
 * @memberOf _
 * @since 0.7.0
 * @category Object
 * @param {Object} object The object to invert.
 * @returns {Object} Returns the new inverted object.
 * @example
 *
 * var object = { 'a': 1, 'b': 2, 'c': 1 };
 *
 * _.invert(object);
 * // => { '1': 'c', '2': 'b' }
 */

var invert = createInverter(function (result, value, key) {
  if (value != null && typeof value.toString != 'function') {
    value = nativeObjectToString$2.call(value);
  }

  result[value] = key;
}, constant(identity));

/** `Object#toString` result references. */

var boolTag$1 = '[object Boolean]';
/**
 * Checks if `value` is classified as a boolean primitive or object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
 * @example
 *
 * _.isBoolean(false);
 * // => true
 *
 * _.isBoolean(null);
 * // => false
 */

function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag$1;
}

/** Used to generate unique IDs. */

var idCounter = 0;
/**
 * Generates a unique ID. If `prefix` is given, the ID is appended to it.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {string} [prefix=''] The value to prefix the ID with.
 * @returns {string} Returns the unique ID.
 * @example
 *
 * _.uniqueId('contact_');
 * // => 'contact_104'
 *
 * _.uniqueId();
 * // => '105'
 */

function uniqueId(prefix) {
  var id = ++idCounter;
  return toString(prefix) + id;
}

/**
 * Checks if the DOM is available to access and use
 */
function canUseDOM() {
  return !!(typeof window !== "undefined" && window.document && window.document.createElement);
}

/**
 * A test that ensures that all arguments are HTML Elements
 */

function isHTMLElement(...args) {
  return args.every(arg => arg instanceof HTMLElement);
}
/**
 * Returns all displayed elements inside of a root node that match a provided selector
 */

function getDisplayedNodes(rootNode, selector) {
  if (!isHTMLElement(rootNode)) {
    return;
  }

  const nodes = Array.from(rootNode.querySelectorAll(selector)); // offsetParent will be null if the element isn't currently displayed,
  // so this will allow us to operate only on visible nodes

  return nodes.filter(node => node.offsetParent !== null);
}
/**
 * Returns the nonce used in the page, if any.
 *
 * Based on https://github.com/cssinjs/jss/blob/master/packages/jss/src/DomRenderer.js
 */

function getNonce() {
  const node = document.querySelector('meta[property="csp-nonce"]');

  if (node) {
    return node.getAttribute("content");
  } else {
    return null;
  }
}
/**
 * Test if the document supports :focus-visible
 */


let _canUseFocusVisible;

function canUseFocusVisible() {
  if (isBoolean(_canUseFocusVisible)) {
    return _canUseFocusVisible;
  }

  if (!canUseDOM()) {
    _canUseFocusVisible = false;
    return _canUseFocusVisible;
  } // Check to see if the document supports the focus-visible element


  const styleElement = document.createElement("style"); // If nonces are present on the page, use it when creating the style element
  // to test focus-visible support.

  const styleNonce = getNonce();

  if (styleNonce !== null) {
    styleElement.setAttribute("nonce", styleNonce);
  }

  document.head.appendChild(styleElement);

  try {
    styleElement.sheet.insertRule("foo:focus-visible {color:inherit}", 0);
    _canUseFocusVisible = true;
  } catch (e) {
    _canUseFocusVisible = false;
  } finally {
    document.head.removeChild(styleElement);
  }

  return _canUseFocusVisible;
}

/**
 * This set of exported strings reference https://developer.mozilla.org/en-US/docs/Web/Events
 * and should include all non-deprecated and non-experimental Standard events
 */
const eventFocus = "focus";
const eventFocusIn = "focusin";
const eventFocusOut = "focusout";
const eventKeyDown = "keydown";
const eventResize = "resize";
const eventScroll = "scroll";

/*
 * Key Code values
 * @deprecated - use individual keycode exports
 */
var KeyCodes;

(function (KeyCodes) {
  KeyCodes[KeyCodes["alt"] = 18] = "alt";
  KeyCodes[KeyCodes["arrowDown"] = 40] = "arrowDown";
  KeyCodes[KeyCodes["arrowLeft"] = 37] = "arrowLeft";
  KeyCodes[KeyCodes["arrowRight"] = 39] = "arrowRight";
  KeyCodes[KeyCodes["arrowUp"] = 38] = "arrowUp";
  KeyCodes[KeyCodes["back"] = 8] = "back";
  KeyCodes[KeyCodes["backSlash"] = 220] = "backSlash";
  KeyCodes[KeyCodes["break"] = 19] = "break";
  KeyCodes[KeyCodes["capsLock"] = 20] = "capsLock";
  KeyCodes[KeyCodes["closeBracket"] = 221] = "closeBracket";
  KeyCodes[KeyCodes["colon"] = 186] = "colon";
  KeyCodes[KeyCodes["colon2"] = 59] = "colon2";
  KeyCodes[KeyCodes["comma"] = 188] = "comma";
  KeyCodes[KeyCodes["ctrl"] = 17] = "ctrl";
  KeyCodes[KeyCodes["delete"] = 46] = "delete";
  KeyCodes[KeyCodes["end"] = 35] = "end";
  KeyCodes[KeyCodes["enter"] = 13] = "enter";
  KeyCodes[KeyCodes["equals"] = 187] = "equals";
  KeyCodes[KeyCodes["equals2"] = 61] = "equals2";
  KeyCodes[KeyCodes["equals3"] = 107] = "equals3";
  KeyCodes[KeyCodes["escape"] = 27] = "escape";
  KeyCodes[KeyCodes["forwardSlash"] = 191] = "forwardSlash";
  KeyCodes[KeyCodes["function1"] = 112] = "function1";
  KeyCodes[KeyCodes["function10"] = 121] = "function10";
  KeyCodes[KeyCodes["function11"] = 122] = "function11";
  KeyCodes[KeyCodes["function12"] = 123] = "function12";
  KeyCodes[KeyCodes["function2"] = 113] = "function2";
  KeyCodes[KeyCodes["function3"] = 114] = "function3";
  KeyCodes[KeyCodes["function4"] = 115] = "function4";
  KeyCodes[KeyCodes["function5"] = 116] = "function5";
  KeyCodes[KeyCodes["function6"] = 117] = "function6";
  KeyCodes[KeyCodes["function7"] = 118] = "function7";
  KeyCodes[KeyCodes["function8"] = 119] = "function8";
  KeyCodes[KeyCodes["function9"] = 120] = "function9";
  KeyCodes[KeyCodes["home"] = 36] = "home";
  KeyCodes[KeyCodes["insert"] = 45] = "insert";
  KeyCodes[KeyCodes["menu"] = 93] = "menu";
  KeyCodes[KeyCodes["minus"] = 189] = "minus";
  KeyCodes[KeyCodes["minus2"] = 109] = "minus2";
  KeyCodes[KeyCodes["numLock"] = 144] = "numLock";
  KeyCodes[KeyCodes["numPad0"] = 96] = "numPad0";
  KeyCodes[KeyCodes["numPad1"] = 97] = "numPad1";
  KeyCodes[KeyCodes["numPad2"] = 98] = "numPad2";
  KeyCodes[KeyCodes["numPad3"] = 99] = "numPad3";
  KeyCodes[KeyCodes["numPad4"] = 100] = "numPad4";
  KeyCodes[KeyCodes["numPad5"] = 101] = "numPad5";
  KeyCodes[KeyCodes["numPad6"] = 102] = "numPad6";
  KeyCodes[KeyCodes["numPad7"] = 103] = "numPad7";
  KeyCodes[KeyCodes["numPad8"] = 104] = "numPad8";
  KeyCodes[KeyCodes["numPad9"] = 105] = "numPad9";
  KeyCodes[KeyCodes["numPadDivide"] = 111] = "numPadDivide";
  KeyCodes[KeyCodes["numPadDot"] = 110] = "numPadDot";
  KeyCodes[KeyCodes["numPadMinus"] = 109] = "numPadMinus";
  KeyCodes[KeyCodes["numPadMultiply"] = 106] = "numPadMultiply";
  KeyCodes[KeyCodes["numPadPlus"] = 107] = "numPadPlus";
  KeyCodes[KeyCodes["openBracket"] = 219] = "openBracket";
  KeyCodes[KeyCodes["pageDown"] = 34] = "pageDown";
  KeyCodes[KeyCodes["pageUp"] = 33] = "pageUp";
  KeyCodes[KeyCodes["period"] = 190] = "period";
  KeyCodes[KeyCodes["print"] = 44] = "print";
  KeyCodes[KeyCodes["quote"] = 222] = "quote";
  KeyCodes[KeyCodes["scrollLock"] = 145] = "scrollLock";
  KeyCodes[KeyCodes["shift"] = 16] = "shift";
  KeyCodes[KeyCodes["space"] = 32] = "space";
  KeyCodes[KeyCodes["tab"] = 9] = "tab";
  KeyCodes[KeyCodes["tilde"] = 192] = "tilde";
  KeyCodes[KeyCodes["windowsLeft"] = 91] = "windowsLeft";
  KeyCodes[KeyCodes["windowsOpera"] = 219] = "windowsOpera";
  KeyCodes[KeyCodes["windowsRight"] = 92] = "windowsRight";
})(KeyCodes || (KeyCodes = {}));
const keyCodeArrowDown = 40;
const keyCodeArrowLeft = 37;
const keyCodeArrowRight = 39;
const keyCodeArrowUp = 38;
const keyCodeEnd = 35;
const keyCodeEnter = 13;

const keyCodeEscape = 27;
const keyCodeFunction2 = 113;
const keyCodeHome = 36;
const keyCodePageDown = 34;
const keyCodePageUp = 33;
const keyCodeSpace = 32;
const keyCodeTab = 9;
/**
 * String values for use with KeyboardEvent.key
 */

const keyArrowDown = "ArrowDown";
const keyArrowLeft = "ArrowLeft";
const keyArrowRight = "ArrowRight";
const keyArrowUp = "ArrowUp";
const keyEnter = "Enter";
const ArrowKeys = {
  ArrowDown: keyArrowDown,
  ArrowLeft: keyArrowLeft,
  ArrowRight: keyArrowRight,
  ArrowUp: keyArrowUp
};

/**
 * Expose ltr and rtl strings
 */
var Direction;

(function (Direction) {
  Direction["ltr"] = "ltr";
  Direction["rtl"] = "rtl";
})(Direction || (Direction = {}));

/**
 * This method keeps a given value within the bounds of a min and max value. If the value
 * is larger than the max, the minimum value will be returned. If the value is smaller than the minimum,
 * the maximum will be returned. Otherwise, the value is returned un-changed.
 */
function wrapInBounds(min, max, value) {
  if (value < min) {
    return max;
  } else if (value > max) {
    return min;
  }

  return value;
}
/**
 * Ensures that a value is between a min and max value. If value is lower than min, min will be returned.
 * If value is greater than max, max will be retured.
 */

function limit(min, max, value) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Define system colors for use in CSS stylesheets.
 *
 * https://drafts.csswg.org/css-color/#css-system-colors
 */
var SystemColors;

(function (SystemColors) {
  SystemColors["Canvas"] = "Canvas";
  SystemColors["CanvasText"] = "CanvasText";
  SystemColors["LinkText"] = "LinkText";
  SystemColors["VisitedText"] = "VisitedText";
  SystemColors["ActiveText"] = "ActiveText";
  SystemColors["ButtonFace"] = "ButtonFace";
  SystemColors["ButtonText"] = "ButtonText";
  SystemColors["Field"] = "Field";
  SystemColors["FieldText"] = "FieldText";
  SystemColors["Highlight"] = "Highlight";
  SystemColors["HighlightText"] = "HighlightText";
  SystemColors["GrayText"] = "GrayText";
})(SystemColors || (SystemColors = {}));

/**
 * Expand mode for {@link Accordion}
 * @public
 */

var AccordionExpandMode;

(function (AccordionExpandMode) {
  /**
   * Designates only a single {@link @microsoft/fast-foundation#(AccordionItem:class) } can be open a time.
   */
  AccordionExpandMode["single"] = "single";
  /**
   * Designates multiple {@link @microsoft/fast-foundation#(AccordionItem:class) | AccordionItems} can be open simultaneously.
   */

  AccordionExpandMode["multi"] = "multi";
})(AccordionExpandMode || (AccordionExpandMode = {}));
/**
 * An Accordion Custom HTML Element
 * Implements {@link https://www.w3.org/TR/wai-aria-practices-1.1/#accordion | ARIA Accordion}.
 * @public
 *
 * @remarks
 * Designed to be used with {@link @microsoft/fast-foundation#accordionTemplate} and {@link @microsoft/fast-foundation#(AccordionItem:class)}.
 */


class Accordion extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * Controls the expand mode of the Accordion, either allowing
     * single or multiple item expansion.
     * @public
     *
     * @remarks
     * HTML attribute: expand-mode
     */

    this.expandmode = AccordionExpandMode.multi;
    this.activeItemIndex = 0;

    this.change = () => {
      this.$emit("change");
    };

    this.setItems = () => {
      this.accordionIds = this.getItemIds();
      this.accordionItems.forEach((item, index) => {
        if (item instanceof AccordionItem) {
          item.addEventListener("change", this.activeItemChange);

          if (this.isSingleExpandMode()) {
            this.activeItemIndex !== index ? item.expanded = false : item.expanded = true;
          }
        }

        const itemId = this.accordionIds[index];
        item.setAttribute("id", typeof itemId !== "string" ? `accordion-${index + 1}` : itemId);
        this.activeid = this.accordionIds[this.activeItemIndex];
        item.addEventListener("keydown", this.handleItemKeyDown);
        item.addEventListener("focus", this.handleItemFocus);
      });
    };

    this.removeItemListeners = oldValue => {
      oldValue.forEach((item, index) => {
        item.removeEventListener("change", this.activeItemChange);
        item.removeEventListener("keydown", this.handleItemKeyDown);
        item.removeEventListener("focus", this.handleItemFocus);
      });
    };

    this.activeItemChange = event => {
      const selectedItem = event.target;

      if (this.isSingleExpandMode()) {
        this.resetItems();
        event.target.expanded = true;
      }

      this.activeid = event.target.getAttribute("id");
      this.activeItemIndex = Array.from(this.accordionItems).indexOf(selectedItem);
      this.change();
    };

    this.handleItemKeyDown = event => {
      // only handle the keydown if the event target is the accordion item
      // prevents arrow keys from moving focus to accordion headers when focus is on accordion item panel content
      if (event.target !== event.currentTarget) {
        return;
      }

      const keyCode = event.keyCode;
      this.accordionIds = this.getItemIds();

      switch (keyCode) {
        case keyCodeArrowUp:
          event.preventDefault();
          this.adjust(-1);
          break;

        case keyCodeArrowDown:
          event.preventDefault();
          this.adjust(1);
          break;

        case keyCodeHome:
          this.activeItemIndex = 0;
          this.focusItem();
          break;

        case keyCodeEnd:
          this.activeItemIndex = this.accordionItems.length - 1;
          this.focusItem();
          break;
      }
    };

    this.handleItemFocus = event => {
      // update the active item index if the focus moves to an accordion item via a different method other than the up and down arrow key actions
      // only do so if the focus is actually on the accordion item and not on any of its children
      if (event.target === event.currentTarget) {
        const focusedItem = event.target;
        const focusedIndex = this.activeItemIndex = Array.from(this.accordionItems).indexOf(focusedItem);

        if (this.activeItemIndex !== focusedIndex && focusedIndex !== -1) {
          this.activeItemIndex = focusedIndex;
          this.activeid = this.accordionIds[this.activeItemIndex];
        }
      }
    };
  }
  /**
   * @internal
   */


  accordionItemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.removeItemListeners(oldValue);
      this.accordionIds = this.getItemIds();
      this.setItems();
    }
  }

  resetItems() {
    this.accordionItems.forEach((item, index) => {
      item.expanded = false;
    });
  }

  getItemIds() {
    return this.accordionItems.map(accordionItem => {
      return accordionItem.getAttribute("id");
    });
  }

  isSingleExpandMode() {
    return this.expandmode === AccordionExpandMode.single;
  }

  adjust(adjustment) {
    this.activeItemIndex = wrapInBounds(0, this.accordionItems.length - 1, this.activeItemIndex + adjustment);
    this.focusItem();
  }

  focusItem() {
    const element = this.accordionItems[this.activeItemIndex];

    if (element instanceof AccordionItem) {
      element.expandbutton.focus();
    }
  }

}

__decorate([attr({
  attribute: "expand-mode"
})], Accordion.prototype, "expandmode", void 0);

__decorate([observable], Accordion.prototype, "accordionItems", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Anchor:class)} component.
 * @public
 */

const anchorTemplate = (context, definition) => html`<a class="control" part="control" download="${x => x.download}" href="${x => x.href}" hreflang="${x => x.hreflang}" ping="${x => x.ping}" referrerpolicy="${x => x.referrerpolicy}" rel="${x => x.rel}" target="${x => x.target}" type="${x => x.type}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-expanded="${x => x.ariaExpanded}" aria-flowto="${x => x.ariaFlowto}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" ${ref("control")}>${startTemplate}<span class="content" part="content"><slot ${slotted("defaultSlottedContent")}></slot></span>${endTemplate}</a>`;

/**
 * Some states and properties are applicable to all host language elements regardless of whether a role is applied.
 * The following global states and properties are supported by all roles and by all base markup elements.
 * {@link https://www.w3.org/TR/wai-aria-1.1/#global_states}
 *
 * This is intended to be used as a mixin. Be sure you extend FASTElement.
 *
 * @public
 */

class ARIAGlobalStatesAndProperties {}

__decorate([attr({
  attribute: "aria-atomic",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaAtomic", void 0);

__decorate([attr({
  attribute: "aria-busy",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaBusy", void 0);

__decorate([attr({
  attribute: "aria-controls",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaControls", void 0);

__decorate([attr({
  attribute: "aria-current",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaCurrent", void 0);

__decorate([attr({
  attribute: "aria-describedby",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaDescribedby", void 0);

__decorate([attr({
  attribute: "aria-details",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaDetails", void 0);

__decorate([attr({
  attribute: "aria-disabled",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaDisabled", void 0);

__decorate([attr({
  attribute: "aria-errormessage",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaErrormessage", void 0);

__decorate([attr({
  attribute: "aria-flowto",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaFlowto", void 0);

__decorate([attr({
  attribute: "aria-haspopup",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaHaspopup", void 0);

__decorate([attr({
  attribute: "aria-hidden",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaHidden", void 0);

__decorate([attr({
  attribute: "aria-invalid",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaInvalid", void 0);

__decorate([attr({
  attribute: "aria-keyshortcuts",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaKeyshortcuts", void 0);

__decorate([attr({
  attribute: "aria-label",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaLabel", void 0);

__decorate([attr({
  attribute: "aria-labelledby",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaLabelledby", void 0);

__decorate([attr({
  attribute: "aria-live",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaLive", void 0);

__decorate([attr({
  attribute: "aria-owns",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaOwns", void 0);

__decorate([attr({
  attribute: "aria-relevant",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaRelevant", void 0);

__decorate([attr({
  attribute: "aria-roledescription",
  mode: "fromView"
})], ARIAGlobalStatesAndProperties.prototype, "ariaRoledescription", void 0);

/**
 * An Anchor Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a | <a> element }.
 *
 * @public
 */

class Anchor extends FoundationElement {}

__decorate([attr], Anchor.prototype, "download", void 0);

__decorate([attr], Anchor.prototype, "href", void 0);

__decorate([attr], Anchor.prototype, "hreflang", void 0);

__decorate([attr], Anchor.prototype, "ping", void 0);

__decorate([attr], Anchor.prototype, "referrerpolicy", void 0);

__decorate([attr], Anchor.prototype, "rel", void 0);

__decorate([attr], Anchor.prototype, "target", void 0);

__decorate([attr], Anchor.prototype, "type", void 0);

__decorate([observable], Anchor.prototype, "defaultSlottedContent", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA link role
 *
 * @public
 */


class DelegatesARIALink {}

__decorate([attr({
  attribute: "aria-expanded",
  mode: "fromView"
})], DelegatesARIALink.prototype, "ariaExpanded", void 0);

applyMixins(DelegatesARIALink, ARIAGlobalStatesAndProperties);
applyMixins(Anchor, StartEnd, DelegatesARIALink);

/**
 * The template for the {@link @microsoft/fast-foundation#(AnchoredRegion:class)} component.
 * @beta
 */

const anchoredRegionTemplate = (context, definition) => html`<template class="${x => x.initialLayoutComplete ? "loaded" : ""}">${when(x => x.initialLayoutComplete, html`<slot></slot>`)}</template>`;

/**
 * Retrieves the "composed parent" element of a node, ignoring DOM tree boundaries.
 * When the parent of a node is a shadow-root, it will return the host
 * element of the shadow root. Otherwise it will return the parent node or null if
 * no parent node exists.
 * @param element - The element for which to retrieve the composed parent
 *
 * @public
 */
function composedParent(element) {
  const parentNode = element.parentElement;

  if (parentNode) {
    return parentNode;
  } else {
    const rootNode = element.getRootNode();

    if (rootNode.host instanceof HTMLElement) {
      // this is shadow-root
      return rootNode.host;
    }
  }

  return null;
}

/**
 * Determines if the reference element contains the test element in a "composed" DOM tree that
 * ignores shadow DOM boundaries.
 *
 * Returns true of the test element is a descendent of the reference, or exist in
 * a shadow DOM that is a logical descendent of the reference. Otherwise returns false.
 * @param reference - The element to test for containment against.
 * @param test - The element being tested for containment.
 *
 * @public
 */

function composedContains(reference, test) {
  let current = test;

  while (current !== null) {
    if (current === reference) {
      return true;
    }

    current = composedParent(current);
  }

  return false;
}

/**
 * An abstract behavior to react to media queries. Implementations should implement
 * the `constructListener` method to perform some action based on media query changes.
 *
 * @public
 */
class MatchMediaBehavior {
  /**
   *
   * @param query - The media query to operate from.
   */
  constructor(query) {
    /**
     * The behavior needs to operate on element instances but elements might share a behavior instance.
     * To ensure proper attachment / detachment per instance, we construct a listener for
     * each bind invocation and cache the listeners by element reference.
     */
    this.listenerCache = new WeakMap();
    this.query = query;
  }
  /**
   * Binds the behavior to the element.
   * @param source - The element for which the behavior is bound.
   */


  bind(source) {
    const {
      query
    } = this;
    const listener = this.constructListener(source); // Invoke immediately to add if the query currently matches

    listener.bind(query)();
    query.addListener(listener);
    this.listenerCache.set(source, listener);
  }
  /**
   * Unbinds the behavior from the element.
   * @param source - The element for which the behavior is unbinding.
   */


  unbind(source) {
    const listener = this.listenerCache.get(source);

    if (listener) {
      this.query.removeListener(listener);
      this.listenerCache.delete(source);
    }
  }

}
/**
 * A behavior to add or remove a stylesheet from an element based on a media query. The behavior ensures that
 * styles are applied while the a query matches the environment and that styles are not applied if the query does
 * not match the environment.
 *
 * @public
 */

class MatchMediaStyleSheetBehavior extends MatchMediaBehavior {
  /**
   * Constructs a {@link MatchMediaStyleSheetBehavior} instance.
   * @param query - The media query to operate from.
   * @param styles - The styles to coordinate with the query.
   */
  constructor(query, styles) {
    super(query);
    this.styles = styles;
  }
  /**
   * Defines a function to construct {@link MatchMediaStyleSheetBehavior | MatchMediaStyleSheetBehaviors} for
   * a provided query.
   * @param query - The media query to operate from.
   *
   * @public
   * @example
   *
   * ```ts
   * import { css } from "@microsoft/fast-element";
   * import { MatchMediaStyleSheetBehavior } from "@microsoft/fast-foundation";
   *
   * const landscapeBehavior = MatchMediaStyleSheetBehavior.with(
   *   window.matchMedia("(orientation: landscape)")
   * );
   * const styles = css`
   *   :host {
   *     width: 200px;
   *     height: 400px;
   *   }
   * `
   * .withBehaviors(landscapeBehavior(css`
   *   :host {
   *     width: 400px;
   *     height: 200px;
   *   }
   * `))
   * ```
   */


  static with(query) {
    return styles => {
      return new MatchMediaStyleSheetBehavior(query, styles);
    };
  }
  /**
   * Constructs a match-media listener for a provided element.
   * @param source - the element for which to attach or detach styles.
   * @internal
   */


  constructListener(source) {
    let attached = false;
    const styles = this.styles;
    return function listener() {
      const {
        matches
      } = this;

      if (matches && !attached) {
        source.$fastController.addStyles(styles);
        attached = matches;
      } else if (!matches && attached) {
        source.$fastController.removeStyles(styles);
        attached = matches;
      }
    };
  }
  /**
   * Unbinds the behavior from the element.
   * @param source - The element for which the behavior is unbinding.
   * @internal
   */


  unbind(source) {
    super.unbind(source);
    source.$fastController.removeStyles(this.styles);
  }

}
/**
 * This can be used to construct a behavior to apply a forced-colors only stylesheet.
 * @public
 */

const forcedColorsStylesheetBehavior = MatchMediaStyleSheetBehavior.with(window.matchMedia("(forced-colors)"));
/**
 * This can be used to construct a behavior to apply a prefers color scheme: dark only stylesheet.
 * @public
 */

MatchMediaStyleSheetBehavior.with(window.matchMedia("(prefers-color-scheme: dark)"));
/**
 * This can be used to construct a behavior to apply a prefers color scheme: light only stylesheet.
 * @public
 */

MatchMediaStyleSheetBehavior.with(window.matchMedia("(prefers-color-scheme: light)"));

/**
 * A behavior to add or remove a stylesheet from an element based on a property. The behavior ensures that
 * styles are applied while the property matches and that styles are not applied if the property does
 * not match.
 *
 * @public
 */

class PropertyStyleSheetBehavior {
  /**
   * Constructs a {@link PropertyStyleSheetBehavior} instance.
   * @param propertyName - The property name to operate from.
   * @param value - The property value to operate from.
   * @param styles - The styles to coordinate with the property.
   */
  constructor(propertyName, value, styles) {
    this.propertyName = propertyName;
    this.value = value;
    this.styles = styles;
  }
  /**
   * Binds the behavior to the element.
   * @param elementInstance - The element for which the property is applied.
   */


  bind(elementInstance) {
    Observable.getNotifier(elementInstance).subscribe(this, this.propertyName);
    this.handleChange(elementInstance, this.propertyName);
  }
  /**
   * Unbinds the behavior from the element.
   * @param source - The element for which the behavior is unbinding.
   * @internal
   */


  unbind(source) {
    Observable.getNotifier(source).unsubscribe(this, this.propertyName);
    source.$fastController.removeStyles(this.styles);
  }
  /**
   * Change event for the provided element.
   * @param source - the element for which to attach or detach styles.
   * @internal
   */


  handleChange(source, key) {
    if (source[key] === this.value) {
      source.$fastController.addStyles(this.styles);
    } else {
      source.$fastController.removeStyles(this.styles);
    }
  }

}

/**
 * The CSS value for disabled cursors.
 * @public
 */
const disabledCursor = "not-allowed";

/**
 * A CSS fragment to set `display: none;` when the host is hidden using the [hidden] attribute.
 * @public
 */
const hidden = `:host([hidden]){display:none}`;
/**
 * Applies a CSS display property.
 * Also adds CSS rules to not display the element when the [hidden] attribute is applied to the element.
 * @param display - The CSS display property value
 * @public
 */

function display(displayValue) {
  return `${hidden}:host{display:${displayValue}}`;
}

/**
 * The string representing the focus selector to be used. Value
 * will be "focus-visible" when https://drafts.csswg.org/selectors-4/#the-focus-visible-pseudo
 * is supported and "focus" when it is not.
 *
 * @public
 */

const focusVisible = canUseFocusVisible() ? "focus-visible" : "focus";

/**
 * a method to determine the current localization direction of the view
 * @param rootNode - the HTMLElement to begin the query from, usually "this" when used in a component controller
 * @public
 */

const getDirection = rootNode => {
  const dirNode = rootNode.closest("[dir]");
  return dirNode !== null && dirNode.dir === "rtl" ? Direction.rtl : Direction.ltr;
};

/**
 * a method to filter out any whitespace _only_ nodes, to be used inside a template
 * @param value - The Node that is being inspected
 * @param index - The index of the node within the array
 * @param array - The Node array that is being filtered
 *
 * @public
 */
function whitespaceFilter(value, index, array) {
  return value.nodeType !== Node.TEXT_NODE ? true : typeof value.nodeValue === "string" && !!value.nodeValue.trim().length;
}

/**
 *  A service to batch intersection event callbacks so multiple elements can share a single observer
 *
 * @public
 */

class IntersectionService {
  constructor() {
    this.intersectionDetector = null;
    this.observedElements = new Map();
    /**
     * Request the position of a target element
     *
     * @internal
     */

    this.requestPosition = (target, callback) => {
      var _a;

      if (this.intersectionDetector === null) {
        return;
      }

      if (this.observedElements.has(target)) {
        (_a = this.observedElements.get(target)) === null || _a === void 0 ? void 0 : _a.push(callback);
        return;
      }

      this.observedElements.set(target, [callback]);
      this.intersectionDetector.observe(target);
    };
    /**
     * Cancel a position request
     *
     * @internal
     */


    this.cancelRequestPosition = (target, callback) => {
      const callbacks = this.observedElements.get(target);

      if (callbacks !== undefined) {
        const callBackIndex = callbacks.indexOf(callback);

        if (callBackIndex !== -1) {
          callbacks.splice(callBackIndex, 1);
        }
      }
    };
    /**
     * initialize intersection detector
     */


    this.initializeIntersectionDetector = () => {
      if (!$global.IntersectionObserver) {
        //intersection observer not supported
        return;
      }

      this.intersectionDetector = new IntersectionObserver(this.handleIntersection, {
        root: null,
        rootMargin: "0px",
        threshold: [0, 1]
      });
    };
    /**
     *  Handle intersections
     */


    this.handleIntersection = entries => {
      if (this.intersectionDetector === null) {
        return;
      }

      const pendingCallbacks = [];
      const pendingCallbackParams = []; // go through the entries to build a list of callbacks and params for each

      entries.forEach(entry => {
        var _a; // stop watching this element until we get new update requests for it


        (_a = this.intersectionDetector) === null || _a === void 0 ? void 0 : _a.unobserve(entry.target);
        const thisElementCallbacks = this.observedElements.get(entry.target);

        if (thisElementCallbacks !== undefined) {
          thisElementCallbacks.forEach(callback => {
            let targetCallbackIndex = pendingCallbacks.indexOf(callback);

            if (targetCallbackIndex === -1) {
              targetCallbackIndex = pendingCallbacks.length;
              pendingCallbacks.push(callback);
              pendingCallbackParams.push([]);
            }

            pendingCallbackParams[targetCallbackIndex].push(entry);
          });
          this.observedElements.delete(entry.target);
        }
      }); // execute callbacks

      pendingCallbacks.forEach((callback, index) => {
        callback(pendingCallbackParams[index]);
      });
    };

    this.initializeIntersectionDetector();
  }

}

/**
 * An anchored region Custom HTML Element.
 *
 * @beta
 */

class AnchoredRegion extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The HTML ID of the anchor element this region is positioned relative to
     *
     * @beta
     * @remarks
     * HTML Attribute: anchor
     */

    this.anchor = "";
    /**
     * The HTML ID of the viewport element this region is positioned relative to
     *
     * @beta
     * @remarks
     * HTML Attribute: anchor
     */

    this.viewport = "";
    /**
     * Sets what logic the component uses to determine horizontal placement.
     * 'locktodefault' forces the default position
     * 'dynamic' decides placement based on available space
     * 'uncontrolled' does not control placement on the horizontal axis
     *
     * @beta
     * @remarks
     * HTML Attribute: horizontal-positioning-mode
     */

    this.horizontalPositioningMode = "uncontrolled";
    /**
     * The default horizontal position of the region relative to the anchor element
     *
     * @beta
     * @remarks
     * HTML Attribute: horizontal-default-position
     */

    this.horizontalDefaultPosition = "unset";
    /**
     * Whether the region overlaps the anchor on the horizontal axis
     *
     * @beta
     * @remarks
     * HTML Attribute: horizontal-inset
     */

    this.horizontalInset = false;
    /**
     * Defines how the width of the region is calculated
     *
     * @beta
     * @remarks
     * HTML Attribute: horizontal-scaling
     */

    this.horizontalScaling = "content";
    /**
     * Sets what logic the component uses to determine vertical placement.
     * 'locktodefault' forces the default position
     * 'dynamic' decides placement based on available space
     * 'uncontrolled' does not control placement on the vertical axis
     *
     * @beta
     * @remarks
     * HTML Attribute: vertical-positioning-mode
     */

    this.verticalPositioningMode = "uncontrolled";
    /**
     * The default vertical position of the region relative to the anchor element
     *
     * @beta
     * @remarks
     * HTML Attribute: vertical-default-position
     */

    this.verticalDefaultPosition = "unset";
    /**
     * Whether the region overlaps the anchor on the vertical axis
     *
     * @beta
     * @remarks
     * HTML Attribute: vertical-inset
     */

    this.verticalInset = false;
    /**
     * Defines how the height of the region is calculated
     *
     * @beta
     * @remarks
     * HTML Attribute: vertical-scaling
     */

    this.verticalScaling = "content";
    /**
     * Whether the region is positioned using css "position: fixed".
     * Otherwise the region uses "position: absolute".
     * Fixed placement allows the region to break out of parent containers,
     *
     * @beta
     * @remarks
     * HTML Attribute: fixed-placement
     */

    this.fixedPlacement = false;
    /**
     *
     *
     * @beta
     * @remarks
     * HTML Attribute: auto-update-mode
     */

    this.autoUpdateMode = "anchor";
    /**
     * The HTML element being used as the anchor
     *
     * @beta
     */

    this.anchorElement = null;
    /**
     * The HTML element being used as the viewport
     *
     * @beta
     */

    this.viewportElement = null;
    /**
     * indicates that an initial positioning pass on layout has completed
     *
     * @internal
     */

    this.initialLayoutComplete = false;
    this.resizeDetector = null;
    this.pendingPositioningUpdate = false;
    this.pendingLayoutUpdate = false;
    this.pendingReset = false;
    this.currentDirection = Direction.ltr;
    this.regionVisible = false; // defines how big a difference in pixels there must be between states to
    // justify a layout update that affects the dom (prevents repeated sub-pixel corrections)

    this.updateThreshold = 0.5;
    /**
     * update position
     */

    this.update = () => {
      if (this.viewportRect === null || this.regionDimension === null) {
        this.requestLayoutUpdate();
        return;
      }

      this.requestPositionUpdates();
    };
    /**
     * Public function to enable authors to update the layout based on changes in anchor offset without resorting
     * to a more epensive update call
     */


    this.updateAnchorOffset = (horizontalOffsetDelta, verticalOffsetDelta) => {
      this.anchorLeft = this.anchorLeft + horizontalOffsetDelta;
      this.anchorRight = this.anchorRight + horizontalOffsetDelta;
      this.anchorTop = this.anchorTop + verticalOffsetDelta;
      this.anchorBottom = this.anchorBottom + verticalOffsetDelta;
      this.updateLayout();
    };
    /**
     * starts observers
     */


    this.startObservers = () => {
      this.stopObservers();

      if (this.anchorElement === null) {
        return;
      }

      this.requestPositionUpdates();

      if (this.resizeDetector !== null) {
        this.resizeDetector.observe(this.anchorElement);
      }
    };
    /**
     * get position updates
     */


    this.requestPositionUpdates = () => {
      if (this.anchorElement === null || this.pendingPositioningUpdate) {
        return;
      }

      AnchoredRegion.intersectionService.requestPosition(this, this.handleIntersection);
      AnchoredRegion.intersectionService.requestPosition(this.anchorElement, this.handleIntersection);

      if (this.viewportElement !== null) {
        AnchoredRegion.intersectionService.requestPosition(this.viewportElement, this.handleIntersection);
      }

      this.pendingPositioningUpdate = true;
    };
    /**
     * stops observers
     */


    this.stopObservers = () => {
      if (this.pendingPositioningUpdate) {
        this.pendingPositioningUpdate = false;
        AnchoredRegion.intersectionService.cancelRequestPosition(this, this.handleIntersection);

        if (this.anchorElement !== null) {
          AnchoredRegion.intersectionService.cancelRequestPosition(this.anchorElement, this.handleIntersection);
        }

        if (this.viewportElement !== null) {
          AnchoredRegion.intersectionService.cancelRequestPosition(this.viewportElement, this.handleIntersection);
        }
      }

      if (this.resizeDetector !== null) {
        this.resizeDetector.disconnect();
      }
    };
    /**
     * Gets the viewport element by id, or defaults to document root
     */


    this.getViewport = () => {
      if (typeof this.viewport !== "string" || this.viewport === "") {
        return document.documentElement;
      }

      return document.getElementById(this.viewport);
    };
    /**
     *  Gets the anchor element by id
     */


    this.getAnchor = () => {
      return document.getElementById(this.anchor);
    };
    /**
     *  Handle intersections
     */


    this.handleIntersection = entries => {
      if (!this.pendingPositioningUpdate) {
        return;
      }

      this.pendingPositioningUpdate = false;

      if (!this.applyIntersectionEntries(entries) || this.regionRect === null) {
        return;
      }

      if (!this.initialLayoutComplete) {
        this.containingBlockHeight = this.regionRect.height;
        this.containingBlockWidth = this.regionRect.width;
      }

      this.updateRegionOffset(this.regionRect);
      this.updateLayout();
    };
    /**
     *  iterate through intersection entries and apply data
     */


    this.applyIntersectionEntries = entries => {
      const regionEntry = entries.find(x => x.target === this);
      const anchorEntry = entries.find(x => x.target === this.anchorElement);
      const viewportEntry = entries.find(x => x.target === this.viewportElement);

      if (regionEntry === undefined || viewportEntry === undefined || anchorEntry === undefined) {
        return false;
      } // don't update the dom unless there is a significant difference in rect positions


      if (this.regionRect === null || this.anchorRect === null || this.viewportRect === null || this.isRectDifferent(this.anchorRect, anchorEntry.boundingClientRect) || this.isRectDifferent(this.viewportRect, viewportEntry.boundingClientRect) || this.isRectDifferent(this.regionRect, regionEntry.boundingClientRect)) {
        this.regionRect = regionEntry.boundingClientRect;
        this.anchorRect = anchorEntry.boundingClientRect;
        this.viewportRect = viewportEntry.boundingClientRect;
        this.handleRegionIntersection(regionEntry);
        this.handleAnchorIntersection(anchorEntry);
        return true;
      }

      return false;
    };
    /**
     *  compare rects to see if there is enough change to justify a DOM update
     */


    this.isRectDifferent = (rectA, rectB) => {
      if (Math.abs(rectA.top - rectB.top) > this.updateThreshold || Math.abs(rectA.right - rectB.right) > this.updateThreshold || Math.abs(rectA.bottom - rectB.bottom) > this.updateThreshold || Math.abs(rectA.left - rectB.left) > this.updateThreshold) {
        return true;
      }

      return false;
    };
    /**
     *  Update data based on anchor intersections
     */


    this.handleAnchorIntersection = anchorEntry => {
      this.anchorTop = anchorEntry.boundingClientRect.top;
      this.anchorRight = anchorEntry.boundingClientRect.right;
      this.anchorBottom = anchorEntry.boundingClientRect.bottom;
      this.anchorLeft = anchorEntry.boundingClientRect.left;
      this.anchorHeight = anchorEntry.boundingClientRect.height;
      this.anchorWidth = anchorEntry.boundingClientRect.width;
    };
    /**
     *  Update data based on positioner intersections
     */


    this.handleRegionIntersection = regionEntry => {
      const regionRect = regionEntry.boundingClientRect;
      this.regionDimension = {
        height: regionRect.height,
        width: regionRect.width
      };
    };
    /**
     *  Handle resize events
     */


    this.handleResize = entries => {
      if (!this.initialLayoutComplete) {
        return;
      }

      this.update();
    };
    /**
     * resets the component
     */


    this.reset = () => {
      if (!this.pendingReset) {
        return;
      }

      this.pendingReset = false;

      if (this.anchorElement === null) {
        this.anchorElement = this.getAnchor();
      }

      if (this.viewportElement === null) {
        this.viewportElement = this.getViewport();
      }

      this.currentDirection = getDirection(this);
      this.startObservers();
    };
    /**
     *  Recalculate layout related state values
     */


    this.updateLayout = () => {
      this.pendingLayoutUpdate = false;
      let desiredVerticalPosition = "undefined";
      let desiredHorizontalPosition = "undefined";

      if (this.horizontalPositioningMode !== "uncontrolled") {
        const horizontalOptions = this.getHorizontalPositioningOptions();

        if (this.horizontalDefaultPosition !== "unset") {
          let dirCorrectedHorizontalDefaultPosition = this.horizontalDefaultPosition;

          if (dirCorrectedHorizontalDefaultPosition === "start" || dirCorrectedHorizontalDefaultPosition === "end") {
            // if direction changes we reset the layout
            const newDirection = getDirection(this);

            if (newDirection !== this.currentDirection) {
              this.currentDirection = newDirection;
              this.initialize();
              return;
            }

            if (this.currentDirection === Direction.ltr) {
              dirCorrectedHorizontalDefaultPosition = dirCorrectedHorizontalDefaultPosition === "start" ? "left" : "right";
            } else {
              dirCorrectedHorizontalDefaultPosition = dirCorrectedHorizontalDefaultPosition === "start" ? "right" : "left";
            }
          }

          switch (dirCorrectedHorizontalDefaultPosition) {
            case "left":
              desiredHorizontalPosition = this.horizontalInset ? "insetLeft" : "left";
              break;

            case "right":
              desiredHorizontalPosition = this.horizontalInset ? "insetRight" : "right";
              break;
          }
        }

        const horizontalThreshold = this.horizontalThreshold !== undefined ? this.horizontalThreshold : this.regionDimension.width;

        if (desiredHorizontalPosition === "undefined" || !(this.horizontalPositioningMode === "locktodefault") && this.getAvailableWidth(desiredHorizontalPosition) < horizontalThreshold) {
          desiredHorizontalPosition = this.getAvailableWidth(horizontalOptions[0]) > this.getAvailableWidth(horizontalOptions[1]) ? horizontalOptions[0] : horizontalOptions[1];
        }
      }

      if (this.verticalPositioningMode !== "uncontrolled") {
        const verticalOptions = this.getVerticalPositioningOptions();

        if (this.verticalDefaultPosition !== "unset") {
          switch (this.verticalDefaultPosition) {
            case "top":
              desiredVerticalPosition = this.verticalInset ? "insetTop" : "top";
              break;

            case "bottom":
              desiredVerticalPosition = this.verticalInset ? "insetBottom" : "bottom";
              break;
          }
        }

        const verticalThreshold = this.verticalThreshold !== undefined ? this.verticalThreshold : this.regionDimension.height;

        if (desiredVerticalPosition === "undefined" || !(this.verticalPositioningMode === "locktodefault") && this.getAvailableHeight(desiredVerticalPosition) < verticalThreshold) {
          desiredVerticalPosition = this.getAvailableHeight(verticalOptions[0]) > this.getAvailableHeight(verticalOptions[1]) ? verticalOptions[0] : verticalOptions[1];
        }
      }

      const nextPositionerDimension = this.getNextRegionDimension(desiredHorizontalPosition, desiredVerticalPosition);
      const positionChanged = this.horizontalPosition !== desiredHorizontalPosition || this.verticalPosition !== desiredVerticalPosition;
      this.setHorizontalPosition(desiredHorizontalPosition, nextPositionerDimension);
      this.setVerticalPosition(desiredVerticalPosition, nextPositionerDimension);
      this.updateRegionStyle();

      if (!this.initialLayoutComplete) {
        this.initialLayoutComplete = true;
        this.requestPositionUpdates();
        return;
      }

      if (!this.regionVisible) {
        this.regionVisible = true;
        this.style.removeProperty("pointer-events");
        this.style.removeProperty("opacity");
        this.classList.toggle("loaded", true);
        this.$emit("loaded", this, {
          bubbles: false
        });
      }

      if (positionChanged) {
        // do a position check to ensure we're in the right spot
        // temporary until method for recalculating offsets on position changes improved
        this.requestPositionUpdates(); // emit change event

        this.$emit("positionchange", this, {
          bubbles: false
        });
      }
    };
    /**
     *  Updates the style string applied to the region element as well as the css classes attached
     *  to the root element
     */


    this.updateRegionStyle = () => {
      this.classList.toggle("top", this.verticalPosition === "top");
      this.classList.toggle("bottom", this.verticalPosition === "bottom");
      this.classList.toggle("inset-top", this.verticalPosition === "insetTop");
      this.classList.toggle("inset-bottom", this.verticalPosition === "insetBottom");
      this.classList.toggle("left", this.horizontalPosition === "left");
      this.classList.toggle("right", this.horizontalPosition === "right");
      this.classList.toggle("inset-left", this.horizontalPosition === "insetLeft");
      this.classList.toggle("inset-right", this.horizontalPosition === "insetRight");
      this.style.position = this.fixedPlacement ? "fixed" : "absolute";
      this.style.transformOrigin = `${this.yTransformOrigin} ${this.xTransformOrigin}`;

      if (this.horizontalPositioningMode === "uncontrolled") {
        this.style.width = "unset";
        this.style.right = "unset";
        this.style.left = "unset";
      } else {
        this.style.width = this.regionWidth;
        this.style.right = this.regionRight;
        this.style.left = this.regionLeft;
      }

      if (this.verticalPositioningMode === "uncontrolled") {
        this.style.height = "unset";
        this.style.top = "unset";
        this.style.bottom = "unset";
      } else {
        this.style.height = this.regionHeight;
        this.style.top = this.regionTop;
        this.style.bottom = this.regionBottom;
      }
    };
    /**
     * Get horizontal positioning state based on desired position
     */


    this.setHorizontalPosition = (desiredHorizontalPosition, nextPositionerDimension) => {
      let right = null;
      let left = null;
      let xTransformOrigin = "left";

      switch (desiredHorizontalPosition) {
        case "left":
          xTransformOrigin = "right";
          right = this.containingBlockWidth - this.baseHorizontalOffset;
          break;

        case "insetLeft":
          xTransformOrigin = "right";
          right = this.containingBlockWidth - this.anchorWidth - this.baseHorizontalOffset;
          break;

        case "insetRight":
          xTransformOrigin = "left";
          left = this.baseHorizontalOffset;
          break;

        case "right":
          xTransformOrigin = "left";
          left = this.anchorWidth + this.baseHorizontalOffset;
          break;
      }

      this.xTransformOrigin = xTransformOrigin;
      this.regionRight = right === null ? "unset" : `${right}px`;
      this.regionLeft = left === null ? "unset" : `${left}px`;
      this.horizontalPosition = desiredHorizontalPosition;

      switch (this.horizontalScaling) {
        case "anchor":
          this.regionWidth = `${this.anchorWidth}px`;
          break;

        case "fill":
          this.regionWidth = `${nextPositionerDimension.width}px`;
          break;

        case "content":
          this.regionWidth = "unset";
          break;
      }
    };
    /**
     * Get vertical positioning state based on desired position
     */


    this.setVerticalPosition = (desiredVerticalPosition, nextPositionerDimension) => {
      let top = null;
      let bottom = null;
      let yTransformOrigin = "top";

      switch (desiredVerticalPosition) {
        case "top":
          yTransformOrigin = "bottom";
          bottom = this.containingBlockHeight - this.baseVerticalOffset;
          break;

        case "insetTop":
          yTransformOrigin = "bottom";
          bottom = this.containingBlockHeight - this.baseVerticalOffset - this.anchorHeight;
          break;

        case "insetBottom":
          yTransformOrigin = "top";
          top = this.baseVerticalOffset;
          break;

        case "bottom":
          yTransformOrigin = "top";
          top = this.baseVerticalOffset + this.anchorHeight;
          break;
      }

      this.yTransformOrigin = yTransformOrigin;
      this.regionTop = top === null ? "unset" : `${top}px`;
      this.regionBottom = bottom === null ? "unset" : `${bottom}px`;
      this.verticalPosition = desiredVerticalPosition;

      switch (this.verticalScaling) {
        case "anchor":
          this.regionHeight = `${this.anchorHeight}px`;
          break;

        case "fill":
          this.regionHeight = `${nextPositionerDimension.height}px`;
          break;

        case "content":
          this.regionHeight = "unset";
          break;
      }
    };
    /**
     *  Update the offset values
     */


    this.updateRegionOffset = regionRect => {
      if (this.horizontalPositioningMode === "uncontrolled") {
        this.baseHorizontalOffset = this.anchorLeft - regionRect.left;
      } else {
        switch (this.horizontalPosition) {
          case "undefined":
            this.baseHorizontalOffset = this.anchorLeft - regionRect.left;
            break;

          case "left":
            this.baseHorizontalOffset = this.baseHorizontalOffset + (this.anchorLeft - regionRect.right);
            break;

          case "insetLeft":
            this.baseHorizontalOffset = this.baseHorizontalOffset + (this.anchorRight - regionRect.right);
            break;

          case "insetRight":
            this.baseHorizontalOffset = this.baseHorizontalOffset + (this.anchorLeft - regionRect.left);
            break;

          case "right":
            this.baseHorizontalOffset = this.baseHorizontalOffset + (this.anchorRight - regionRect.left);
            break;
        }
      }

      if (this.verticalPositioningMode === "uncontrolled") {
        this.baseVerticalOffset = this.anchorTop - regionRect.top;
      } else {
        switch (this.verticalPosition) {
          case "undefined":
            this.baseVerticalOffset = this.anchorTop - regionRect.top;
            break;

          case "top":
            this.baseVerticalOffset = this.baseVerticalOffset + (this.anchorTop - regionRect.bottom);
            break;

          case "insetTop":
            this.baseVerticalOffset = this.baseVerticalOffset + (this.anchorBottom - regionRect.bottom);
            break;

          case "insetBottom":
            this.baseVerticalOffset = this.baseVerticalOffset + (this.anchorTop - regionRect.top);
            break;

          case "bottom":
            this.baseVerticalOffset = this.baseVerticalOffset + (this.anchorBottom - regionRect.top);
            break;
        }
      }
    };
    /**
     *  Get available Horizontal positions based on positioning mode
     */


    this.getHorizontalPositioningOptions = () => {
      if (this.horizontalInset) {
        return ["insetLeft", "insetRight"];
      }

      return ["left", "right"];
    };
    /**
     * Get available Vertical positions based on positioning mode
     */


    this.getVerticalPositioningOptions = () => {
      if (this.verticalInset) {
        return ["insetTop", "insetBottom"];
      }

      return ["top", "bottom"];
    };
    /**
     *  Get the width available for a particular horizontal position
     */


    this.getAvailableWidth = positionOption => {
      if (this.viewportRect !== null) {
        const spaceLeft = this.anchorLeft - this.viewportRect.left;
        const spaceRight = this.viewportRect.right - (this.anchorLeft + this.anchorWidth);

        switch (positionOption) {
          case "left":
            return spaceLeft;

          case "insetLeft":
            return spaceLeft + this.anchorWidth;

          case "insetRight":
            return spaceRight + this.anchorWidth;

          case "right":
            return spaceRight;
        }
      }

      return 0;
    };
    /**
     *  Get the height available for a particular vertical position
     */


    this.getAvailableHeight = positionOption => {
      if (this.viewportRect !== null) {
        const spaceAbove = this.anchorTop - this.viewportRect.top;
        const spaceBelow = this.viewportRect.bottom - (this.anchorTop + this.anchorHeight);

        switch (positionOption) {
          case "top":
            return spaceAbove;

          case "insetTop":
            return spaceAbove + this.anchorHeight;

          case "insetBottom":
            return spaceBelow + this.anchorHeight;

          case "bottom":
            return spaceBelow;
        }
      }

      return 0;
    };
    /**
     * Get region dimensions
     */


    this.getNextRegionDimension = (desiredHorizontalPosition, desiredVerticalPosition) => {
      const newRegionDimension = {
        height: this.regionDimension.height,
        width: this.regionDimension.width
      };

      if (this.horizontalScaling === "fill") {
        newRegionDimension.width = this.getAvailableWidth(desiredHorizontalPosition);
      }

      if (this.verticalScaling === "fill") {
        newRegionDimension.height = this.getAvailableHeight(desiredVerticalPosition);
      }

      return newRegionDimension;
    };
    /**
     * starts event listeners that can trigger auto updating
     */


    this.startAutoUpdateEventListeners = () => {
      window.addEventListener(eventResize, this.update);
      window.addEventListener(eventScroll, this.update, true);

      if (this.resizeDetector !== null && this.viewportElement !== null) {
        this.resizeDetector.observe(this.viewportElement);
      }
    };
    /**
     * stops event listeners that can trigger auto updating
     */


    this.stopAutoUpdateEventListeners = () => {
      window.removeEventListener(eventResize, this.update);
      window.removeEventListener(eventScroll, this.update);

      if (this.resizeDetector !== null && this.viewportElement !== null) {
        this.resizeDetector.unobserve(this.viewportElement);
      }
    };
  }

  anchorChanged() {
    if (this.initialLayoutComplete) {
      this.anchorElement = this.getAnchor();
    }
  }

  viewportChanged() {
    if (this.initialLayoutComplete) {
      this.viewportElement = this.getViewport();
    }
  }

  horizontalPositioningModeChanged() {
    this.requestReset();
  }

  horizontalDefaultPositionChanged() {
    this.updateForAttributeChange();
  }

  horizontalInsetChanged() {
    this.updateForAttributeChange();
  }

  horizontalThresholdChanged() {
    this.updateForAttributeChange();
  }

  horizontalScalingChanged() {
    this.updateForAttributeChange();
  }

  verticalPositioningModeChanged() {
    this.requestReset();
  }

  verticalDefaultPositionChanged() {
    this.updateForAttributeChange();
  }

  verticalInsetChanged() {
    this.updateForAttributeChange();
  }

  verticalThresholdChanged() {
    this.updateForAttributeChange();
  }

  verticalScalingChanged() {
    this.updateForAttributeChange();
  }

  fixedPlacementChanged() {
    if (this.$fastController.isConnected && this.initialLayoutComplete) {
      this.initialize();
    }
  }

  autoUpdateModeChanged(prevMode, newMode) {
    if (this.$fastController.isConnected && this.initialLayoutComplete) {
      if (prevMode === "auto") {
        this.stopAutoUpdateEventListeners();
      }

      if (newMode === "auto") {
        this.startAutoUpdateEventListeners();
      }
    }
  }

  anchorElementChanged() {
    this.requestReset();
  }

  viewportElementChanged() {
    if (this.$fastController.isConnected && this.initialLayoutComplete) {
      this.initialize();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();

    if (this.autoUpdateMode === "auto") {
      this.startAutoUpdateEventListeners();
    }

    this.initialize();
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.autoUpdateMode === "auto") {
      this.stopAutoUpdateEventListeners();
    }

    this.stopObservers();
    this.disconnectResizeDetector();
  }
  /**
   * @internal
   */


  adoptedCallback() {
    this.initialize();
  }
  /**
   * destroys the instance's resize observer
   */


  disconnectResizeDetector() {
    if (this.resizeDetector !== null) {
      this.resizeDetector.disconnect();
      this.resizeDetector = null;
    }
  }
  /**
   * initializes the instance's resize observer
   */


  initializeResizeDetector() {
    this.disconnectResizeDetector();
    this.resizeDetector = new window.ResizeObserver(this.handleResize);
  }
  /**
   * react to attribute changes that don't require a reset
   */


  updateForAttributeChange() {
    if (this.$fastController.isConnected && this.initialLayoutComplete) {
      this.update();
    }
  }
  /**
   * fully initializes the component
   */


  initialize() {
    this.initializeResizeDetector();

    if (this.anchorElement === null) {
      this.anchorElement = this.getAnchor();
    }

    this.requestReset();
  }
  /**
   * Request a layout update if there are currently no open requests
   */


  requestLayoutUpdate() {
    if (this.pendingLayoutUpdate === false && this.pendingReset === false) {
      this.pendingLayoutUpdate = true;
      DOM.queueUpdate(() => this.updateLayout());
    }
  }
  /**
   * Request a reset if there are currently no open requests
   */


  requestReset() {
    if (this.$fastController.isConnected && this.pendingReset === false) {
      this.pendingLayoutUpdate = false;
      this.setInitialState();
      DOM.queueUpdate(() => this.reset());
      this.pendingReset = true;
    }
  }
  /**
   * sets the starting configuration for component internal values
   */


  setInitialState() {
    this.initialLayoutComplete = false;
    this.regionVisible = false;
    this.regionTop = "0";
    this.regionRight = "0";
    this.regionBottom = "0";
    this.regionLeft = "0";
    this.regionWidth = "100%";
    this.regionHeight = "100%";
    this.xTransformOrigin = "left";
    this.yTransformOrigin = "top";
    this.viewportRect = null;
    this.regionRect = null;
    this.anchorRect = null;
    this.regionDimension = {
      height: 0,
      width: 0
    };
    this.anchorTop = 0;
    this.anchorRight = 0;
    this.anchorBottom = 0;
    this.anchorLeft = 0;
    this.anchorHeight = 0;
    this.anchorWidth = 0;
    this.verticalPosition = "undefined";
    this.horizontalPosition = "undefined";
    this.baseHorizontalOffset = 0;
    this.baseVerticalOffset = 0;
    this.style.opacity = "0";
    this.style.pointerEvents = "none";
    this.updateRegionStyle();
  }

}
AnchoredRegion.intersectionService = new IntersectionService();

__decorate([attr], AnchoredRegion.prototype, "anchor", void 0);

__decorate([attr], AnchoredRegion.prototype, "viewport", void 0);

__decorate([attr({
  attribute: "horizontal-positioning-mode"
})], AnchoredRegion.prototype, "horizontalPositioningMode", void 0);

__decorate([attr({
  attribute: "horizontal-default-position"
})], AnchoredRegion.prototype, "horizontalDefaultPosition", void 0);

__decorate([attr({
  attribute: "horizontal-inset",
  mode: "boolean"
})], AnchoredRegion.prototype, "horizontalInset", void 0);

__decorate([attr({
  attribute: "horizontal-threshold"
})], AnchoredRegion.prototype, "horizontalThreshold", void 0);

__decorate([attr({
  attribute: "horizontal-scaling"
})], AnchoredRegion.prototype, "horizontalScaling", void 0);

__decorate([attr({
  attribute: "vertical-positioning-mode"
})], AnchoredRegion.prototype, "verticalPositioningMode", void 0);

__decorate([attr({
  attribute: "vertical-default-position"
})], AnchoredRegion.prototype, "verticalDefaultPosition", void 0);

__decorate([attr({
  attribute: "vertical-inset",
  mode: "boolean"
})], AnchoredRegion.prototype, "verticalInset", void 0);

__decorate([attr({
  attribute: "vertical-threshold"
})], AnchoredRegion.prototype, "verticalThreshold", void 0);

__decorate([attr({
  attribute: "vertical-scaling"
})], AnchoredRegion.prototype, "verticalScaling", void 0);

__decorate([attr({
  attribute: "fixed-placement",
  mode: "boolean"
})], AnchoredRegion.prototype, "fixedPlacement", void 0);

__decorate([attr({
  attribute: "auto-update-mode"
})], AnchoredRegion.prototype, "autoUpdateMode", void 0);

__decorate([observable], AnchoredRegion.prototype, "anchorElement", void 0);

__decorate([observable], AnchoredRegion.prototype, "viewportElement", void 0);

__decorate([observable], AnchoredRegion.prototype, "initialLayoutComplete", void 0);

/**
 * The template for {@link @microsoft/fast-foundation#Avatar} component.
 * @public
 */

const avatarTemplate = (context, definition) => html`<div class="backplate ${x => x.shape}" part="backplate" style="${x => x.fill ? `background-color: var(--avatar-fill-${x.fill});` : void 0}"><a class="link" part="link" href="${x => x.link ? x.link : void 0}" style="${x => x.color ? `color: var(--avatar-color-${x.color});` : void 0}"><slot name="media" part="media">${definition.media || ""}</slot><slot class="content" part="content"><slot></a></div><slot name="badge" part="badge"></slot>`;

/**
 * An Avatar Custom HTML Element
 *
 * @public
 */

class Avatar extends FoundationElement {
  /**
   * Internal
   */
  connectedCallback() {
    super.connectedCallback();

    if (!this.shape) {
      this.shape = "circle";
    }
  }

}

__decorate([attr], Avatar.prototype, "fill", void 0);

__decorate([attr], Avatar.prototype, "color", void 0);

__decorate([attr], Avatar.prototype, "link", void 0);

__decorate([attr], Avatar.prototype, "shape", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Badge} component.
 * @public
 */

const badgeTemplate = (context, definition) => html`<template class="${x => x.circular ? "circular" : ""}"><div class="control" part="control" style="${x => x.generateBadgeStyle()}"><slot></slot></div></template>`;

/**
 * A Badge Custom HTML Element.
 *
 * @public
 */

class Badge extends FoundationElement {
  constructor() {
    super(...arguments);

    this.generateBadgeStyle = () => {
      if (!this.fill && !this.color) {
        return;
      }

      const fill = `background-color: var(--badge-fill-${this.fill});`;
      const color = `color: var(--badge-color-${this.color});`;

      if (this.fill && !this.color) {
        return fill;
      } else if (this.color && !this.fill) {
        return color;
      } else {
        return `${color} ${fill}`;
      }
    };
  }

}

__decorate([attr({
  attribute: "fill"
})], Badge.prototype, "fill", void 0);

__decorate([attr({
  attribute: "color"
})], Badge.prototype, "color", void 0);

__decorate([attr({
  mode: "boolean"
})], Badge.prototype, "circular", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(BreadcrumbItem:class)} component.
 * @public
 */

const breadcrumbItemTemplate = (context, definition) => html`<div role="listitem" class="listitem" part="listitem">${when(x => x.href && x.href.length > 0, html` ${anchorTemplate()} `)} ${when(x => !x.href, html` ${startTemplate}<slot></slot>${endTemplate} `)} ${when(x => x.separator, html`<span class="separator" part="separator" aria-hidden="true"><slot name="separator">${definition.separator || ""}</slot></span>`)}</div>`;

/**
 * A Breadcrumb Item Custom HTML Element.
 *
 * @public
 */

class BreadcrumbItem extends Anchor {
  constructor() {
    super(...arguments);
    /**
     * @internal
     */

    this.separator = true;
  }

}

__decorate([observable], BreadcrumbItem.prototype, "separator", void 0);

applyMixins(BreadcrumbItem, StartEnd, DelegatesARIALink);

/**
 * The template for the {@link @microsoft/fast-foundation#Breadcrumb} component.
 * @public
 */

const breadcrumbTemplate = (context, definition) => html`<template role="navigation"><div role="list" class="list" part="list"><slot ${slotted({
  property: "slottedBreadcrumbItems",
  filter: elements()
})}></slot></div></template>`;

/**
 * A Breadcrumb Custom HTML Element.
 *
 * @public
 */

class Breadcrumb extends FoundationElement {
  slottedBreadcrumbItemsChanged() {
    if (this.$fastController.isConnected) {
      if (this.slottedBreadcrumbItems === undefined || this.slottedBreadcrumbItems.length === 0) {
        return;
      }

      const lastNode = this.slottedBreadcrumbItems[this.slottedBreadcrumbItems.length - 1];
      this.setItemSeparator(lastNode);
      this.setLastItemAriaCurrent(lastNode);
    }
  }

  setItemSeparator(lastNode) {
    this.slottedBreadcrumbItems.forEach(item => {
      if (item instanceof BreadcrumbItem) {
        item.separator = true;
      }
    });

    if (lastNode instanceof BreadcrumbItem) {
      lastNode.separator = false;
    }
  }
  /**
   * @internal
   * Finds href on childnodes in the light DOM or shadow DOM.
   * We look in the shadow DOM because we insert an anchor when breadcrumb-item has an href.
   */


  findChildWithHref(node) {
    var _a, _b;

    if (node.childElementCount > 0) {
      return node.querySelector("a[href]");
    } else if ((_a = node.shadowRoot) === null || _a === void 0 ? void 0 : _a.childElementCount) {
      return (_b = node.shadowRoot) === null || _b === void 0 ? void 0 : _b.querySelector("a[href]");
    } else return null;
  }
  /**
   *  If child node with an anchor tag and with href is found then apply aria-current to child node otherwise apply aria-current to the host element, with an href
   */


  setLastItemAriaCurrent(lastNode) {
    const childNodeWithHref = this.findChildWithHref(lastNode);

    if (childNodeWithHref === null && lastNode.hasAttribute("href") && lastNode instanceof BreadcrumbItem) {
      lastNode.ariaCurrent = "page";
    } else if (childNodeWithHref !== null) {
      childNodeWithHref.setAttribute("aria-current", "page");
    }
  }

}

__decorate([observable], Breadcrumb.prototype, "slottedBreadcrumbItems", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Button:class)} component.
 * @public
 */

const buttonTemplate = (context, definition) => html`<button class="control" part="control" ?autofocus="${x => x.autofocus}" ?disabled="${x => x.disabled}" form="${x => x.formId}" formaction="${x => x.formaction}" formenctype="${x => x.formenctype}" formmethod="${x => x.formmethod}" formnovalidate="${x => x.formnovalidate}" formtarget="${x => x.formtarget}" name="${x => x.name}" type="${x => x.type}" value="${x => x.value}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-expanded="${x => x.ariaExpanded}" aria-flowto="${x => x.ariaFlowto}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-pressed="${x => x.ariaPressed}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" ${ref("control")}>${startTemplate}<span class="content" part="content"><slot ${slotted("defaultSlottedContent")}></slot></span>${endTemplate}</button>`;

const proxySlotName = "form-associated-proxy";
const ElementInternalsKey = "ElementInternals";
/**
 * @alpha
 */

const supportsElementInternals = ElementInternalsKey in window && "setFormValue" in window[ElementInternalsKey].prototype;
const InternalsMap = new Map();
/**
 * Base function for providing Custom Element Form Association.
 *
 * @alpha
 */

function FormAssociated(BaseCtor) {
  const C = class extends BaseCtor {
    constructor(...args) {
      super(...args);
      /**
       * Track whether the value has been changed from the initial value
       */

      this.dirtyValue = false;
      /**
       * Sets the element's disabled state. A disabled element will not be included during form submission.
       *
       * @remarks
       * HTML Attribute: disabled
       */

      this.disabled = false;
      /**
       * These are events that are still fired by the proxy
       * element based on user / programmatic interaction.
       *
       * The proxy implementation should be transparent to
       * the app author, so block these events from emitting.
       */

      this.proxyEventsToBlock = ["change", "click"];
      /**
       * Invoked when a connected component's form or fieldset has its disabled
       * state changed.
       * @param disabled - the disabled value of the form / fieldset
       */

      this.formDisabledCallback = disabled => {
        this.disabled = disabled;
      };

      this.formResetCallback = () => {
        this.value = this.initialValue;
        this.dirtyValue = false;
      };

      this.proxyInitialized = false;
      this.required = false;
      this.initialValue = this.initialValue || "";
    }
    /**
     * Must evaluate to true to enable elementInternals.
     * Feature detects API support and resolve respectively
     *
     * @internal
     */


    static get formAssociated() {
      return supportsElementInternals;
    }
    /**
     * Returns the validity state of the element
     *
     * @alpha
     */


    get validity() {
      return this.elementInternals ? this.elementInternals.validity : this.proxy.validity;
    }
    /**
     * Retrieve a reference to the associated form.
     * Returns null if not associated to any form.
     *
     * @alpha
     */


    get form() {
      return this.elementInternals ? this.elementInternals.form : this.proxy.form;
    }
    /**
     * Retrieve the localized validation message,
     * or custom validation message if set.
     *
     * @alpha
     */


    get validationMessage() {
      return this.elementInternals ? this.elementInternals.validationMessage : this.proxy.validationMessage;
    }
    /**
     * Whether the element will be validated when the
     * form is submitted
     */


    get willValidate() {
      return this.elementInternals ? this.elementInternals.willValidate : this.proxy.willValidate;
    }
    /**
     * A reference to all associated label elements
     */


    get labels() {
      if (this.elementInternals) {
        return Object.freeze(Array.from(this.elementInternals.labels));
      } else if (this.proxy instanceof HTMLElement && this.proxy.ownerDocument && this.id) {
        // Labels associated by wrapping the element: <label><custom-element></custom-element></label>
        const parentLabels = this.proxy.labels; // Labels associated using the `for` attribute

        const forLabels = Array.from(this.proxy.getRootNode().querySelectorAll(`[for='${this.id}']`));
        const labels = parentLabels ? forLabels.concat(Array.from(parentLabels)) : forLabels;
        return Object.freeze(labels);
      } else {
        return emptyArray;
      }
    }
    /**
     * Invoked when the `value` property changes
     * @param previous - the previous value
     * @param next - the new value
     *
     * @remarks
     * If elements extending `FormAssociated` implement a `valueChanged` method
     * They must be sure to invoke `super.valueChanged(previous, next)` to ensure
     * proper functioning of `FormAssociated`
     */


    valueChanged(previous, next) {
      this.dirtyValue = true;

      if (this.proxy instanceof HTMLElement) {
        this.proxy.value = this.value;
      }

      this.setFormValue(this.value);
      this.validate();
    }
    /**
     * Invoked when the `initialValue` property changes
     *
     * @param previous - the previous value
     * @param next - the new value
     *
     * @remarks
     * If elements extending `FormAssociated` implement a `initialValueChanged` method
     * They must be sure to invoke `super.initialValueChanged(previous, next)` to ensure
     * proper functioning of `FormAssociated`
     */


    initialValueChanged(previous, next) {
      // If the value is clean and the component is connected to the DOM
      // then set value equal to the attribute value.
      if (!this.dirtyValue) {
        this.value = this.initialValue;
        this.dirtyValue = false;
      }
    }
    /**
     * Invoked when the `disabled` property changes
     *
     * @param previous - the previous value
     * @param next - the new value
     *
     * @remarks
     * If elements extending `FormAssociated` implement a `disabledChanged` method
     * They must be sure to invoke `super.disabledChanged(previous, next)` to ensure
     * proper functioning of `FormAssociated`
     */


    disabledChanged(previous, next) {
      if (this.proxy instanceof HTMLElement) {
        this.proxy.disabled = this.disabled;
      }

      DOM.queueUpdate(() => this.classList.toggle("disabled", this.disabled));
    }
    /**
     * Invoked when the `name` property changes
     *
     * @param previous - the previous value
     * @param next - the new value
     *
     * @remarks
     * If elements extending `FormAssociated` implement a `nameChanged` method
     * They must be sure to invoke `super.nameChanged(previous, next)` to ensure
     * proper functioning of `FormAssociated`
     */


    nameChanged(previous, next) {
      if (this.proxy instanceof HTMLElement) {
        this.proxy.name = this.name;
      }
    }
    /**
     * Invoked when the `required` property changes
     *
     * @param previous - the previous value
     * @param next - the new value
     *
     * @remarks
     * If elements extending `FormAssociated` implement a `requiredChanged` method
     * They must be sure to invoke `super.requiredChanged(previous, next)` to ensure
     * proper functioning of `FormAssociated`
     */


    requiredChanged(prev, next) {
      if (this.proxy instanceof HTMLElement) {
        this.proxy.required = this.required;
      }

      DOM.queueUpdate(() => this.classList.toggle("required", this.required));
      this.validate();
    }
    /**
     * The element internals object. Will only exist
     * in browsers supporting the attachInternals API
     */


    get elementInternals() {
      if (!supportsElementInternals) {
        return null;
      }

      let internals = InternalsMap.get(this);

      if (!internals) {
        internals = this.attachInternals();
        InternalsMap.set(this, internals);
      }

      return internals;
    }
    /**
     * @internal
     */


    connectedCallback() {
      super.connectedCallback();
      this.addEventListener("keypress", this._keypressHandler);

      if (!this.value) {
        this.value = this.initialValue;
        this.dirtyValue = false;
      }

      if (!this.elementInternals) {
        this.attachProxy();
      }

      if (this.form) {
        this.form.addEventListener("reset", this.formResetCallback);
      }
    }
    /**
     * @internal
     */


    disconnectedCallback() {
      this.proxyEventsToBlock.forEach(name => this.proxy.removeEventListener(name, this.stopPropagation));

      if (this.form) {
        this.form.removeEventListener("reset", this.formResetCallback);
      }
    }
    /**
     * Return the current validity of the element.
     */


    checkValidity() {
      return this.elementInternals ? this.elementInternals.checkValidity() : this.proxy.checkValidity();
    }
    /**
     * Return the current validity of the element.
     * If false, fires an invalid event at the element.
     */


    reportValidity() {
      return this.elementInternals ? this.elementInternals.reportValidity() : this.proxy.reportValidity();
    }
    /**
     * Set the validity of the control. In cases when the elementInternals object is not
     * available (and the proxy element is used to report validity), this function will
     * do nothing unless a message is provided, at which point the setCustomValidity method
     * of the proxy element will be invoked with the provided message.
     * @param flags - Validity flags
     * @param message - Optional message to supply
     * @param anchor - Optional element used by UA to display an interactive validation UI
     */


    setValidity(flags, message, anchor) {
      if (this.elementInternals) {
        this.elementInternals.setValidity(flags, message, anchor);
      } else if (typeof message === "string") {
        this.proxy.setCustomValidity(message);
      }
    }
    /**
     * Attach the proxy element to the DOM
     */


    attachProxy() {
      var _a;

      if (!this.proxyInitialized) {
        this.proxyInitialized = true;
        this.proxy.style.display = "none";
        this.proxyEventsToBlock.forEach(name => this.proxy.addEventListener(name, this.stopPropagation)); // These are typically mapped to the proxy during
        // property change callbacks, but during initialization
        // on the initial call of the callback, the proxy is
        // still undefined. We should find a better way to address this.

        this.proxy.disabled = this.disabled;
        this.proxy.required = this.required;

        if (typeof this.name === "string") {
          this.proxy.name = this.name;
        }

        if (typeof this.value === "string") {
          this.proxy.value = this.value;
        }

        this.proxy.setAttribute("slot", proxySlotName);
        this.proxySlot = document.createElement("slot");
        this.proxySlot.setAttribute("name", proxySlotName);
      }

      (_a = this.shadowRoot) === null || _a === void 0 ? void 0 : _a.appendChild(this.proxySlot);
      this.appendChild(this.proxy);
    }
    /**
     * Detach the proxy element from the DOM
     */


    detachProxy() {
      var _a;

      this.removeChild(this.proxy);
      (_a = this.shadowRoot) === null || _a === void 0 ? void 0 : _a.removeChild(this.proxySlot);
    }
    /**
     * Sets the validity of the custom element. By default this uses the proxy element to determine
     * validity, but this can be extended or replaced in implementation.
     */


    validate() {
      if (this.proxy instanceof HTMLElement) {
        this.setValidity(this.proxy.validity, this.proxy.validationMessage);
      }
    }
    /**
     * Associates the provided value (and optional state) with the parent form.
     * @param value - The value to set
     * @param state - The state object provided to during session restores and when autofilling.
     */


    setFormValue(value, state) {
      if (this.elementInternals) {
        this.elementInternals.setFormValue(value, state || value);
      }
    }

    _keypressHandler(e) {
      switch (e.keyCode) {
        case keyCodeEnter:
          if (this.form instanceof HTMLFormElement) {
            // Implicit submission
            const defaultButton = this.form.querySelector("[type=submit]");
            defaultButton === null || defaultButton === void 0 ? void 0 : defaultButton.click();
          }

          break;
      }
    }
    /**
     * Used to stop propagation of proxy element events
     * @param e - Event object
     */


    stopPropagation(e) {
      e.stopPropagation();
    }

  };
  attr({
    mode: "boolean"
  })(C.prototype, "disabled");
  attr({
    mode: "fromView",
    attribute: "value"
  })(C.prototype, "initialValue");
  attr(C.prototype, "name");
  attr({
    mode: "boolean"
  })(C.prototype, "required");
  observable(C.prototype, "value");
  return C;
}

class _Button extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(Button:class)} component.
 *
 * @internal
 */


class FormAssociatedButton extends FormAssociated(_Button) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * A Button Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button | <button> element }.
 *
 * @public
 */

class Button extends FormAssociatedButton {
  constructor() {
    super(...arguments);
    /**
     * Submits the parent form
     */

    this.handleSubmission = () => {
      if (!this.form) {
        return;
      }

      const attached = this.proxy.isConnected;

      if (!attached) {
        this.attachProxy();
      } // Browser support for requestSubmit is not comprehensive
      // so click the proxy if it isn't supported


      typeof this.form.requestSubmit === "function" ? this.form.requestSubmit(this.proxy) : this.proxy.click();

      if (!attached) {
        this.detachProxy();
      }
    };
    /**
     * Resets the parent form
     */


    this.handleFormReset = () => {
      var _a;

      (_a = this.form) === null || _a === void 0 ? void 0 : _a.reset();
    };
  }

  formactionChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.formAction = this.formaction;
    }
  }

  formenctypeChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.formEnctype = this.formenctype;
    }
  }

  formmethodChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.formMethod = this.formmethod;
    }
  }

  formnovalidateChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.formNoValidate = this.formnovalidate;
    }
  }

  formtargetChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.formTarget = this.formtarget;
    }
  }

  typeChanged(previous, next) {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.type = this.type;
    }

    next === "submit" && this.addEventListener("click", this.handleSubmission);
    previous === "submit" && this.removeEventListener("click", this.handleSubmission);
    next === "reset" && this.addEventListener("click", this.handleFormReset);
    previous === "reset" && this.removeEventListener("click", this.handleFormReset);
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", this.type);
  }

}

__decorate([attr({
  mode: "boolean"
})], Button.prototype, "autofocus", void 0);

__decorate([attr({
  attribute: "form"
})], Button.prototype, "formId", void 0);

__decorate([attr], Button.prototype, "formaction", void 0);

__decorate([attr], Button.prototype, "formenctype", void 0);

__decorate([attr], Button.prototype, "formmethod", void 0);

__decorate([attr({
  mode: "boolean"
})], Button.prototype, "formnovalidate", void 0);

__decorate([attr], Button.prototype, "formtarget", void 0);

__decorate([attr], Button.prototype, "type", void 0);

__decorate([observable], Button.prototype, "defaultSlottedContent", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA button role
 *
 * @public
 */


class DelegatesARIAButton {}

__decorate([attr({
  attribute: "aria-expanded",
  mode: "fromView"
})], DelegatesARIAButton.prototype, "ariaExpanded", void 0);

__decorate([attr({
  attribute: "aria-pressed",
  mode: "fromView"
})], DelegatesARIAButton.prototype, "ariaPressed", void 0);

applyMixins(DelegatesARIAButton, ARIAGlobalStatesAndProperties);
applyMixins(Button, StartEnd, DelegatesARIAButton);

/**
 * The template for the {@link @microsoft/fast-foundation#Card} component.
 * @public
 */

const cardTemplate = (context, definition) => html`<slot></slot>`;

/**
 * An Card Custom HTML Element.
 *
 * @public
 */

class Card extends FoundationElement {}

/**
 * The template for the {@link @microsoft/fast-foundation#(Checkbox:class)} component.
 * @public
 */

const checkboxTemplate = (context, definition) => html`<template role="checkbox" aria-checked="${x => x.checked}" aria-required="${x => x.required}" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" tabindex="${x => x.disabled ? null : 0}" @keypress="${(x, c) => x.keypressHandler(c.event)}" @click="${(x, c) => x.clickHandler(c.event)}" class="${x => x.readOnly ? "readonly" : ""} ${x => x.checked ? "checked" : ""} ${x => x.indeterminate ? "indeterminate" : ""}"><div part="control" class="control"><slot name="checked-indicator">${definition.checkedIndicator || ""}</slot><slot name="indeterminate-indicator">${definition.indeterminateIndicator || ""}</slot></div><label part="label" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label></template>`;

class _Checkbox extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(Checkbox:class)} component.
 *
 * @internal
 */


class FormAssociatedCheckbox extends FormAssociated(_Checkbox) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * A Checkbox Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#checkbox | ARIA checkbox }.
 *
 * @public
 */

class Checkbox extends FormAssociatedCheckbox {
  constructor() {
    super();
    /**
     * The element's value to be included in form submission when checked.
     * Default to "on" to reach parity with input[type="checkbox"]
     *
     * @internal
     */

    this.initialValue = "on";
    /**
     * The indeterminate state of the control
     */

    this.indeterminate = false;
    /**
     * Tracks whether the "checked" property has been changed.
     * This is necessary to provide consistent behavior with
     * normal input checkboxes
     */

    this.dirtyChecked = false;
    /**
     * Set to true when the component has constructed
     */

    this.constructed = false;
    /**
     * @internal
     */

    this.formResetCallback = () => {
      this.checked = this.checkedAttribute;
      this.dirtyChecked = false;
    };
    /**
     * @internal
     */


    this.keypressHandler = e => {
      switch (e.keyCode) {
        case keyCodeSpace:
          this.checked = !this.checked;
          break;
      }
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      if (!this.disabled && !this.readOnly) {
        this.checked = !this.checked;
      }
    };

    this.defaultChecked = !!this.checkedAttribute;
    this.checked = this.defaultChecked;
    this.constructed = true;
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  checkedAttributeChanged() {
    this.defaultChecked = this.checkedAttribute;
  }

  defaultCheckedChanged() {
    if (!this.dirtyChecked) {
      // Setting this.checked will cause us to enter a dirty state,
      // but if we are clean when defaultChecked is changed, we want to stay
      // in a clean state, so reset this.dirtyChecked
      this.checked = this.defaultChecked;
      this.dirtyChecked = false;
    }
  }

  checkedChanged() {
    if (!this.dirtyChecked) {
      this.dirtyChecked = true;
    }

    this.updateForm();

    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.checked = this.checked;
    }

    if (this.constructed) {
      this.$emit("change");
    }

    this.validate();
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "checkbox");
    this.updateForm();
  }

  updateForm() {
    const value = this.checked ? this.value : null;
    this.setFormValue(value, value);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Checkbox.prototype, "readOnly", void 0);

__decorate([attr({
  attribute: "checked",
  mode: "boolean"
})], Checkbox.prototype, "checkedAttribute", void 0);

__decorate([observable], Checkbox.prototype, "defaultSlottedNodes", void 0);

__decorate([observable], Checkbox.prototype, "defaultChecked", void 0);

__decorate([observable], Checkbox.prototype, "checked", void 0);

__decorate([observable], Checkbox.prototype, "indeterminate", void 0);

/**
 * Positioning directions for the listbox when a select is open.
 * @public
 */
var SelectPosition;

(function (SelectPosition) {
  SelectPosition["above"] = "above";
  SelectPosition["below"] = "below";
})(SelectPosition || (SelectPosition = {}));
/**
 * Select role.
 * @public
 */


var SelectRole;

(function (SelectRole) {
  SelectRole["combobox"] = "combobox";
})(SelectRole || (SelectRole = {}));

/**
 * Determines if the element is a {@link (ListboxOption:class)}
 *
 * @param element - the element to test.
 * @public
 */

function isListboxOption(el) {
  return isHTMLElement(el) && (el.getAttribute("role") === "option" || el instanceof HTMLOptionElement);
}
/**
 * An Option Custom HTML Element.
 * Implements {@link https://www.w3.org/TR/wai-aria-1.1/#option | ARIA option }.
 *
 * @public
 */

class ListboxOption extends FoundationElement {
  constructor(text, value, defaultSelected, selected) {
    super();
    /**
     * The defaultSelected state of the option.
     * @public
     */

    this.defaultSelected = false;
    /**
     * Tracks whether the "selected" property has been changed.
     * @internal
     */

    this.dirtySelected = false;
    /**
     * The checked state of the control.
     *
     * @public
     */

    this.selected = this.defaultSelected;
    /**
     * Track whether the value has been changed from the initial value
     */

    this.dirtyValue = false;
    this.initialValue = this.initialValue || "";

    if (text) {
      this.textContent = text;
    }

    if (value) {
      this.initialValue = value;
    }

    if (defaultSelected) {
      this.defaultSelected = defaultSelected;
    }

    if (selected) {
      this.selected = selected;
    }

    this.proxy = new Option(`${this.textContent}`, this.initialValue, this.defaultSelected, this.selected);
    this.proxy.disabled = this.disabled;
  }

  defaultSelectedChanged() {
    if (!this.dirtySelected) {
      this.selected = this.defaultSelected;

      if (this.proxy instanceof HTMLOptionElement) {
        this.proxy.selected = this.defaultSelected;
      }
    }
  }

  disabledChanged(prev, next) {
    if (this.proxy instanceof HTMLOptionElement) {
      this.proxy.disabled = this.disabled;
    }
  }

  selectedAttributeChanged() {
    this.defaultSelected = this.selectedAttribute;

    if (this.proxy instanceof HTMLOptionElement) {
      this.proxy.defaultSelected = this.defaultSelected;
    }
  }

  selectedChanged() {
    if (this.$fastController.isConnected) {
      if (!this.dirtySelected) {
        this.dirtySelected = true;
      }

      if (this.proxy instanceof HTMLOptionElement) {
        this.proxy.selected = this.selected;
      }
    }
  }

  initialValueChanged(previous, next) {
    // If the value is clean and the component is connected to the DOM
    // then set value equal to the attribute value.
    if (!this.dirtyValue) {
      this.value = this.initialValue;
      this.dirtyValue = false;
    }
  }

  get label() {
    return this.value ? this.value : this.textContent ? this.textContent : "";
  }

  get text() {
    return this.textContent;
  }

  set value(next) {
    this._value = next;
    this.dirtyValue = true;

    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = next;
    }

    Observable.notify(this, "value");
  }

  get value() {
    Observable.track(this, "value");
    return this._value ? this._value : this.text;
  }

  get form() {
    return this.proxy ? this.proxy.form : null;
  }

}

__decorate([observable], ListboxOption.prototype, "defaultSelected", void 0);

__decorate([attr({
  mode: "boolean"
})], ListboxOption.prototype, "disabled", void 0);

__decorate([attr({
  attribute: "selected",
  mode: "boolean"
})], ListboxOption.prototype, "selectedAttribute", void 0);

__decorate([observable], ListboxOption.prototype, "selected", void 0);

__decorate([attr({
  attribute: "value",
  mode: "fromView"
})], ListboxOption.prototype, "initialValue", void 0);

applyMixins(ListboxOption, StartEnd);

/**
 * Listbox role.
 * @public
 */
var ListboxRole;

(function (ListboxRole) {
  ListboxRole["listbox"] = "listbox";
})(ListboxRole || (ListboxRole = {}));

/**
 * A Listbox Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#listbox | ARIA listbox }.
 *
 * @public
 */

class Listbox extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The index of the selected option
     *
     * @public
     */

    this.selectedIndex = -1;
    /**
     * @internal
     */

    this.typeaheadBuffer = "";
    /**
     * @internal
     */

    this.typeaheadTimeout = -1;
    /**
     * Flag for the typeahead timeout expiration.
     *
     * @internal
     */

    this.typeAheadExpired = true;
    /**
     * The role of the element.
     *
     * @public
     * @remarks
     * HTML Attribute: role
     */

    this.role = ListboxRole.listbox;
    /**
     * The internal unfiltered list of selectable options.
     *
     * @internal
     */

    this._options = [];
    /**
     * A collection of the selected options.
     *
     * @public
     */

    this.selectedOptions = [];
    /**
     * A standard `click` event creates a `focus` event before firing, so a
     * `mousedown` event is used to skip that initial focus.
     *
     * @internal
     */

    this.shouldSkipFocus = false;
    /**
     * Move focus to an option whose label matches characters typed by the user.
     * Consecutive keystrokes are batched into a buffer of search text used
     * to match against the set of options.  If TYPE_AHEAD_TIMEOUT_MS passes
     * between consecutive keystrokes, the search restarts.
     *
     * @param key - the key to be evaluated
     */

    this.handleTypeAhead = key => {
      if (this.typeaheadTimeout) {
        window.clearTimeout(this.typeaheadTimeout);
      }

      this.typeaheadTimeout = window.setTimeout(() => this.typeAheadExpired = true, Listbox.TYPE_AHEAD_TIMEOUT_MS);

      if (key.length > 1) {
        return;
      }

      this.typeaheadBuffer = `${this.typeAheadExpired ? "" : this.typeaheadBuffer}${key}`;
    };
  }

  selectedIndexChanged(prev, next) {
    this.setSelectedOptions();
  }

  typeaheadBufferChanged(prev, next) {
    if (this.$fastController.isConnected) {
      const pattern = this.typeaheadBuffer.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${pattern}`, "gi");
      const filteredOptions = this.options.filter(o => o.text.trim().match(re));

      if (filteredOptions.length) {
        const selectedIndex = this.options.indexOf(filteredOptions[0]);

        if (selectedIndex > -1) {
          this.selectedIndex = selectedIndex;
        }
      }

      this.typeAheadExpired = false;
    }
  }

  slottedOptionsChanged(prev, next) {
    if (this.$fastController.isConnected) {
      this.options = next.reduce((options, item) => {
        if (isListboxOption(item)) {
          options.push(item);
        }

        return options;
      }, []);
      this.options.forEach(o => {
        o.id = o.id || uniqueId("option-");
      });
      this.setSelectedOptions();
      this.setDefaultSelectedOption();
    }
  }
  /**
   * The list of options.
   *
   * @public
   */


  get options() {
    Observable.track(this, "options");
    return this._options;
  }

  set options(value) {
    this._options = value;
    Observable.notify(this, "options");
  }

  selectedOptionsChanged(prev, next) {
    if (this.$fastController.isConnected) {
      this.options.forEach(o => {
        o.selected = next.includes(o);
      });
    }
  }
  /**
   * @internal
   */


  get firstSelectedOption() {
    return this.selectedOptions[0];
  }
  /**
   * @internal
   */


  focusAndScrollOptionIntoView() {
    if (this.contains(document.activeElement) && this.firstSelectedOption) {
      this.firstSelectedOption.focus();
      requestAnimationFrame(() => {
        this.firstSelectedOption.scrollIntoView({
          block: "nearest"
        });
      });
    }
  }
  /**
   * @internal
   */


  focusinHandler(e) {
    if (!this.shouldSkipFocus && e.target === e.currentTarget) {
      this.setSelectedOptions();
      this.focusAndScrollOptionIntoView();
    }

    this.shouldSkipFocus = false;
  }
  /**
   * Prevents `focusin` events from firing before `click` events when the
   * element is unfocused.
   *
   * @internal
   */


  mousedownHandler(e) {
    this.shouldSkipFocus = !this.contains(document.activeElement);
    return true;
  }
  /**
   * @internal
   */


  setDefaultSelectedOption() {
    if (this.options && this.$fastController.isConnected) {
      const selectedIndex = this.options.findIndex(el => el.getAttribute("selected") !== null);

      if (selectedIndex !== -1) {
        this.selectedIndex = selectedIndex;
        return;
      }

      this.selectedIndex = 0;
    }
  }
  /**
   * Sets an option as selected and gives it focus.
   *
   * @param index - option index to select
   * @public
   */


  setSelectedOptions() {
    if (this.$fastController.isConnected && this.options) {
      const selectedOption = this.options[this.selectedIndex] || null;
      this.selectedOptions = this.options.filter(el => el.isSameNode(selectedOption));
      this.ariaActiveDescendant = this.firstSelectedOption ? this.firstSelectedOption.id : "";
      this.focusAndScrollOptionIntoView();
    }
  }
  /**
   * Moves focus to the first selectable option
   *
   * @public
   */


  selectFirstOption() {
    if (!this.disabled) {
      this.selectedIndex = 0;
    }
  }
  /**
   * Moves focus to the last selectable option
   *
   * @internal
   */


  selectLastOption() {
    if (!this.disabled) {
      this.selectedIndex = this.options.length - 1;
    }
  }
  /**
   * Moves focus to the next selectable option
   *
   * @internal
   */


  selectNextOption() {
    if (!this.disabled && this.options && this.selectedIndex < this.options.length - 1) {
      this.selectedIndex += 1;
    }
  }

  get length() {
    if (this.options) {
      return this.options.length;
    }

    return 0;
  }
  /**
   * Moves focus to the previous selectable option
   *
   * @internal
   */


  selectPreviousOption() {
    if (!this.disabled && this.selectedIndex > 0) {
      this.selectedIndex = this.selectedIndex - 1;
    }
  }
  /**
   * Handles click events for listbox options
   *
   * @internal
   */


  clickHandler(e) {
    const captured = e.target.closest(`option,[role=option]`);

    if (captured && !captured.disabled) {
      this.selectedIndex = this.options.indexOf(captured);
      return true;
    }
  }
  /**
   * Handles keydown actions for listbox navigation and typeahead
   *
   * @internal
   */


  keydownHandler(e) {
    if (this.disabled) {
      return true;
    }

    this.shouldSkipFocus = false;
    const key = e.key;

    switch (key) {
      // Select the first available option
      case "Home":
        {
          if (!e.shiftKey) {
            e.preventDefault();
            this.selectFirstOption();
          }

          break;
        }
      // Select the next selectable option

      case "ArrowDown":
        {
          if (!e.shiftKey) {
            e.preventDefault();
            this.selectNextOption();
          }

          break;
        }
      // Select the previous selectable option

      case "ArrowUp":
        {
          if (!e.shiftKey) {
            e.preventDefault();
            this.selectPreviousOption();
          }

          break;
        }
      // Select the last available option

      case "End":
        {
          e.preventDefault();
          this.selectLastOption();
          break;
        }

      case "Tab":
        {
          this.focusAndScrollOptionIntoView();
          return true;
        }

      case "Enter":
      case "Escape":
        {
          return true;
        }

      case " ":
        {
          if (this.typeAheadExpired) {
            return true;
          }
        }
      // Send key to Typeahead handler

      default:
        {
          if (key.length === 1) {
            this.handleTypeAhead(`${key}`);
          }

          return true;
        }
    }
  }

}
/**
 * Typeahead timeout in milliseconds.
 *
 * @internal
 */

Listbox.TYPE_AHEAD_TIMEOUT_MS = 1000;
/**
 * A static filter to include only enabled elements
 *
 * @param n - element to filter
 * @public
 */

Listbox.slottedOptionFilter = n => isListboxOption(n) && !n.disabled && !n.hidden;

__decorate([observable], Listbox.prototype, "selectedIndex", void 0);

__decorate([observable], Listbox.prototype, "typeaheadBuffer", void 0);

__decorate([attr], Listbox.prototype, "role", void 0);

__decorate([attr({
  mode: "boolean"
})], Listbox.prototype, "disabled", void 0);

__decorate([observable], Listbox.prototype, "slottedOptions", void 0);

__decorate([observable], Listbox.prototype, "selectedOptions", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA listbox role
 *
 * @public
 */


class DelegatesARIAListbox {
  constructor() {
    /**
     * See {@link https://www.w3.org/WAI/PF/aria/roles#listbox} for more information
     * @public
     * @remarks
     * HTML Attribute: aria-activedescendant
     */
    this.ariaActiveDescendant = "";
  }

}

__decorate([observable], DelegatesARIAListbox.prototype, "ariaActiveDescendant", void 0);

__decorate([observable], DelegatesARIAListbox.prototype, "ariaDisabled", void 0);

__decorate([observable], DelegatesARIAListbox.prototype, "ariaExpanded", void 0);

applyMixins(DelegatesARIAListbox, ARIAGlobalStatesAndProperties);
applyMixins(Listbox, DelegatesARIAListbox);

class _Combobox extends Listbox {}
/**
 * A form-associated base class for the {@link (Combobox:class)} component.
 *
 * @internal
 */


class FormAssociatedCombobox extends FormAssociated(_Combobox) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * Autocomplete values for combobox.
 * @public
 */
var ComboboxAutocomplete;

(function (ComboboxAutocomplete) {
  ComboboxAutocomplete["inline"] = "inline";
  ComboboxAutocomplete["list"] = "list";
  ComboboxAutocomplete["both"] = "both";
  ComboboxAutocomplete["none"] = "none";
})(ComboboxAutocomplete || (ComboboxAutocomplete = {}));

/**
 * A Combobox Custom HTML Element.
 * Implements the {@link https://w3c.github.io/aria-practices/#combobox | ARIA combobox }.
 *
 * @public
 */

class Combobox extends FormAssociatedCombobox {
  constructor() {
    super(...arguments);
    /**
     * The internal value property.
     *
     * @internal
     */

    this._value = "";
    /**
     * The collection of currently filtered options.
     *
     * @public
     */

    this.filteredOptions = [];
    /**
     * The current filter value.
     *
     * @internal
     */

    this.filter = "";
    /**
     * The initial state of the position attribute.
     *
     * @internal
     */

    this.forcedPosition = false;
    /**
     * Reset the element to its first selectable option when its parent form is reset.
     *
     * @internal
     */

    this.formResetCallback = () => {
      this.value = this.initialValue;
      this.dirtyValue = false;
      this.setDefaultSelectedOption();
      this.updateValue();
    };
    /**
     * The unique id of the internal listbox.
     *
     * @internal
     */


    this.listboxId = uniqueId("listbox-");
    /**
     * The max height for the listbox when opened.
     *
     * @internal
     */

    this.maxHeight = 0;
    /**
     * The open attribute.
     *
     * @public
     * @remarks
     * HTML Attribute: open
     */

    this.open = false;
    /**
     * The current state of the calculated position of the listbox.
     *
     * @public
     */

    this.position = SelectPosition.below;
    /**
     * The role of the element.
     *
     * @public
     * @remarks
     * HTML Attribute: role
     */

    this.role = SelectRole.combobox;
  }

  get isAutocompleteInline() {
    return this.autocomplete === ComboboxAutocomplete.inline || this.isAutocompleteBoth;
  }

  get isAutocompleteList() {
    return this.autocomplete === ComboboxAutocomplete.list || this.isAutocompleteBoth;
  }

  get isAutocompleteBoth() {
    return this.autocomplete === ComboboxAutocomplete.both;
  }

  openChanged() {
    this.ariaExpanded = this.open ? "true" : "false";

    if (this.open) {
      this.setPositioning();
      this.focusAndScrollOptionIntoView();
    }
  }
  /**
   * The list of options.
   *
   * @public
   * @remarks
   * Overrides `Listbox.options`.
   */


  get options() {
    Observable.track(this, "options");
    return this.filteredOptions.length ? this.filteredOptions : this._options;
  }

  set options(value) {
    this._options = value;
    Observable.notify(this, "options");
  }
  /**
   * Updates the placeholder on the proxy element.
   * @internal
   */


  placeholderChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.placeholder = this.placeholder;
    }
  }
  /**
   * The value property.
   *
   * @public
   */


  get value() {
    Observable.track(this, "value");
    return this._value;
  }

  set value(next) {
    var _a, _b, _c;

    const prev = `${this._value}`;

    if (this.$fastController.isConnected && this.options) {
      const selectedIndex = this.options.findIndex(el => el.text.toLowerCase() === next.toLowerCase());
      const prevSelectedValue = (_a = this.options[this.selectedIndex]) === null || _a === void 0 ? void 0 : _a.text;
      const nextSelectedValue = (_b = this.options[selectedIndex]) === null || _b === void 0 ? void 0 : _b.text;
      this.selectedIndex = prevSelectedValue !== nextSelectedValue ? selectedIndex : this.selectedIndex;
      next = ((_c = this.firstSelectedOption) === null || _c === void 0 ? void 0 : _c.text) || next;
    }

    if (prev !== next) {
      this._value = next;
      super.valueChanged(prev, next);
      Observable.notify(this, "value");
    }
  }
  /**
   * Handle opening and closing the listbox when the combobox is clicked.
   *
   * @param e - the mouse event
   * @internal
   */


  clickHandler(e) {
    if (this.disabled) {
      return;
    }

    if (this.open) {
      const captured = e.target.closest(`option,[role=option]`);

      if (!captured || captured.disabled) {
        return;
      }

      this.selectedOptions = [captured];
      this.control.value = captured.text;
    }

    this.open = !this.open;

    if (!this.open) {
      this.updateValue(true);
    }

    return true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.forcedPosition = !!this.positionAttribute;

    if (this.value) {
      this.initialValue = this.value;
    }
  }
  /**
   * Synchronize the `aria-disabled` property when the `disabled` property changes.
   *
   * @param prev - The previous disabled value
   * @param next - The next disabled value
   *
   * @internal
   */


  disabledChanged(prev, next) {
    if (super.disabledChanged) {
      super.disabledChanged(prev, next);
    }

    this.ariaDisabled = this.disabled ? "true" : "false";
  }
  /**
   * Filter available options by text value.
   *
   * @public
   */


  filterOptions() {
    if (!this.autocomplete || this.autocomplete === ComboboxAutocomplete.none) {
      this.filter = "";
    }

    const filter = this.filter.toLowerCase();
    this.filteredOptions = this._options.filter(o => o.text.toLowerCase().startsWith(this.filter.toLowerCase()));

    if (this.isAutocompleteList) {
      if (!this.filteredOptions.length && !filter) {
        this.filteredOptions = this._options;
      }

      this._options.forEach(o => {
        o.hidden = !this.filteredOptions.includes(o);
      });
    }
  }
  /**
   * Handle focus state when the element or its children lose focus.
   *
   * @param e - The focus event
   * @internal
   */


  focusoutHandler(e) {
    this.updateValue();

    if (!this.open) {
      return true;
    }

    const focusTarget = e.relatedTarget;

    if (this.isSameNode(focusTarget)) {
      this.focus();
      return;
    }

    if (!this.options || !this.options.includes(focusTarget)) {
      this.open = false;
    }
  }
  /**
   * Handle content changes on the control input.
   *
   * @param e - the input event
   * @internal
   */


  inputHandler(e) {
    this.filter = this.control.value;
    this.filterOptions();

    if (e.inputType === "deleteContentBackward" || !this.filter.length) {
      return true;
    }

    if (this.isAutocompleteList && !this.open) {
      this.open = true;
    }

    if (this.isAutocompleteInline && this.filteredOptions.length) {
      this.selectedOptions = [this.filteredOptions[0]];
      this.selectedIndex = this.options.indexOf(this.firstSelectedOption);
      this.setInlineSelection();
    }

    return;
  }
  /**
   * Handle keydown actions for listbox navigation.
   *
   * @param e - the keyboard event
   * @internal
   */


  keydownHandler(e) {
    const key = e.key;

    if (e.ctrlKey || e.shiftKey) {
      return true;
    }

    switch (key) {
      case "Enter":
        {
          this.updateValue(true);

          if (this.isAutocompleteInline) {
            this.filter = this.value;
          }

          this.open = false;
          const controlValueLength = this.control.value.length;
          this.control.setSelectionRange(controlValueLength, controlValueLength);
          break;
        }

      case "Escape":
        {
          if (!this.isAutocompleteInline) {
            this.selectedIndex = -1;
          }

          if (this.open) {
            this.open = false;
            break;
          }

          this.value = "";
          this.control.value = "";
          this.filter = "";
          this.filterOptions();
          break;
        }

      case "Tab":
        {
          this.updateValue();

          if (!this.open) {
            return true;
          }

          e.preventDefault();
          this.open = false;
          break;
        }

      case "ArrowUp":
      case "ArrowDown":
        {
          this.filterOptions();

          if (!this.open) {
            this.open = true;
            break;
          }

          if (this.filteredOptions.length > 0) {
            super.keydownHandler(e);
          }

          if (this.isAutocompleteInline) {
            this.updateValue();
            this.setInlineSelection();
          }

          break;
        }

      default:
        {
          return true;
        }
    }
  }
  /**
   * Handle keyup actions for value input and text field manipulations.
   *
   * @param e - the keyboard event
   * @internal
   */


  keyupHandler(e) {
    const key = e.key;

    switch (key) {
      case "ArrowLeft":
      case "ArrowRight":
      case "Backspace":
      case "Delete":
      case "Home":
      case "End":
        {
          this.filter = this.control.value;
          this.selectedIndex = -1;
          this.filterOptions();
          break;
        }
    }
  }
  /**
   * Ensure that the selectedIndex is within the current allowable filtered range.
   *
   * @internal
   * @remarks
   * Overrides: `Listbox.selectedIndexChanged`
   */


  selectedIndexChanged(prev, next) {
    if (this.$fastController.isConnected) {
      next = limit(-1, this.options.length - 1, next); // we only want to call the super method when the selectedIndex is in range

      if (next !== this.selectedIndex) {
        this.selectedIndex = next;
        return;
      }

      super.selectedIndexChanged(prev, next);
    }
  }
  /**
   * Move focus to the previous selectable option.
   *
   * @internal
   * @remarks
   * Overrides `Listbox.selectPreviousOption`
   */


  selectPreviousOption() {
    if (!this.disabled && this.selectedIndex >= 0) {
      this.selectedIndex = this.selectedIndex - 1;
    }
  }
  /**
   * Set the default selected options at initialization or reset.
   *
   * @internal
   * @remarks
   * Overrides `Listbox.setDefaultSelectedOption`
   */


  setDefaultSelectedOption() {
    if (this.$fastController.isConnected && this.options) {
      const selectedIndex = this.options.findIndex(el => el.getAttribute("selected") !== null || el.selected);
      this.selectedIndex = selectedIndex;

      if (!this.dirtyValue && this.firstSelectedOption) {
        this.value = this.firstSelectedOption.text;
      }

      this.setSelectedOptions();
    }
  }
  /**
   * Focus and select the content of the control based on the first selected option.
   *
   * @param start - The index for the starting range
   * @internal
   */


  setInlineSelection() {
    if (this.firstSelectedOption) {
      this.control.value = this.firstSelectedOption.text;
      this.control.focus();
      this.control.setSelectionRange(this.filter.length, this.control.value.length, "backward");
    }
  }
  /**
   * Calculate and apply listbox positioning based on available viewport space.
   *
   * @param force - direction to force the listbox to display
   * @public
   */


  setPositioning() {
    const currentBox = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const availableBottom = viewportHeight - currentBox.bottom;
    this.position = this.forcedPosition ? this.positionAttribute : currentBox.top > availableBottom ? SelectPosition.above : SelectPosition.below;
    this.positionAttribute = this.forcedPosition ? this.positionAttribute : this.position;
    this.maxHeight = this.position === SelectPosition.above ? ~~currentBox.top : ~~availableBottom;
  }
  /**
   * Ensure that the entire list of options is used when setting the selected property.
   *
   * @internal
   * @remarks
   * Overrides: `Listbox.selectedOptionsChanged`
   */


  selectedOptionsChanged(prev, next) {
    if (this.$fastController.isConnected) {
      this._options.forEach(o => {
        o.selected = next.includes(o);
      });
    }
  }
  /**
   * Synchronize the form-associated proxy and update the value property of the element.
   *
   * @param prev - the previous collection of slotted option elements
   * @param next - the next collection of slotted option elements
   *
   * @internal
   */


  slottedOptionsChanged(prev, next) {
    super.slottedOptionsChanged(prev, next);
    this.updateValue();
  }
  /**
   * @internal
   */


  updateValue(shouldEmit) {
    var _a;

    if (this.$fastController.isConnected) {
      this.value = ((_a = this.firstSelectedOption) === null || _a === void 0 ? void 0 : _a.text) || this.control.value;
    }

    if (shouldEmit) {
      this.$emit("change");
    }
  }

}

__decorate([attr({
  attribute: "autocomplete",
  mode: "fromView"
})], Combobox.prototype, "autocomplete", void 0);

__decorate([observable], Combobox.prototype, "maxHeight", void 0);

__decorate([attr({
  attribute: "open",
  mode: "boolean"
})], Combobox.prototype, "open", void 0);

__decorate([attr], Combobox.prototype, "placeholder", void 0);

__decorate([attr({
  attribute: "position"
})], Combobox.prototype, "positionAttribute", void 0);

__decorate([observable], Combobox.prototype, "position", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA combobox role.
 *
 * @public
 */


class DelegatesARIACombobox {}

__decorate([attr({
  attribute: "aria-autocomplete",
  mode: "fromView"
})], DelegatesARIACombobox.prototype, "ariaAutocomplete", void 0);

applyMixins(DelegatesARIACombobox, ARIAGlobalStatesAndProperties);
applyMixins(Combobox, StartEnd, DelegatesARIACombobox);

/**
 * The template for the {@link @microsoft/fast-foundation#(Combobox:class)} component.
 * @public
 */

const comboboxTemplate = (context, definition) => html`<template autocomplete="${x => x.autocomplete}" class="${x => x.disabled ? "disabled" : ""} ${x => x.position}" tabindex="${x => !x.disabled ? "0" : null}" aria-disabled="${x => x.ariaDisabled}" aria-autocomplete="${x => x.autocomplete}" @click="${(x, c) => x.clickHandler(c.event)}" @focusout="${(x, c) => x.focusoutHandler(c.event)}"><div class="control" part="control">${startTemplate}<slot name="control"><input class="selected-value" part="selected-value" placeholder="${x => x.placeholder}" role="${x => x.role}" type="text" aria-activedescendant="${x => x.open ? x.ariaActiveDescendant : null}" aria-controls="${x => x.listboxId}" aria-expanded="${x => x.ariaExpanded}" aria-haspopup="listbox" ?disabled="${x => x.disabled}" :value="${x => x.value}" @input="${(x, c) => x.inputHandler(c.event)}" @keydown="${(x, c) => x.keydownHandler(c.event)}" @keyup="${(x, c) => x.keyupHandler(c.event)}" ${ref("control")}/><div class="indicator" part="indicator" aria-hidden="true"><slot name="indicator">${definition.indicator || ""}</slot></div></slot>${endTemplate}</div><div aria-disabled="${x => x.disabled}" class="listbox" id="${x => x.listboxId}" part="listbox" role="listbox" style="--max-height:${x => x.maxHeight}px" ?disabled="${x => x.disabled}" ?hidden="${x => !x.open}"><slot ${slotted({
  filter: Listbox.slottedOptionFilter,
  flatten: true,
  property: "slottedOptions"
})}></slot></div></template>`;

/**
 * Enumerates auto generated header options
 * default option generates a non-sticky header row
 *
 * @public
 */
var GenerateHeaderOptions;

(function (GenerateHeaderOptions) {
  GenerateHeaderOptions["none"] = "none";
  GenerateHeaderOptions["default"] = "default";
  GenerateHeaderOptions["sticky"] = "sticky";
})(GenerateHeaderOptions || (GenerateHeaderOptions = {}));
/**
 * Enumerates possible cell types.
 *
 * @public
 */


var DataGridCellTypes;

(function (DataGridCellTypes) {
  DataGridCellTypes["default"] = "default";
  DataGridCellTypes["columnHeader"] = "columnheader";
})(DataGridCellTypes || (DataGridCellTypes = {}));
/**
 * Enumerates possible row types
 *
 * @public
 */


var DataGridRowTypes;

(function (DataGridRowTypes) {
  DataGridRowTypes["default"] = "default";
  DataGridRowTypes["header"] = "header";
  DataGridRowTypes["stickyHeader"] = "sticky-header";
})(DataGridRowTypes || (DataGridRowTypes = {}));

/**
 * A Data Grid Row Custom HTML Element.
 *
 * @public
 */

class DataGridRow extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The type of row
     *
     * @public
     * @remarks
     * HTML Attribute: row-type
     */

    this.rowType = DataGridRowTypes.default;
    /**
     * The base data for this row
     *
     * @public
     */

    this.rowData = null;
    /**
     * The column definitions of the row
     *
     * @public
     */

    this.columnDefinitions = null;
    /**
     * Whether focus is on/in a cell within this row.
     *
     * @internal
     */

    this.isActiveRow = false;
    this.cellsRepeatBehavior = null;
    this.cellsPlaceholder = null;
    /**
     * @internal
     */

    this.focusColumnIndex = 0;
    this.refocusOnLoad = false;

    this.updateRowStyle = () => {
      this.style.gridTemplateColumns = this.gridTemplateColumns;
    };
  }

  gridTemplateColumnsChanged() {
    if (this.$fastController.isConnected) {
      this.updateRowStyle();
    }
  }

  rowTypeChanged() {
    if (this.$fastController.isConnected) {
      this.updateItemTemplate();
    }
  }

  rowDataChanged() {
    if (this.rowData !== null && this.isActiveRow) {
      this.refocusOnLoad = true;
      return;
    }
  }

  cellItemTemplateChanged() {
    this.updateItemTemplate();
  }

  headerCellItemTemplateChanged() {
    this.updateItemTemplate();
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback(); // note that row elements can be reused with a different data object
    // as the parent grid's repeat behavior reacts to changes in the data set.

    if (this.cellsRepeatBehavior === null) {
      this.cellsPlaceholder = document.createComment("");
      this.appendChild(this.cellsPlaceholder);
      this.updateItemTemplate();
      this.cellsRepeatBehavior = new RepeatDirective(x => x.columnDefinitions, x => x.activeCellItemTemplate, {
        positioning: true
      }).createBehavior(this.cellsPlaceholder);
      this.$fastController.addBehaviors([this.cellsRepeatBehavior]);
    }

    this.addEventListener("cell-focused", this.handleCellFocus);
    this.addEventListener(eventFocusOut, this.handleFocusout);
    this.addEventListener(eventKeyDown, this.handleKeydown);
    this.updateRowStyle();

    if (this.refocusOnLoad) {
      // if focus was on the row when data changed try to refocus on same cell
      this.refocusOnLoad = false;

      if (this.cellElements.length > this.focusColumnIndex) {
        this.cellElements[this.focusColumnIndex].focus();
      }
    }
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("cell-focused", this.handleCellFocus);
    this.removeEventListener(eventFocusOut, this.handleFocusout);
    this.removeEventListener(eventKeyDown, this.handleKeydown);
  }

  handleFocusout(e) {
    if (!this.contains(e.target)) {
      this.isActiveRow = false;
      this.focusColumnIndex = 0;
    }
  }

  handleCellFocus(e) {
    this.isActiveRow = true;
    this.focusColumnIndex = this.cellElements.indexOf(e.target);
    this.$emit("row-focused", this);
  }

  handleKeydown(e) {
    if (e.defaultPrevented) {
      return;
    }

    let newFocusColumnIndex = 0;

    switch (e.keyCode) {
      case keyCodeArrowLeft:
        // focus left one cell
        newFocusColumnIndex = Math.max(0, this.focusColumnIndex - 1);
        this.cellElements[newFocusColumnIndex].focus();
        e.preventDefault();
        break;

      case keyCodeArrowRight:
        // focus right one cell
        newFocusColumnIndex = Math.min(this.cellElements.length - 1, this.focusColumnIndex + 1);
        this.cellElements[newFocusColumnIndex].focus();
        e.preventDefault();
        break;

      case keyCodeHome:
        if (!e.ctrlKey) {
          this.cellElements[0].focus();
          e.preventDefault();
        }

        break;

      case keyCodeEnd:
        if (!e.ctrlKey) {
          // focus last cell of the row
          this.cellElements[this.cellElements.length - 1].focus();
          e.preventDefault();
        }

        break;
    }
  }

  updateItemTemplate() {
    this.activeCellItemTemplate = this.rowType === DataGridRowTypes.default && this.cellItemTemplate !== undefined ? this.cellItemTemplate : this.rowType === DataGridRowTypes.default && this.cellItemTemplate === undefined ? this.defaultCellItemTemplate : this.headerCellItemTemplate !== undefined ? this.headerCellItemTemplate : this.defaultHeaderCellItemTemplate;
  }

}

__decorate([attr({
  attribute: "grid-template-columns"
})], DataGridRow.prototype, "gridTemplateColumns", void 0);

__decorate([attr({
  attribute: "row-type"
})], DataGridRow.prototype, "rowType", void 0);

__decorate([observable], DataGridRow.prototype, "rowData", void 0);

__decorate([observable], DataGridRow.prototype, "columnDefinitions", void 0);

__decorate([observable], DataGridRow.prototype, "cellItemTemplate", void 0);

__decorate([observable], DataGridRow.prototype, "headerCellItemTemplate", void 0);

__decorate([observable], DataGridRow.prototype, "rowIndex", void 0);

__decorate([observable], DataGridRow.prototype, "isActiveRow", void 0);

__decorate([observable], DataGridRow.prototype, "activeCellItemTemplate", void 0);

__decorate([observable], DataGridRow.prototype, "defaultCellItemTemplate", void 0);

__decorate([observable], DataGridRow.prototype, "defaultHeaderCellItemTemplate", void 0);

__decorate([observable], DataGridRow.prototype, "cellElements", void 0);

function createRowItemTemplate(context) {
  const rowTag = context.tagFor(DataGridRow);
  return html`<${rowTag}:rowData="${x => x}" :cellItemTemplate="${(x, c) => c.parent.cellItemTemplate}" :headerCellItemTemplate="${(x, c) => c.parent.headerCellItemTemplate}"></${rowTag}>`;
}
/**
 * Generates a template for the {@link @microsoft/fast-foundation#DataGrid} component using
 * the provided prefix.
 *
 * @public
 */


const dataGridTemplate = (context, definition) => {
  const rowItemTemplate = createRowItemTemplate(context);
  const rowTag = context.tagFor(DataGridRow);
  return html`<template role="grid" tabindex="0" :rowElementTag="${() => rowTag}" :defaultRowItemTemplate="${rowItemTemplate}" ${children({
    property: "rowElements",
    filter: elements("[role=row]")
  })}><slot></slot></template>`;
};

/**
 * A Data Grid Custom HTML Element.
 *
 * @public
 */

class DataGrid extends FoundationElement {
  constructor() {
    super();
    /**
     *  Whether the grid should automatically generate a header row and its type
     *
     * @public
     * @remarks
     * HTML Attribute: generate-header
     */

    this.generateHeader = GenerateHeaderOptions.default;
    /**
     * The data being displayed in the grid
     *
     * @public
     */

    this.rowsData = [];
    /**
     * The column definitions of the grid
     *
     * @public
     */

    this.columnDefinitions = null;
    /**
     * The index of the row that will receive focus the next time the
     * grid is focused. This value changes as focus moves to different
     * rows within the grid.  Changing this value when focus is already
     * within the grid moves focus to the specified row.
     *
     * @public
     */

    this.focusRowIndex = 0;
    /**
     * The index of the column that will receive focus the next time the
     * grid is focused. This value changes as focus moves to different rows
     * within the grid.  Changing this value when focus is already within
     * the grid moves focus to the specified column.
     *
     * @public
     */

    this.focusColumnIndex = 0;
    this.rowsPlaceholder = null;
    this.generatedHeader = null;
    this.isUpdatingFocus = false;
    this.pendingFocusUpdate = false;
    this.rowindexUpdateQueued = false;
    this.columnDefinitionsStale = true;
    this.generatedGridTemplateColumns = "";

    this.focusOnCell = (rowIndex, columnIndex, scrollIntoView) => {
      if (this.rowElements.length === 0) {
        this.focusRowIndex = 0;
        this.focusColumnIndex = 0;
        return;
      }

      const focusRowIndex = Math.max(0, Math.min(this.rowElements.length - 1, rowIndex));
      const focusRow = this.rowElements[focusRowIndex];
      const cells = focusRow.querySelectorAll('[role="cell"], [role="gridcell"], [role="columnheader"]');
      const focusColumnIndex = Math.max(0, Math.min(cells.length - 1, columnIndex));
      const focusTarget = cells[focusColumnIndex];

      if (scrollIntoView && this.scrollHeight !== this.clientHeight && (focusRowIndex < this.focusRowIndex && this.scrollTop > 0 || focusRowIndex > this.focusRowIndex && this.scrollTop < this.scrollHeight - this.clientHeight)) {
        focusTarget.scrollIntoView({
          block: "center",
          inline: "center"
        });
      }

      focusTarget.focus();
    };

    this.onChildListChange = (mutations,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    observer) => {
      if (mutations.length) {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(newNode => {
            if (newNode.nodeType === 1 && newNode.getAttribute("role") === "row") {
              newNode.columnDefinitions = this.columnDefinitions;
            }
          });
        });
        this.queueRowIndexUpdate();
      }
    };

    this.queueRowIndexUpdate = () => {
      if (!this.rowindexUpdateQueued) {
        this.rowindexUpdateQueued = true;
        DOM.queueUpdate(this.updateRowIndexes);
      }
    };

    this.updateRowIndexes = () => {
      const newGridTemplateColumns = this.gridTemplateColumns === undefined ? this.generatedGridTemplateColumns : this.gridTemplateColumns;
      this.rowElements.forEach((element, index) => {
        const thisRow = element;
        thisRow.rowIndex = index;
        thisRow.gridTemplateColumns = newGridTemplateColumns;

        if (this.columnDefinitionsStale) {
          thisRow.columnDefinitions = this.columnDefinitions;
        }
      });
      this.rowindexUpdateQueued = false;
      this.columnDefinitionsStale = false;
    };
  }
  /**
   *  generates a gridTemplateColumns based on columndata array
   */


  static generateTemplateColumns(columnDefinitions) {
    let templateColumns = "";
    columnDefinitions.forEach(column => {
      templateColumns = `${templateColumns}${templateColumns === "" ? "" : " "}${"1fr"}`;
    });
    return templateColumns;
  }

  generateHeaderChanged() {
    if (this.$fastController.isConnected) {
      this.toggleGeneratedHeader();
    }
  }

  gridTemplateColumnsChanged() {
    if (this.$fastController.isConnected) {
      this.updateRowIndexes();
    }
  }

  rowsDataChanged() {
    if (this.columnDefinitions === null && this.rowsData.length > 0) {
      this.columnDefinitions = DataGrid.generateColumns(this.rowsData[0]);
    }
  }

  columnDefinitionsChanged() {
    if (this.columnDefinitions === null) {
      this.generatedGridTemplateColumns = "";
      return;
    }

    this.generatedGridTemplateColumns = DataGrid.generateTemplateColumns(this.columnDefinitions);

    if (this.$fastController.isConnected) {
      this.columnDefinitionsStale = true;
      this.queueRowIndexUpdate();
    }
  }

  headerCellItemTemplateChanged() {
    if (this.$fastController.isConnected) {
      if (this.generatedHeader !== null) {
        this.generatedHeader.headerCellItemTemplate = this.headerCellItemTemplate;
      }
    }
  }

  focusRowIndexChanged() {
    if (this.$fastController.isConnected) {
      this.queueFocusUpdate();
    }
  }

  focusColumnIndexChanged() {
    if (this.$fastController.isConnected) {
      this.queueFocusUpdate();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();

    if (this.rowItemTemplate === undefined) {
      this.rowItemTemplate = this.defaultRowItemTemplate;
    }

    this.rowsPlaceholder = document.createComment("");
    this.appendChild(this.rowsPlaceholder);
    this.toggleGeneratedHeader();
    this.rowsRepeatBehavior = new RepeatDirective(x => x.rowsData, x => x.rowItemTemplate, {
      positioning: true
    }).createBehavior(this.rowsPlaceholder);
    this.$fastController.addBehaviors([this.rowsRepeatBehavior]);
    this.addEventListener("row-focused", this.handleRowFocus);
    this.addEventListener(eventFocus, this.handleFocus);
    this.addEventListener(eventKeyDown, this.handleKeydown);
    this.addEventListener(eventFocusOut, this.handleFocusOut);
    this.observer = new MutationObserver(this.onChildListChange); // only observe if nodes are added or removed

    this.observer.observe(this, {
      childList: true
    });
    DOM.queueUpdate(this.queueRowIndexUpdate);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("row-focused", this.handleRowFocus);
    this.removeEventListener(eventFocus, this.handleFocus);
    this.removeEventListener(eventKeyDown, this.handleKeydown);
    this.removeEventListener(eventFocusOut, this.handleFocusOut); // disconnect observer

    this.observer.disconnect();
    this.rowsPlaceholder = null;
    this.generatedHeader = null;
  }
  /**
   * @internal
   */


  handleRowFocus(e) {
    this.isUpdatingFocus = true;
    const focusRow = e.target;
    this.focusRowIndex = this.rowElements.indexOf(focusRow);
    this.focusColumnIndex = focusRow.focusColumnIndex;
    this.setAttribute("tabIndex", "-1");
    this.isUpdatingFocus = false;
  }
  /**
   * @internal
   */


  handleFocus(e) {
    this.focusOnCell(this.focusRowIndex, this.focusColumnIndex, true);
  }
  /**
   * @internal
   */


  handleFocusOut(e) {
    if (e.relatedTarget === null || !this.contains(e.relatedTarget)) {
      this.setAttribute("tabIndex", "0");
    }
  }
  /**
   * @internal
   */


  handleKeydown(e) {
    if (e.defaultPrevented) {
      return;
    }

    let newFocusRowIndex;
    const maxIndex = this.rowElements.length - 1;
    const currentGridBottom = this.offsetHeight + this.scrollTop;
    const lastRow = this.rowElements[maxIndex];

    switch (e.keyCode) {
      case keyCodeArrowUp:
        e.preventDefault(); // focus up one row

        this.focusOnCell(this.focusRowIndex - 1, this.focusColumnIndex, true);
        break;

      case keyCodeArrowDown:
        e.preventDefault(); // focus down one row

        this.focusOnCell(this.focusRowIndex + 1, this.focusColumnIndex, true);
        break;

      case keyCodePageUp:
        e.preventDefault();

        if (this.rowElements.length === 0) {
          this.focusOnCell(0, 0, false);
          break;
        }

        if (this.focusRowIndex === 0) {
          this.focusOnCell(0, this.focusColumnIndex, false);
          return;
        }

        newFocusRowIndex = this.focusRowIndex - 1;

        for (newFocusRowIndex; newFocusRowIndex >= 0; newFocusRowIndex--) {
          const thisRow = this.rowElements[newFocusRowIndex];

          if (thisRow.offsetTop < this.scrollTop) {
            this.scrollTop = thisRow.offsetTop + thisRow.clientHeight - this.clientHeight;
            break;
          }
        }

        this.focusOnCell(newFocusRowIndex, this.focusColumnIndex, false);
        break;

      case keyCodePageDown:
        e.preventDefault();

        if (this.rowElements.length === 0) {
          this.focusOnCell(0, 0, false);
          break;
        } // focus down one "page"


        if (this.focusRowIndex >= maxIndex || lastRow.offsetTop + lastRow.offsetHeight <= currentGridBottom) {
          this.focusOnCell(maxIndex, this.focusColumnIndex, false);
          return;
        }

        newFocusRowIndex = this.focusRowIndex + 1;

        for (newFocusRowIndex; newFocusRowIndex <= maxIndex; newFocusRowIndex++) {
          const thisRow = this.rowElements[newFocusRowIndex];

          if (thisRow.offsetTop + thisRow.offsetHeight > currentGridBottom) {
            let stickyHeaderOffset = 0;

            if (this.generateHeader === GenerateHeaderOptions.sticky && this.generatedHeader !== null) {
              stickyHeaderOffset = this.generatedHeader.clientHeight;
            }

            this.scrollTop = thisRow.offsetTop - stickyHeaderOffset;
            break;
          }
        }

        this.focusOnCell(newFocusRowIndex, this.focusColumnIndex, false);
        break;

      case keyCodeHome:
        if (e.ctrlKey) {
          e.preventDefault(); // focus first cell of first row

          this.focusOnCell(0, 0, true);
        }

        break;

      case keyCodeEnd:
        if (e.ctrlKey && this.columnDefinitions !== null) {
          e.preventDefault(); // focus last cell of last row

          this.focusOnCell(this.rowElements.length - 1, this.columnDefinitions.length - 1, true);
        }

        break;
    }
  }

  queueFocusUpdate() {
    if (this.isUpdatingFocus && (this.contains(document.activeElement) || this === document.activeElement)) {
      return;
    }

    if (this.pendingFocusUpdate === false) {
      this.pendingFocusUpdate = true;
      DOM.queueUpdate(() => this.updateFocus());
    }
  }

  updateFocus() {
    this.pendingFocusUpdate = false;
    this.focusOnCell(this.focusRowIndex, this.focusColumnIndex, true);
  }

  toggleGeneratedHeader() {
    if (this.generatedHeader !== null) {
      this.removeChild(this.generatedHeader);
      this.generatedHeader = null;
    }

    if (this.generateHeader !== GenerateHeaderOptions.none) {
      const generatedHeaderElement = document.createElement(this.rowElementTag);
      this.generatedHeader = generatedHeaderElement;
      this.generatedHeader.columnDefinitions = this.columnDefinitions;
      this.generatedHeader.gridTemplateColumns = this.gridTemplateColumns;
      this.generatedHeader.rowType = this.generateHeader === GenerateHeaderOptions.sticky ? DataGridRowTypes.stickyHeader : DataGridRowTypes.header;

      if (this.firstChild !== null || this.rowsPlaceholder !== null) {
        this.insertBefore(generatedHeaderElement, this.firstChild !== null ? this.firstChild : this.rowsPlaceholder);
      }

      return;
    }
  }

}
/**
 *  generates a basic column definition by examining sample row data
 */

DataGrid.generateColumns = row => {
  return Object.getOwnPropertyNames(row).map((property, index) => {
    return {
      columnDataKey: property,
      gridColumn: `${index}`
    };
  });
};

__decorate([attr({
  attribute: "generate-header"
})], DataGrid.prototype, "generateHeader", void 0);

__decorate([attr({
  attribute: "grid-template-columns"
})], DataGrid.prototype, "gridTemplateColumns", void 0);

__decorate([observable], DataGrid.prototype, "rowsData", void 0);

__decorate([observable], DataGrid.prototype, "columnDefinitions", void 0);

__decorate([observable], DataGrid.prototype, "rowItemTemplate", void 0);

__decorate([observable], DataGrid.prototype, "cellItemTemplate", void 0);

__decorate([observable], DataGrid.prototype, "headerCellItemTemplate", void 0);

__decorate([observable], DataGrid.prototype, "focusRowIndex", void 0);

__decorate([observable], DataGrid.prototype, "focusColumnIndex", void 0);

__decorate([observable], DataGrid.prototype, "defaultRowItemTemplate", void 0);

__decorate([observable], DataGrid.prototype, "rowElementTag", void 0);

__decorate([observable], DataGrid.prototype, "rowElements", void 0);

const defaultCellContentsTemplate = html`<template>${x => x.rowData === null || x.columnDefinition === null || x.columnDefinition.columnDataKey === null ? null : x.rowData[x.columnDefinition.columnDataKey]}</template>`;
const defaultHeaderCellContentsTemplate = html`<template>${x => x.columnDefinition === null ? null : x.columnDefinition.title === undefined ? x.columnDefinition.columnDataKey : x.columnDefinition.title}</template>`;
/**
 * A Data Grid Cell Custom HTML Element.
 *
 * @public
 */

class DataGridCell extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The base data for the parent row
     *
     * @public
     */

    this.rowData = null;
    /**
     * The base data for the column
     *
     * @public
     */

    this.columnDefinition = null;
    this.isActiveCell = false;
    this.customCellView = null;
    this.isInternalFocused = false;

    this.updateCellStyle = () => {
      this.style.gridColumn = this.gridColumn;
    };
  }

  cellTypeChanged() {
    if (this.$fastController.isConnected) {
      this.updateCellView();
    }
  }

  gridColumnChanged() {
    if (this.$fastController.isConnected) {
      this.updateCellStyle();
    }
  }

  columnDefinitionChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.updateCellView();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    var _a;

    super.connectedCallback();
    this.addEventListener(eventFocusIn, this.handleFocusin);
    this.addEventListener(eventFocusOut, this.handleFocusout);
    this.addEventListener(eventKeyDown, this.handleKeydown);
    this.style.gridColumn = `${((_a = this.columnDefinition) === null || _a === void 0 ? void 0 : _a.gridColumn) === undefined ? 0 : this.columnDefinition.gridColumn}`;
    this.updateCellView();
    this.updateCellStyle();
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(eventFocusIn, this.handleFocusin);
    this.removeEventListener(eventFocusOut, this.handleFocusout);
    this.removeEventListener(eventKeyDown, this.handleKeydown);
    this.disconnectCellView();
  }

  handleFocusin(e) {
    if (this.isActiveCell) {
      return;
    }

    this.isActiveCell = true;

    switch (this.cellType) {
      case DataGridCellTypes.columnHeader:
        if (this.columnDefinition !== null && this.columnDefinition.headerCellInternalFocusQueue !== true && typeof this.columnDefinition.headerCellFocusTargetCallback === "function") {
          // move focus to the focus target
          const focusTarget = this.columnDefinition.headerCellFocusTargetCallback(this);

          if (focusTarget !== null) {
            focusTarget.focus();
          }
        }

        break;

      default:
        if (this.columnDefinition !== null && this.columnDefinition.cellInternalFocusQueue !== true && typeof this.columnDefinition.cellFocusTargetCallback === "function") {
          // move focus to the focus target
          const focusTarget = this.columnDefinition.cellFocusTargetCallback(this);

          if (focusTarget !== null) {
            focusTarget.focus();
          }
        }

        break;
    }

    this.$emit("cell-focused", this);
  }

  handleFocusout(e) {
    if (this !== document.activeElement && !this.contains(document.activeElement)) {
      this.isActiveCell = false;
      this.isInternalFocused = false;
    }
  }

  handleKeydown(e) {
    if (e.defaultPrevented || this.columnDefinition === null || this.cellType === DataGridCellTypes.default && this.columnDefinition.cellInternalFocusQueue !== true || this.cellType === DataGridCellTypes.columnHeader && this.columnDefinition.headerCellInternalFocusQueue !== true) {
      return;
    }

    switch (e.keyCode) {
      case keyCodeEnter:
      case keyCodeFunction2:
        if (this.isInternalFocused || this.columnDefinition === undefined) {
          return;
        }

        switch (this.cellType) {
          case DataGridCellTypes.default:
            if (this.columnDefinition.cellFocusTargetCallback !== undefined) {
              const focusTarget = this.columnDefinition.cellFocusTargetCallback(this);

              if (focusTarget !== null) {
                this.isInternalFocused = true;
                focusTarget.focus();
              }

              e.preventDefault();
            }

            break;

          case DataGridCellTypes.columnHeader:
            if (this.columnDefinition.headerCellFocusTargetCallback !== undefined) {
              const focusTarget = this.columnDefinition.headerCellFocusTargetCallback(this);

              if (focusTarget !== null) {
                this.isInternalFocused = true;
                focusTarget.focus();
              }

              e.preventDefault();
            }

            break;
        }

        break;

      case keyCodeEscape:
        if (this.isInternalFocused) {
          this.focus();
          this.isInternalFocused = false;
          e.preventDefault();
        }

        break;
    }
  }

  updateCellView() {
    this.disconnectCellView();

    if (this.columnDefinition === null) {
      return;
    }

    switch (this.cellType) {
      case DataGridCellTypes.columnHeader:
        if (this.columnDefinition.headerCellTemplate !== undefined) {
          this.customCellView = this.columnDefinition.headerCellTemplate.render(this, this);
        } else {
          this.customCellView = defaultHeaderCellContentsTemplate.render(this, this);
        }

        break;

      case undefined:
      case DataGridCellTypes.default:
        if (this.columnDefinition.cellTemplate !== undefined) {
          this.customCellView = this.columnDefinition.cellTemplate.render(this, this);
        } else {
          this.customCellView = defaultCellContentsTemplate.render(this, this);
        }

        break;
    }
  }

  disconnectCellView() {
    if (this.customCellView !== null) {
      this.customCellView.dispose();
      this.customCellView = null;
    }
  }

}

__decorate([attr({
  attribute: "cell-type"
})], DataGridCell.prototype, "cellType", void 0);

__decorate([attr({
  attribute: "grid-column"
})], DataGridCell.prototype, "gridColumn", void 0);

__decorate([observable], DataGridCell.prototype, "rowData", void 0);

__decorate([observable], DataGridCell.prototype, "columnDefinition", void 0);

function createCellItemTemplate(context) {
  const cellTag = context.tagFor(DataGridCell);
  return html`<${cellTag}grid-column="${(x, c) => c.index + 1}" :rowData="${(x, c) => c.parent.rowData}" :columnDefinition="${x => x}"></${cellTag}>`;
}

function createHeaderCellItemTemplate(context) {
  const cellTag = context.tagFor(DataGridCell);
  return html`<${cellTag}cell-type="columnheader" grid-column="${(x, c) => c.index + 1}" :columnDefinition="${x => x}"></${cellTag}>`;
}
/**
 * Generates a template for the {@link @microsoft/fast-foundation#DataGridRow} component using
 * the provided prefix.
 *
 * @public
 */


const dataGridRowTemplate = (context, definition) => {
  const cellItemTemplate = createCellItemTemplate(context);
  const headerCellItemTemplate = createHeaderCellItemTemplate(context);
  return html`<template role="row" class="${x => x.rowType !== "default" ? x.rowType : ""}" :defaultCellItemTemplate="${cellItemTemplate}" :defaultHeaderCellItemTemplate="${headerCellItemTemplate}" ${children({
    property: "cellElements",
    filter: elements('[role="cell"],[role="gridcell"],[role="columnheader"]')
  })}><slot ${slotted("slottedCellElements")}></slot></template>`;
};

/**
 * Generates a template for the {@link @microsoft/fast-foundation#DataGridCell} component using
 * the provided prefix.
 * @public
 */

const dataGridCellTemplate = (context, definition) => {
  return html`<template tabindex="-1" role="${x => x.cellType === "columnheader" ? "columnheader" : "gridcell"}" class="${x => x.cellType === "columnheader" ? "column-header" : ""}"><slot></slot></template>`;
};

/**
 * Caching mechanism for CSS custom properties
 */

class CustomPropertyManagerImpl {
  /**
   * {@inheritdoc CustomPropertyManager.get}
   */
  getElementStyles(key, value) {
    let keyCache = CustomPropertyManagerImpl.cache.get(key.cssCustomProperty);

    if (!keyCache) {
      keyCache = new Map();
      CustomPropertyManagerImpl.cache.set(key.cssCustomProperty, keyCache);
    }

    let v = keyCache.get(value);

    if (!v) {
      v = this.createElementStyles(key, value);
      keyCache.set(value, v);
    }

    return v;
  }

  getOrCreateAppliedCache(element) {
    if (CustomPropertyManagerImpl.appliedCache.has(element)) {
      return CustomPropertyManagerImpl.appliedCache.get(element);
    }

    return CustomPropertyManagerImpl.appliedCache.set(element, new Map()) && CustomPropertyManagerImpl.appliedCache.get(element);
  }
  /**
   * Creates an ElementStyles with the key/value CSS custom property
   * on the host
   */


  createElementStyles(token, value) {
    return css`:host{${token.cssCustomProperty}:${value}}`;
  }

  addTo(element, token, value) {
    if (isFastElement(element)) {
      const styles = this.getElementStyles(token, value);
      element.$fastController.addStyles(styles);
      this.getOrCreateAppliedCache(element).set(token.cssCustomProperty, styles);
    } else {
      DOM.queueUpdate(() => element.style.setProperty(token.cssCustomProperty, value));
    }
  }

  removeFrom(element, token) {
    if (isFastElement(element)) {
      const cache = this.getOrCreateAppliedCache(element);
      const styles = cache.get(token.cssCustomProperty);

      if (styles) {
        element.$fastController.removeStyles(styles);
        cache.delete(token.cssCustomProperty);
      }
    } else {
      DOM.queueUpdate(() => element.style.removeProperty(token.cssCustomProperty));
    }
  }

}

CustomPropertyManagerImpl.cache = new Map();
CustomPropertyManagerImpl.appliedCache = new WeakMap();

function isFastElement(element) {
  return element instanceof FASTElement;
}
/**
 * @internal
 */


const CustomPropertyManager = new CustomPropertyManagerImpl();

const defaultElement = document.body;
/**
 * Implementation of {@link (DesignToken:interface)}
 */

class DesignTokenImpl extends CSSDirective {
  constructor(configuration) {
    super();
    this.subscribers = new WeakMap();
    this._appliedTo = new Set();
    this.name = configuration.name;

    if (configuration.cssCustomPropertyName !== null) {
      this.cssCustomProperty = `--${configuration.cssCustomPropertyName}`;
      this.cssVar = `var(${this.cssCustomProperty})`;
    }
  }

  get appliedTo() {
    return [...this._appliedTo];
  }

  static from(nameOrConfig) {
    return new DesignTokenImpl({
      name: typeof nameOrConfig === "string" ? nameOrConfig : nameOrConfig.name,
      cssCustomPropertyName: typeof nameOrConfig === "string" ? nameOrConfig : nameOrConfig.cssCustomPropertyName === void 0 ? nameOrConfig.name : nameOrConfig.cssCustomPropertyName
    });
  }

  static isCSSDesignToken(token) {
    return typeof token.cssCustomProperty === "string";
  }

  getOrCreateSubscriberSet(target = this) {
    return this.subscribers.get(target) || this.subscribers.set(target, new Set()) && this.subscribers.get(target);
  }

  createCSS() {
    return this.cssVar || "";
  }

  getValueFor(element) {
    const node = DesignTokenNode.for(this, element);
    Observable.track(node, "value");
    return DesignTokenNode.for(this, element).value;
  }

  setValueFor(element, value) {
    this._appliedTo.add(element);

    if (value instanceof DesignTokenImpl) {
      const tokenValue = value;

      value = target => tokenValue.getValueFor(target);
    }

    DesignTokenNode.for(this, element).set(value);
    [...this.getOrCreateSubscriberSet(this), ...this.getOrCreateSubscriberSet(element)].forEach(x => x.handleChange({
      token: this,
      target: element
    }));
    return this;
  }

  deleteValueFor(element) {
    this._appliedTo.delete(element);

    DesignTokenNode.for(this, element).delete();
    return this;
  }

  withDefault(value) {
    DesignTokenNode.for(this, defaultElement).set(value);
    return this;
  }

  subscribe(subscriber, target) {
    const subscriberSet = this.getOrCreateSubscriberSet(target);

    if (!subscriberSet.has(subscriber)) {
      subscriberSet.add(subscriber);
    }
  }

  unsubscribe(subscriber, target) {
    this.getOrCreateSubscriberSet(target).delete(subscriber);
  }

}

const nodeCache = new WeakMap();
const channelCache = new Map();
const childToParent = new WeakMap();
const noop = Function.prototype;
/**
 * A node responsible for setting and getting token values,
 * emitting values to CSS custom properties, and maintaining
 * inheritance structures.
 */

class DesignTokenNode {
  constructor(token, target) {
    var _a;

    this.token = token;
    this.target = target;
    /** Track downstream nodes */

    this.children = new Set();
    this.useCSSCustomProperty = false;
    /**
     * Invoked when parent node's value changes
     */

    this.handleChange = this.unsetValueChangeHandler;
    this.bindingChangeHandler = {
      handleChange: () => {
        Observable.getNotifier(this).notify("value");
      }
    };
    this.cssCustomPropertySubscriber = {
      handleChange: () => {
        CustomPropertyManager.removeFrom(this.target, this.token);
        CustomPropertyManager.addTo(this.target, this.token, this.resolveCSSValue(this.value));
      },
      dispose: () => {
        CustomPropertyManager.removeFrom(this.target, this.token);
      }
    };
    this.tokenDependencySubscriber = {
      handleChange: record => {
        const rawValue = this.resolveRawValue();
        const target = DesignTokenNode.for(this.token, record.target); // Only act on downstream nodes

        if (this.contains(target) && !target.useCSSCustomProperty && target.resolveRawValue() === rawValue) {
          target.useCSSCustomProperty = true;
        }
      }
    };

    if (nodeCache.has(target) && nodeCache.get(target).has(token)) {
      throw new Error(`DesignTokenNode already created for ${token.name} and ${target}. Use DesignTokenNode.for() to ensure proper reuse`);
    }

    const container = DI.getOrCreateDOMContainer(this.target);
    const channel = DesignTokenNode.channel(token);
    container.register(Registration.instance(channel, this));

    if (!DesignTokenImpl.isCSSDesignToken(token)) {
      delete this.useCSSCustomPropertyChanged;
    }

    if (target instanceof FASTElement) {
      target.$fastController.addBehaviors([this]);
    } else {
      (_a = this.findParentNode()) === null || _a === void 0 ? void 0 : _a.appendChild(this);
    }
  }

  _rawValueChanged() {
    Observable.getNotifier(this).notify("value");
  }
  /**
   * The actual value set for the node, or undefined.
   * This will be a reference to the original object for all data types
   * passed by reference.
   */


  get rawValue() {
    return this._rawValue;
  }

  useCSSCustomPropertyChanged(prev, next) {
    if (next) {
      Observable.getNotifier(this).subscribe(this.cssCustomPropertySubscriber, "value");
      this.cssCustomPropertySubscriber.handleChange();
    } else if (prev) {
      Observable.getNotifier(this).unsubscribe(this.cssCustomPropertySubscriber, "value");
      this.cssCustomPropertySubscriber.dispose();
    }
  }

  bind() {
    var _a;

    (_a = this.findParentNode()) === null || _a === void 0 ? void 0 : _a.appendChild(this);
  }

  unbind() {
    var _a;

    (_a = childToParent.get(this)) === null || _a === void 0 ? void 0 : _a.removeChild(this);
    this.tearDownBindingObserver();
  }

  resolveRealValue() {
    const rawValue = this.resolveRawValue();

    if (DesignTokenNode.isDerivedTokenValue(rawValue)) {
      if (!this.bindingObserver || this.bindingObserver.source !== rawValue) {
        this.setupBindingObserver(rawValue);
      }

      return this.bindingObserver.observe(this.target, defaultExecutionContext);
    } else {
      if (this.bindingObserver) {
        this.tearDownBindingObserver();
      }

      return rawValue;
    }
  }

  resolveRawValue() {
    /* eslint-disable-next-line */
    let current = this;

    do {
      const {
        rawValue
      } = current;

      if (rawValue !== void 0) {
        return rawValue;
      }

      current = childToParent.get(current);
    } while (current !== undefined); // If there is no parent, try to resolve parent and try again.


    if (!childToParent.has(this)) {
      const parent = this.findParentNode();

      if (parent) {
        parent.appendChild(this);
        return this.resolveRawValue();
      }
    }

    throw new Error(`Value could not be retrieved for token named "${this.token.name}". Ensure the value is set for ${this.target} or an ancestor of ${this.target}. `);
  }

  resolveCSSValue(value) {
    return value && typeof value.createCSS === "function" ? value.createCSS() : value;
  }

  static channel(token) {
    return channelCache.has(token) ? channelCache.get(token) : channelCache.set(token, DI.createInterface()) && channelCache.get(token);
  }

  static isDerivedTokenValue(value) {
    return typeof value === "function";
  }

  unsetValueChangeHandler(source, key) {
    if (this._rawValue === void 0) {
      Observable.getNotifier(this).notify("value");
    }
  }

  setupBindingObserver(value) {
    this.tearDownBindingObserver();
    this.bindingObserver = Observable.binding(value, this.bindingChangeHandler);
  }

  tearDownBindingObserver() {
    if (this.bindingObserver) {
      this.bindingObserver.disconnect();
      this.bindingObserver = undefined;
    }
  }

  static for(token, target) {
    const targetCache = nodeCache.has(target) ? nodeCache.get(target) : nodeCache.set(target, new Map()) && nodeCache.get(target);
    return targetCache.has(token) ? targetCache.get(token) : targetCache.set(token, new DesignTokenNode(token, target)) && targetCache.get(token);
  }

  appendChild(child) {
    if (this.children.has(child)) {
      return;
    }

    this.children.forEach(c => {
      if (child.contains(c)) {
        this.removeChild(c);
        child.appendChild(c);
      }
    });
    this.children.add(child);
    Observable.getNotifier(this).subscribe(child, "value");
    childToParent.set(child, this);
  }

  removeChild(child) {
    this.children.delete(child);
    childToParent.delete(child);
    Observable.getNotifier(this).unsubscribe(child, "value");
  }

  contains(node) {
    return composedContains(this.target, node.target);
  }

  findParentNode() {
    if (this.target === defaultElement) {
      return null;
    }

    const parent = composedParent(this.target);

    if (this.target !== document.body && parent) {
      const container = DI.getOrCreateDOMContainer(parent); // TODO: use Container.tryGet() when added by https://github.com/microsoft/fast/issues/4582

      if (container.has(DesignTokenNode.channel(this.token), true)) {
        return container.get(DesignTokenNode.channel(this.token));
      }
    }

    return DesignTokenNode.for(this.token, defaultElement);
  }
  /**
   * The resolved value for a node.
   */


  get value() {
    return this.resolveRealValue();
  }
  /**
   * Sets a value for the node
   * @param value The value to set
   */


  set(value) {
    if (value === this._rawValue) {
      return;
    }

    this.handleChange = noop;
    this._rawValue = value;

    if (!this.useCSSCustomProperty) {
      this.useCSSCustomProperty = true;
    }

    if (this.bindingObserver) {
      const records = this.bindingObserver.records();

      for (const record of records) {
        if (record.propertySource instanceof DesignTokenNode && record.propertySource.token instanceof DesignTokenImpl) {
          const {
            token
          } = record.propertySource;
          token.subscribe(this.tokenDependencySubscriber);
          token.appliedTo.forEach(target => this.tokenDependencySubscriber.handleChange({
            token,
            target
          }));
        }
      }
    }
  }
  /**
   * Deletes any value set for the node.
   */


  delete() {
    if (this.useCSSCustomProperty) {
      this.useCSSCustomProperty = false;
    }

    this._rawValue = void 0;
    this.handleChange = this.unsetValueChangeHandler;
    this.tearDownBindingObserver();
  }

}

__decorate([observable], DesignTokenNode.prototype, "_rawValue", void 0);

__decorate([observable], DesignTokenNode.prototype, "useCSSCustomProperty", void 0);

function create(nameOrConfig) {
  return DesignTokenImpl.from(nameOrConfig);
}
/**
 * Factory object for creating {@link (DesignToken:interface)} instances.
 * @public
 */


const DesignToken = Object.freeze({
  create
});

/**
 * The template for the {@link @microsoft/fast-foundation#Dialog} component.
 * @public
 */

const dialogTemplate = (context, definition) => html`<div class="positioning-region" part="positioning-region">${when(x => x.modal, html`<div class="overlay" part="overlay" role="presentation" tabindex="-1" @click="${x => x.dismiss()}"></div>`)}<div role="dialog" class="control" part="control" aria-modal="${x => x.modal}" aria-describedby="${x => x.ariaDescribedby}" aria-labelledby="${x => x.ariaLabelledby}" aria-label="${x => x.ariaLabel}" ${ref("dialog")}><slot></slot></div></div>`;

/*!
* tabbable 5.2.0
* @license MIT, https://github.com/focus-trap/tabbable/blob/master/LICENSE
*/
var candidateSelectors = ['input', 'select', 'textarea', 'a[href]', 'button', '[tabindex]', 'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])', 'details>summary:first-of-type', 'details'];
var candidateSelector = /* #__PURE__ */candidateSelectors.join(',');
var matches = typeof Element === 'undefined' ? function () {} : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;

var isContentEditable = function isContentEditable(node) {
  return node.contentEditable === 'true';
};

var getTabindex = function getTabindex(node) {
  var tabindexAttr = parseInt(node.getAttribute('tabindex'), 10);

  if (!isNaN(tabindexAttr)) {
    return tabindexAttr;
  } // Browsers do not return `tabIndex` correctly for contentEditable nodes;
  // so if they don't have a tabindex attribute specifically set, assume it's 0.


  if (isContentEditable(node)) {
    return 0;
  } // in Chrome, <details/>, <audio controls/> and <video controls/> elements get a default
  //  `tabIndex` of -1 when the 'tabindex' attribute isn't specified in the DOM,
  //  yet they are still part of the regular tab order; in FF, they get a default
  //  `tabIndex` of 0; since Chrome still puts those elements in the regular tab
  //  order, consider their tab index to be 0.


  if ((node.nodeName === 'AUDIO' || node.nodeName === 'VIDEO' || node.nodeName === 'DETAILS') && node.getAttribute('tabindex') === null) {
    return 0;
  }

  return node.tabIndex;
};

var isInput = function isInput(node) {
  return node.tagName === 'INPUT';
};

var isHiddenInput = function isHiddenInput(node) {
  return isInput(node) && node.type === 'hidden';
};

var isDetailsWithSummary = function isDetailsWithSummary(node) {
  var r = node.tagName === 'DETAILS' && Array.prototype.slice.apply(node.children).some(function (child) {
    return child.tagName === 'SUMMARY';
  });
  return r;
};

var getCheckedRadio = function getCheckedRadio(nodes, form) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].checked && nodes[i].form === form) {
      return nodes[i];
    }
  }
};

var isTabbableRadio = function isTabbableRadio(node) {
  if (!node.name) {
    return true;
  }

  var radioScope = node.form || node.ownerDocument;

  var queryRadios = function queryRadios(name) {
    return radioScope.querySelectorAll('input[type="radio"][name="' + name + '"]');
  };

  var radioSet;

  if (typeof window !== 'undefined' && typeof window.CSS !== 'undefined' && typeof window.CSS.escape === 'function') {
    radioSet = queryRadios(window.CSS.escape(node.name));
  } else {
    try {
      radioSet = queryRadios(node.name);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s', err.message);
      return false;
    }
  }

  var checked = getCheckedRadio(radioSet, node.form);
  return !checked || checked === node;
};

var isRadio = function isRadio(node) {
  return isInput(node) && node.type === 'radio';
};

var isNonTabbableRadio = function isNonTabbableRadio(node) {
  return isRadio(node) && !isTabbableRadio(node);
};

var isHidden = function isHidden(node, displayCheck) {
  if (getComputedStyle(node).visibility === 'hidden') {
    return true;
  }

  var isDirectSummary = matches.call(node, 'details>summary:first-of-type');
  var nodeUnderDetails = isDirectSummary ? node.parentElement : node;

  if (matches.call(nodeUnderDetails, 'details:not([open]) *')) {
    return true;
  }

  if (!displayCheck || displayCheck === 'full') {
    while (node) {
      if (getComputedStyle(node).display === 'none') {
        return true;
      }

      node = node.parentElement;
    }
  } else if (displayCheck === 'non-zero-area') {
    var _node$getBoundingClie = node.getBoundingClientRect(),
        width = _node$getBoundingClie.width,
        height = _node$getBoundingClie.height;

    return width === 0 && height === 0;
  }

  return false;
};

var isNodeMatchingSelectorFocusable = function isNodeMatchingSelectorFocusable(options, node) {
  if (node.disabled || isHiddenInput(node) || isHidden(node, options.displayCheck) ||
  /* For a details element with a summary, the summary element gets the focused  */
  isDetailsWithSummary(node)) {
    return false;
  }

  return true;
};

var isNodeMatchingSelectorTabbable = function isNodeMatchingSelectorTabbable(options, node) {
  if (!isNodeMatchingSelectorFocusable(options, node) || isNonTabbableRadio(node) || getTabindex(node) < 0) {
    return false;
  }

  return true;
};

var isTabbable = function isTabbable(node, options) {
  options = options || {};

  if (!node) {
    throw new Error('No node provided');
  }

  if (matches.call(node, candidateSelector) === false) {
    return false;
  }

  return isNodeMatchingSelectorTabbable(options, node);
};

var focusableCandidateSelector = /* #__PURE__ */candidateSelectors.concat('iframe').join(',');

var isFocusable = function isFocusable(node, options) {
  options = options || {};

  if (!node) {
    throw new Error('No node provided');
  }

  if (matches.call(node, focusableCandidateSelector) === false) {
    return false;
  }

  return isNodeMatchingSelectorFocusable(options, node);
};

/**
 * A Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#dialog | ARIA dialog }.
 *
 * @public
 */

class Dialog extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * Indicates the element is modal. When modal, user interaction will be limited to the contents of the element.
     * @public
     * @defaultValue - true
     * @remarks
     * HTML Attribute: modal
     */

    this.modal = true;
    /**
     * The hidden state of the element.
     *
     * @public
     * @defaultValue - false
     * @remarks
     * HTML Attribute: hidden
     */

    this.hidden = false;
    /**
     * Indicates that the dialog should trap focus.
     *
     * @public
     * @defaultValue - true
     * @remarks
     * HTML Attribute: trap-focus
     */

    this.trapFocus = true;

    this.trapFocusChanged = () => {
      if (this.trapFocus) {
        // Add an event listener for focusin events if we should be trapping focus
        document.addEventListener("focusin", this.handleDocumentFocus); // determine if we should move focus inside the dialog

        if (this.shouldForceFocus(document.activeElement)) {
          this.focusFirstElement();
        }
      } else {
        // remove event listener if we are not trapping focus
        document.removeEventListener("focusin", this.handleDocumentFocus);
      }
    };

    this.handleDocumentKeydown = e => {
      if (!e.defaultPrevented && !this.hidden) {
        switch (e.keyCode) {
          case keyCodeEscape:
            this.dismiss();
            e.preventDefault();
            break;

          case keyCodeTab:
            this.handleTabKeyDown(e);
            break;
        }
      }
    };

    this.handleDocumentFocus = e => {
      if (!e.defaultPrevented && this.shouldForceFocus(e.target)) {
        this.focusFirstElement();
        e.preventDefault();
      }
    };

    this.handleTabKeyDown = e => {
      if (!this.trapFocus || this.hidden) {
        return;
      }

      const bounds = this.getTabQueueBounds();

      if (bounds.length === 0) {
        return;
      }

      if (bounds.length === 1) {
        // keep focus on single element
        bounds[0].focus();
        e.preventDefault();
        return;
      }

      if (e.shiftKey && e.target === bounds[0]) {
        bounds[bounds.length - 1].focus();
        e.preventDefault();
      } else if (!e.shiftKey && e.target === bounds[bounds.length - 1]) {
        bounds[0].focus();
        e.preventDefault();
      }

      return;
    };

    this.getTabQueueBounds = () => {
      const bounds = [];
      return Dialog.reduceTabbableItems(bounds, this);
    };
    /**
     * focus on first element of tab queue
     */


    this.focusFirstElement = () => {
      const bounds = this.getTabQueueBounds();

      if (bounds.length > 0) {
        bounds[0].focus();
      }
    };
    /**
     * we should only focus if focus has not already been brought to the dialog
     */


    this.shouldForceFocus = currentFocusElement => {
      return !this.hidden && !this.contains(currentFocusElement);
    };
  }
  /**
   * @internal
   */


  dismiss() {
    this.$emit("dismiss");
  }
  /**
   * The method to show the dialog.
   *
   * @public
   */


  show() {
    this.hidden = false;
  }
  /**
   * The method to hide the dialog.
   *
   * @public
   */


  hide() {
    this.hidden = true;
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleDocumentKeydown); // Ensure the DOM is updated
    // This helps avoid a delay with `autofocus` elements receiving focus

    DOM.queueUpdate(this.trapFocusChanged);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback(); // remove keydown event listener

    document.removeEventListener("keydown", this.handleDocumentKeydown); // if we are trapping focus remove the focusin listener

    if (this.trapFocus) {
      document.removeEventListener("focusin", this.handleDocumentFocus);
    }
  }
  /**
   * Reduce a collection to only its focusable elements.
   *
   * @param elements - Collection of elements to reduce
   * @param element - The current element
   *
   * @internal
   */


  static reduceTabbableItems(elements, element) {
    if (element.getAttribute("tabindex") === "-1") {
      return elements;
    }

    if (isTabbable(element) || Dialog.isFocusableFastElement(element) && Dialog.hasTabbableShadow(element)) {
      elements.push(element);
      return elements;
    }

    if (element.childElementCount) {
      return elements.concat(Array.from(element.children).reduce(Dialog.reduceTabbableItems, []));
    }

    return elements;
  }
  /**
   * Test if element is focusable fast element
   *
   * @param element - The element to check
   *
   * @internal
   */


  static isFocusableFastElement(element) {
    var _a, _b;

    return !!((_b = (_a = element.$fastController) === null || _a === void 0 ? void 0 : _a.definition.shadowOptions) === null || _b === void 0 ? void 0 : _b.delegatesFocus);
  }
  /**
   * Test if the element has a focusable shadow
   *
   * @param element - The element to check
   *
   * @internal
   */


  static hasTabbableShadow(element) {
    var _a, _b;

    return Array.from((_b = (_a = element.shadowRoot) === null || _a === void 0 ? void 0 : _a.querySelectorAll("*")) !== null && _b !== void 0 ? _b : []).some(x => {
      return isTabbable(x);
    });
  }

}

__decorate([attr({
  mode: "boolean"
})], Dialog.prototype, "modal", void 0);

__decorate([attr({
  mode: "boolean"
})], Dialog.prototype, "hidden", void 0);

__decorate([attr({
  attribute: "trap-focus",
  mode: "boolean"
})], Dialog.prototype, "trapFocus", void 0);

__decorate([attr({
  attribute: "aria-describedby"
})], Dialog.prototype, "ariaDescribedby", void 0);

__decorate([attr({
  attribute: "aria-labelledby"
})], Dialog.prototype, "ariaLabelledby", void 0);

__decorate([attr({
  attribute: "aria-label"
})], Dialog.prototype, "ariaLabel", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Disclosure} component.
 * @public
 */

const disclosureTemplate = (context, definition) => html`<details class="disclosure" ${ref("details")}><summary class="invoker" role="button" aria-controls="disclosure-content" aria-expanded="${x => x.expanded}"><slot name="start"></slot><slot name="title">${x => x.title}</slot><slot name="end"></slot></summary><div id="disclosure-content"><slot></slot></div></details>`;

/**
 * A Disclosure Custom HTML Element.
 * Based largely on the {@link https://w3c.github.io/aria-practices/#disclosure | disclosure element }.
 *
 * @public
 */

class Disclosure extends FoundationElement {
  /**
   * @internal
   */
  connectedCallback() {
    super.connectedCallback();
    this.setup();
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.details.removeEventListener("toggle", this.onToggle);
  }
  /**
   * Show extra content.
   */


  show() {
    this.details.open = true;
  }
  /**
   * Hide extra content.
   */


  hide() {
    this.details.open = false;
  }
  /**
   * Toggle the current(expanded/collapsed) state.
   */


  toggle() {
    this.details.open = !this.details.open;
  }
  /**
   * Register listener and set default disclosure mode
   */


  setup() {
    this.onToggle = this.onToggle.bind(this);
    this.details.addEventListener("toggle", this.onToggle);

    if (this.expanded) {
      this.show();
    }
  }
  /**
   * Update the aria attr and fire `toggle` event
   */


  onToggle() {
    this.expanded = this.details.open;
    this.$emit("toggle");
  }

}

__decorate([attr({
  mode: "boolean"
})], Disclosure.prototype, "expanded", void 0);

__decorate([attr], Disclosure.prototype, "title", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#Divider} component.
 * @public
 */

const dividerTemplate = (context, definition) => html`<template role="${x => x.role}"></template>`;

/**
 * Divider roles
 * @public
 */
var DividerRole;

(function (DividerRole) {
  /**
   * The divider semantically separates content
   */
  DividerRole["separator"] = "separator";
  /**
   * The divider has no semantic value and is for visual presentation only.
   */

  DividerRole["presentation"] = "presentation";
})(DividerRole || (DividerRole = {}));

/**
 * A Divider Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#separator | ARIA separator } or {@link https://www.w3.org/TR/wai-aria-1.1/#presentation | ARIA presentation}.
 *
 * @public
 */

class Divider extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The role of the element.
     *
     * @public
     * @defaultValue - {@link DividerRole.separator}
     * @remarks
     * HTML Attribute: role
     */

    this.role = DividerRole.separator;
  }

}

__decorate([attr], Divider.prototype, "role", void 0);

/**
 * The direction options for flipper.
 * @public
 */
var FlipperDirection;

(function (FlipperDirection) {
  FlipperDirection["next"] = "next";
  FlipperDirection["previous"] = "previous";
})(FlipperDirection || (FlipperDirection = {}));

/**
 * The template for the {@link @microsoft/fast-foundation#Flipper} component.
 * @public
 */

const flipperTemplate = (context, definition) => html`<template role="button" aria-disabled="${x => x.disabled ? true : void 0}" tabindex="${x => x.hiddenFromAT ? -1 : 0}" class="${x => x.direction} ${x => x.disabled ? "disabled" : ""}" @keyup="${(x, c) => x.keyupHandler(c.event)}">${when(x => x.direction === FlipperDirection.next, html`<span part="next" class="next"><slot name="next">${definition.next || ""}</slot></span>`)} ${when(x => x.direction === FlipperDirection.previous, html`<span part="previous" class="previous"><slot name="previous">${definition.previous || ""}</slot></span>`)}</template>`;

/**
 * A Flipper Custom HTML Element.
 * Flippers are a form of button that implies directional content navigation, such as in a carousel.
 *
 * @public
 */

class Flipper extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * Indicates the flipper should be hidden from assistive technology. Because flippers are often supplementary navigation, they are often hidden from assistive technology.
     *
     * @public
     * @defaultValue - true
     * @remarks
     * HTML Attribute: aria-hidden
     */

    this.hiddenFromAT = true;
    /**
     * The direction that the flipper implies navigating.
     *
     * @public
     * @remarks
     * HTML Attribute: direction
     */

    this.direction = FlipperDirection.next;
  }
  /**
   * Simulate a click event when the flipper has focus and the user hits enter or space keys
   * Blur focus if the user hits escape key
   * @param e - Keyboard event
   * @public
   */


  keyupHandler(e) {
    if (!this.hiddenFromAT) {
      const key = e.key;

      if (key === "Enter") {
        this.$emit("click", e);
      }

      if (key === "Escape") {
        this.blur();
      }
    }
  }

}

__decorate([attr({
  mode: "boolean"
})], Flipper.prototype, "disabled", void 0);

__decorate([attr({
  attribute: "aria-hidden",
  converter: booleanConverter
})], Flipper.prototype, "hiddenFromAT", void 0);

__decorate([attr], Flipper.prototype, "direction", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(ListboxOption:class)} component.
 * @public
 */

const listboxOptionTemplate = (context, definition) => html`<template aria-selected="${x => x.selected}" class="${x => x.selected ? "selected" : ""} ${x => x.disabled ? "disabled" : ""}" role="option">${startTemplate}<span class="content" part="content"><slot></slot></span>${endTemplate}</template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#(Listbox:class)} component.
 * @public
 */

const listboxTemplate = (context, definition) => html`<template aria-activedescendant="${x => x.ariaActiveDescendant}" class="listbox" role="${x => x.role}" tabindex="${x => !x.disabled ? "0" : null}" @click="${(x, c) => x.clickHandler(c.event)}" @focusin="${(x, c) => x.focusinHandler(c.event)}" @keydown="${(x, c) => x.keydownHandler(c.event)}" @mousedown="${(x, c) => x.mousedownHandler(c.event)}"><slot ${slotted({
  filter: Listbox.slottedOptionFilter,
  flatten: true,
  property: "slottedOptions"
})}></slot></template>`;

/**
 * Menu items roles.
 * @public
 */
var MenuItemRole;

(function (MenuItemRole) {
  /**
   * The menu item has a "menuitem" role
   */
  MenuItemRole["menuitem"] = "menuitem";
  /**
   * The menu item has a "menuitemcheckbox" role
   */

  MenuItemRole["menuitemcheckbox"] = "menuitemcheckbox";
  /**
   * The menu item has a "menuitemradio" role
   */

  MenuItemRole["menuitemradio"] = "menuitemradio";
})(MenuItemRole || (MenuItemRole = {}));

/**
 * A Switch Custom HTML Element.
 * Implements {@link https://www.w3.org/TR/wai-aria-1.1/#menuitem | ARIA menuitem }, {@link https://www.w3.org/TR/wai-aria-1.1/#menuitemcheckbox | ARIA menuitemcheckbox}, or {@link https://www.w3.org/TR/wai-aria-1.1/#menuitemradio | ARIA menuitemradio }.
 *
 * @public
 */

class MenuItem extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The role of the element.
     *
     * @public
     * @remarks
     * HTML Attribute: role
     */

    this.role = MenuItemRole.menuitem;
    /**
     * @internal
     */

    this.hasSubmenu = false;
    /**
     * Track current direction to pass to the anchored region
     *
     * @internal
     */

    this.currentDirection = Direction.ltr;
    this.focusSubmenuOnLoad = false;
    /**
     * @internal
     */

    this.handleMenuItemKeyDown = e => {
      if (e.defaultPrevented) {
        return false;
      }

      switch (e.keyCode) {
        case keyCodeEnter:
        case keyCodeSpace:
          this.invoke();
          return false;

        case keyCodeArrowRight:
          //open/focus on submenu
          this.expandAndFocus();
          return false;

        case keyCodeArrowLeft:
          //close submenu
          if (this.expanded) {
            this.expanded = false;
            this.focus();
            return false;
          }

      }

      return true;
    };
    /**
     * @internal
     */


    this.handleMenuItemClick = e => {
      if (e.defaultPrevented || this.disabled) {
        return false;
      }

      this.invoke();
      return false;
    };
    /**
     * @internal
     */


    this.submenuLoaded = () => {
      if (!this.focusSubmenuOnLoad) {
        return;
      }

      this.focusSubmenuOnLoad = false;

      if (this.hasSubmenu) {
        this.submenu.focus();
        this.setAttribute("tabindex", "-1");
      }
    };
    /**
     * @internal
     */


    this.handleMouseOver = e => {
      if (this.disabled || !this.hasSubmenu || this.expanded) {
        return false;
      }

      this.expanded = true;
      return false;
    };
    /**
     * @internal
     */


    this.handleMouseOut = e => {
      if (!this.expanded || this.contains(document.activeElement)) {
        return false;
      }

      this.expanded = false;
      return false;
    };
    /**
     * @internal
     */


    this.expandAndFocus = () => {
      if (!this.hasSubmenu) {
        return;
      }

      this.focusSubmenuOnLoad = true;
      this.expanded = true;
    };
    /**
     * @internal
     */


    this.invoke = () => {
      if (this.disabled) {
        return;
      }

      switch (this.role) {
        case MenuItemRole.menuitemcheckbox:
          this.checked = !this.checked;
          this.$emit("change");
          break;

        case MenuItemRole.menuitem:
          // update submenu
          this.updateSubmenu();

          if (this.hasSubmenu) {
            this.expandAndFocus();
          } else {
            this.$emit("change");
          }

          break;

        case MenuItemRole.menuitemradio:
          if (!this.checked) {
            this.checked = true;
          }

          break;
      }
    };
    /**
     * Gets the submenu element if any
     *
     * @internal
     */


    this.updateSubmenu = () => {
      this.submenu = this.domChildren().find(element => {
        return element.getAttribute("role") === "menu";
      });
      this.hasSubmenu = this.submenu === undefined ? false : true;
    };
  }

  expandedChanged(oldValue) {
    if (this.$fastController.isConnected) {
      if (this.submenu === undefined) {
        return;
      }

      if (this.expanded === false) {
        this.submenu.collapseExpandedItem();
      } else {
        this.currentDirection = getDirection(this);
      }

      this.$emit("expanded-change", this, {
        bubbles: false
      });
    }
  }

  checkedChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.$emit("change");
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    DOM.queueUpdate(() => {
      this.updateSubmenu();
    });

    if (!this.startColumnCount) {
      this.startColumnCount = 1;
    }

    this.observer = new MutationObserver(this.updateSubmenu);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.submenu = undefined;

    if (this.observer !== undefined) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }
  /**
   * get an array of valid DOM children
   */


  domChildren() {
    return Array.from(this.children);
  }

}

__decorate([attr({
  mode: "boolean"
})], MenuItem.prototype, "disabled", void 0);

__decorate([attr({
  attribute: "expanded"
})], MenuItem.prototype, "expanded", void 0);

__decorate([observable], MenuItem.prototype, "startColumnCount", void 0);

__decorate([attr], MenuItem.prototype, "role", void 0);

__decorate([attr], MenuItem.prototype, "checked", void 0);

__decorate([observable], MenuItem.prototype, "submenuRegion", void 0);

__decorate([observable], MenuItem.prototype, "hasSubmenu", void 0);

__decorate([observable], MenuItem.prototype, "currentDirection", void 0);

__decorate([observable], MenuItem.prototype, "submenu", void 0);

applyMixins(MenuItem, StartEnd);

/**
 * Generates a template for the {@link @microsoft/fast-foundation#(MenuItem:class)} component using
 * the provided prefix.
 *
 * @public
 */

const menuItemTemplate = (context, definition) => html`<template role="${x => x.role}" aria-haspopup="${x => x.hasSubmenu ? "menu" : void 0}" aria-checked="${x => x.role !== MenuItemRole.menuitem ? x.checked : void 0}" aria-disabled="${x => x.disabled}" aria-expanded="${x => x.expanded}" @keydown="${(x, c) => x.handleMenuItemKeyDown(c.event)}" @click="${(x, c) => x.handleMenuItemClick(c.event)}" @mouseover="${(x, c) => x.handleMouseOver(c.event)}" @mouseout="${(x, c) => x.handleMouseOut(c.event)}" class="${x => x.disabled ? "disabled" : ""} ${x => x.expanded ? "expanded" : ""} ${x => `indent-${x.startColumnCount}`}">${when(x => x.role === MenuItemRole.menuitemcheckbox, html`<div part="input-container" class="input-container"><span part="checkbox" class="checkbox"><slot name="checkbox-indicator">${definition.checkboxIndicator || ""}</slot></span></div>`)} ${when(x => x.role === MenuItemRole.menuitemradio, html`<div part="input-container" class="input-container"><span part="radio" class="radio"><slot name="radio-indicator">${definition.radioIndicator || ""}</slot></span></div>`)}</div>${startTemplate}<span class="content" part="content"><slot></slot></span>${endTemplate} ${when(x => x.hasSubmenu, html`<div part="expand-collapse-glyph-container" class="expand-collapse-glyph-container"><span part="expand-collapse" class="expand-collapse"><slot name="expand-collapse-indicator">${definition.expandCollapseGlyph || ""}</slot></span></div>`)} ${when(x => x.expanded, html`<${context.tagFor(AnchoredRegion)}:anchorElement="${x => x}" vertical-positioning-mode="dynamic" vertical-default-position="bottom" vertical-inset="true" horizontal-positioning-mode="dynamic" horizontal-default-position="end" class="submenu-region" dir="${x => x.currentDirection}" @loaded="${x => x.submenuLoaded()}" ${ref("submenuRegion")}part="submenu-region"><slot name="submenu"></slot></${context.tagFor(AnchoredRegion)}>`)}</template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#Menu} component.
 * @public
 */

const menuTemplate = (context, definition) => html`<template slot="${x => x.isNestedMenu() ? "submenu" : void 0}" role="menu" @keydown="${(x, c) => x.handleMenuKeyDown(c.event)}" @focusout="${(x, c) => x.handleFocusOut(c.event)}"><slot ${slotted("items")}></slot></template>`;

/**
 * A Menu Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#menu | ARIA menu }.
 *
 * @public
 */

class Menu extends FoundationElement {
  constructor() {
    super(...arguments);
    this.expandedItem = null;
    /**
     * The index of the focusable element in the items array
     * defaults to -1
     */

    this.focusIndex = -1;
    /**
     * @internal
     */

    this.isNestedMenu = () => {
      return this.parentElement !== null && isHTMLElement(this.parentElement) && this.parentElement.getAttribute("role") === "menuitem";
    };
    /**
     * if focus is moving out of the menu, reset to a stable initial state
     * @internal
     */


    this.handleFocusOut = e => {
      if (!this.contains(e.relatedTarget)) {
        this.collapseExpandedItem(); // find our first focusable element

        const focusIndex = this.menuItems.findIndex(this.isFocusableElement); // set the current focus index's tabindex to -1

        this.menuItems[this.focusIndex].setAttribute("tabindex", "-1"); // set the first focusable element tabindex to 0

        this.menuItems[focusIndex].setAttribute("tabindex", "0"); // set the focus index

        this.focusIndex = focusIndex;
      }
    };

    this.handleItemFocus = e => {
      const targetItem = e.target;

      if (targetItem !== this.menuItems[this.focusIndex]) {
        this.menuItems[this.focusIndex].setAttribute("tabindex", "-1");
        this.focusIndex = this.menuItems.indexOf(targetItem);
        targetItem.setAttribute("tabindex", "0");
      }
    };

    this.handleExpandedChanged = e => {
      if (e.defaultPrevented || e.target === null || this.menuItems.indexOf(e.target) < 0) {
        return;
      }

      e.preventDefault();
      const changedItem = e.target; // closing an expanded item without opening another

      if (this.expandedItem !== null && changedItem === this.expandedItem && changedItem.expanded === false) {
        this.expandedItem = null;
        return;
      }

      if (changedItem.expanded) {
        if (this.expandedItem !== null && this.expandedItem !== changedItem) {
          this.expandedItem.expanded = false;
        }

        this.menuItems[this.focusIndex].setAttribute("tabindex", "-1");
        this.expandedItem = changedItem;
        this.focusIndex = this.menuItems.indexOf(changedItem);
        changedItem.setAttribute("tabindex", "0");
      }
    };

    this.setItems = () => {
      const menuItems = this.menuItems.filter(this.isMenuItemElement); // if our focus index is not -1 we have items

      if (menuItems.length) {
        this.focusIndex = 0;
      }

      let indent;

      function elementIndent(el) {
        if (!(el instanceof MenuItem)) {
          return 1;
        }

        if (el.role !== MenuItemRole.menuitem && el.querySelector("[slot=start]") === null) {
          return 1;
        } else if (el.role === MenuItemRole.menuitem && el.querySelector("[slot=start]") !== null) {
          return 1;
        } else if (el.role !== MenuItemRole.menuitem && el.querySelector("[slot=start]") !== null) {
          return 2;
        } else {
          return 0;
        }
      }

      indent = menuItems.reduce((accum, current) => {
        const elementValue = elementIndent(current);
        return accum > elementValue ? accum : elementValue;
      }, 0);
      menuItems.forEach((item, index) => {
        item.setAttribute("tabindex", index === 0 ? "0" : "-1");
        item.addEventListener("expanded-change", this.handleExpandedChanged);
        item.addEventListener("focus", this.handleItemFocus);

        if (item instanceof MenuItem) {
          item.startColumnCount = indent;
        }
      });
    };

    this.resetItems = oldValue => {
      oldValue.forEach(item => {
        item.removeEventListener("expanded-change", this.handleExpandedChanged);
        item.removeEventListener("focus", this.handleItemFocus);
      });
    };
    /**
     * handle change from child element
     */


    this.changeHandler = e => {
      const changedMenuItem = e.target;
      const changeItemIndex = this.menuItems.indexOf(changedMenuItem);

      if (changeItemIndex === -1) {
        return;
      }

      if (changedMenuItem.role === "menuitemradio" && changedMenuItem.checked === true) {
        for (let i = changeItemIndex - 1; i >= 0; --i) {
          const item = this.menuItems[i];
          const role = item.getAttribute("role");

          if (role === MenuItemRole.menuitemradio) {
            item.checked = false;
          }

          if (role === "separator") {
            break;
          }
        }

        const maxIndex = this.menuItems.length - 1;

        for (let i = changeItemIndex + 1; i <= maxIndex; ++i) {
          const item = this.menuItems[i];
          const role = item.getAttribute("role");

          if (role === MenuItemRole.menuitemradio) {
            item.checked = false;
          }

          if (role === "separator") {
            break;
          }
        }
      }
    };
    /**
     * check if the item is a menu item
     */


    this.isMenuItemElement = el => {
      return isHTMLElement(el) && Menu.focusableElementRoles.hasOwnProperty(el.getAttribute("role"));
    };
    /**
     * check if the item is focusable
     */


    this.isFocusableElement = el => {
      return this.isMenuItemElement(el);
    };
  }

  itemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.menuItems = this.domChildren();
      this.resetItems(oldValue);
      this.setItems();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.menuItems = this.domChildren();
    this.addEventListener("change", this.changeHandler);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.menuItems = [];
    this.removeEventListener("change", this.changeHandler);
  }
  /**
   * Focuses the first item in the menu.
   *
   * @public
   */


  focus() {
    this.setFocus(0, 1);
  }
  /**
   * Collapses any expanded menu items.
   *
   * @public
   */


  collapseExpandedItem() {
    if (this.expandedItem !== null) {
      this.expandedItem.expanded = false;
      this.expandedItem = null;
    }
  }
  /**
   * @internal
   */


  handleMenuKeyDown(e) {
    if (e.defaultPrevented) {
      return;
    }

    switch (e.keyCode) {
      case keyCodeArrowDown:
        // go forward one index
        this.setFocus(this.focusIndex + 1, 1);
        return;

      case keyCodeArrowUp:
        // go back one index
        this.setFocus(this.focusIndex - 1, -1);
        return;

      case keyCodeEnd:
        // set focus on last item
        this.setFocus(this.menuItems.length - 1, -1);
        return;

      case keyCodeHome:
        // set focus on first item
        this.setFocus(0, 1);
        return;

      default:
        // if we are not handling the event, do not prevent default
        return true;
    }
  }
  /**
   * get an array of valid DOM children
   */


  domChildren() {
    return Array.from(this.children);
  }

  setFocus(focusIndex, adjustment) {
    if (this.menuItems === undefined) {
      return;
    }

    while (inRange(focusIndex, this.menuItems.length)) {
      const child = this.menuItems[focusIndex];

      if (this.isFocusableElement(child)) {
        // change the previous index to -1
        if (this.focusIndex > -1 && this.menuItems.length >= this.focusIndex - 1) {
          this.menuItems[this.focusIndex].setAttribute("tabindex", "-1");
        } // update the focus index


        this.focusIndex = focusIndex; // update the tabindex of next focusable element

        child.setAttribute("tabindex", "0"); // focus the element

        child.focus();
        break;
      }

      focusIndex += adjustment;
    }
  }

}
Menu.focusableElementRoles = invert(MenuItemRole);

__decorate([observable], Menu.prototype, "items", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(NumberField:class)} component.
 * @public
 */

const numberFieldTemplate = (context, definition) => html`<template class="${x => x.readOnly ? "readonly" : ""}"><label part="label" for="control" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label><div class="root" part="root">${startTemplate}<input class="control" part="control" id="control" @input="${x => x.handleTextInput()}" @change="${x => x.handleChange()}" ?autofocus="${x => x.autofocus}" ?disabled="${x => x.disabled}" list="${x => x.list}" maxlength="${x => x.maxlength}" minlength="${x => x.minlength}" placeholder="${x => x.placeholder}" ?readonly="${x => x.readOnly}" ?required="${x => x.required}" size="${x => x.size}" :value="${x => x.value}" type="text" inputmode="numeric" min="${x => x.min}" max="${x => x.max}" step="${x => x.step}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-flowto="${x => x.ariaFlowto}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" ${ref("control")}/>${when(x => !x.hideStep, html`<div class="controls" part="controls"><div class="step-up" part="step-up" @click="${x => x.stepUp()}"><slot name="step-up-glyph">${definition.stepUpGlyph || ""}</slot></div><div class="step-down" part="step-down" @click="${x => x.stepDown()}"><slot name="step-down-glyph">${definition.stepDownGlyph || ""}</slot></div></div>`)} ${endTemplate}</div></template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#(TextField:class)} component.
 * @public
 */

const textFieldTemplate = (context, definition) => html`<template class=" ${x => x.readOnly ? "readonly" : ""}"><label part="label" for="control" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted({
  property: "defaultSlottedNodes",
  filter: whitespaceFilter
})}></slot></label><div class="root" part="root">${startTemplate}<input class="control" part="control" id="control" @input="${x => x.handleTextInput()}" @change="${x => x.handleChange()}" ?autofocus="${x => x.autofocus}" ?disabled="${x => x.disabled}" list="${x => x.list}" maxlength="${x => x.maxlength}" minlength="${x => x.minlength}" pattern="${x => x.pattern}" placeholder="${x => x.placeholder}" ?readonly="${x => x.readOnly}" ?required="${x => x.required}" size="${x => x.size}" ?spellcheck="${x => x.spellcheck}" :value="${x => x.value}" type="${x => x.type}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-flowto="${x => x.ariaFlowto}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" ${ref("control")}/>${endTemplate}</div></template>`;

class _TextField extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(TextField:class)} component.
 *
 * @internal
 */


class FormAssociatedTextField extends FormAssociated(_TextField) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * Text field sub-types
 * @public
 */
var TextFieldType;

(function (TextFieldType) {
  /**
   * An email TextField
   */
  TextFieldType["email"] = "email";
  /**
   * A password TextField
   */

  TextFieldType["password"] = "password";
  /**
   * A telephone TextField
   */

  TextFieldType["tel"] = "tel";
  /**
   * A text TextField
   */

  TextFieldType["text"] = "text";
  /**
   * A URL TextField
   */

  TextFieldType["url"] = "url";
})(TextFieldType || (TextFieldType = {}));

/**
 * A Text Field Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/text | <input type="text" /> element }.
 *
 * @public
 */

class TextField extends FormAssociatedTextField {
  constructor() {
    super(...arguments);
    /**
     * Allows setting a type or mode of text.
     * @public
     * @remarks
     * HTML Attribute: type
     */

    this.type = TextFieldType.text;
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.readOnly = this.readOnly;
      this.validate();
    }
  }

  autofocusChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.autofocus = this.autofocus;
      this.validate();
    }
  }

  placeholderChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.placeholder = this.placeholder;
    }
  }

  typeChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.type = this.type;
      this.validate();
    }
  }

  listChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.setAttribute("list", this.list);
      this.validate();
    }
  }

  maxlengthChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.maxLength = this.maxlength;
      this.validate();
    }
  }

  minlengthChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.minLength = this.minlength;
      this.validate();
    }
  }

  patternChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.pattern = this.pattern;
      this.validate();
    }
  }

  sizeChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.size = this.size;
    }
  }

  spellcheckChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.spellcheck = this.spellcheck;
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", this.type);
    this.validate();

    if (this.autofocus) {
      DOM.queueUpdate(() => {
        this.focus();
      });
    }
  }
  /**
   * Handles the internal control's `input` event
   * @internal
   */


  handleTextInput() {
    this.value = this.control.value;
  }
  /**
   * Change event handler for inner control.
   * @remarks
   * "Change" events are not `composable` so they will not
   * permeate the shadow DOM boundary. This fn effectively proxies
   * the change event, emitting a `change` event whenever the internal
   * control emits a `change` event
   * @internal
   */


  handleChange() {
    this.$emit("change");
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], TextField.prototype, "readOnly", void 0);

__decorate([attr({
  mode: "boolean"
})], TextField.prototype, "autofocus", void 0);

__decorate([attr], TextField.prototype, "placeholder", void 0);

__decorate([attr], TextField.prototype, "type", void 0);

__decorate([attr], TextField.prototype, "list", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextField.prototype, "maxlength", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextField.prototype, "minlength", void 0);

__decorate([attr], TextField.prototype, "pattern", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextField.prototype, "size", void 0);

__decorate([attr({
  mode: "boolean"
})], TextField.prototype, "spellcheck", void 0);

__decorate([observable], TextField.prototype, "defaultSlottedNodes", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA textbox role
 *
 * @public
 */


class DelegatesARIATextbox {}
applyMixins(DelegatesARIATextbox, ARIAGlobalStatesAndProperties);
applyMixins(TextField, StartEnd, DelegatesARIATextbox);

class _NumberField extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(NumberField:class)} component.
 *
 * @internal
 */


class FormAssociatedNumberField extends FormAssociated(_NumberField) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * A Number Field Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number | <input type="number" /> element }.
 *
 * @public
 */

class NumberField extends FormAssociatedNumberField {
  constructor() {
    super(...arguments);
    /**
     * When true, spin buttons will not be rendered
     * @public
     * @remarks
     * HTML Attribute: autofocus
     */

    this.hideStep = false;
    /**
     * Amount to increment or decrement the value by
     * @public
     * @remarks
     * HTMLAttribute: step
     */

    this.step = 1;
  }

  maxChanged(previousValue, nextValue) {
    const numb = parseFloat(nextValue);

    if (numb !== undefined) {
      if (this.min !== undefined && numb < this.min) {
        this.max = this.min;
        this.min = numb;
      } else {
        this.max = numb;
      }
    }
  }

  minChanged(previousValue, nextValue) {
    const numb = parseFloat(nextValue);

    if (numb !== undefined) {
      if (this.max !== undefined && numb > this.max) {
        this.min = this.max;
        this.max = numb;
      } else {
        this.min = numb;
      }
    }
  }
  /**
   *
   * @param previousValue - previous stored value
   * @param nextValue - value being updated
   */


  valueChanged(previousValue, nextValue) {
    super.valueChanged(previousValue, nextValue);
    const numb = parseFloat(nextValue);
    let out = numb == nextValue ? nextValue : numb;

    if (nextValue === "" || isNaN(numb)) {
      out = "";
    } else {
      out = this.getValidValue(numb);
    }

    this.value = out;

    if (this.proxy instanceof HTMLElement) {
      this.proxy.value = this.value;
    }
  }
  /**
   * Ensures that the value is between the min and max values
   *
   * @param value - number to evaluate
   * @returns - a string repesentation
   *
   * @internal
   */


  getValidValue(value) {
    if (this.min !== undefined && value < this.min) {
      value = this.min;
    } else if (this.max !== undefined && value > this.max) {
      value = this.max;
    }

    return parseFloat(value.toPrecision(12)).toString();
  }
  /**
   * Increments the value using the step value
   *
   * @public
   */


  stepUp() {
    const stepUpValue = this.step + (parseFloat(this.value) || 0);
    this.value = this.getValidValue(stepUpValue);
    this.$emit("input");
  }
  /**
   * Decrements the value using the step value
   *
   * @public
   */


  stepDown() {
    const stepDownValue = (parseFloat(this.value) || 0) - this.step;
    this.value = this.getValidValue(stepDownValue);
    this.$emit("input");
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "number");
    this.validate();

    if (this.autofocus) {
      DOM.queueUpdate(() => {
        this.focus();
      });
    }
  }
  /**
   * Handles the internal control's `input` event
   * @internal
   */


  handleTextInput() {
    this.value = this.control.value;
  }
  /**
   * Change event handler for inner control.
   * @remarks
   * "Change" events are not `composable` so they will not
   * permeate the shadow DOM boundary. This fn effectively proxies
   * the change event, emitting a `change` event whenever the internal
   * control emits a `change` event
   * @internal
   */


  handleChange() {
    this.$emit("change");
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], NumberField.prototype, "readOnly", void 0);

__decorate([attr({
  mode: "boolean"
})], NumberField.prototype, "autofocus", void 0);

__decorate([attr({
  attribute: "hide-step",
  mode: "boolean"
})], NumberField.prototype, "hideStep", void 0);

__decorate([attr], NumberField.prototype, "placeholder", void 0);

__decorate([attr], NumberField.prototype, "list", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], NumberField.prototype, "maxlength", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], NumberField.prototype, "minlength", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], NumberField.prototype, "size", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], NumberField.prototype, "step", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], NumberField.prototype, "max", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], NumberField.prototype, "min", void 0);

__decorate([observable], NumberField.prototype, "defaultSlottedNodes", void 0);

applyMixins(NumberField, StartEnd, DelegatesARIATextbox);

/**
 * The template for the {@link @microsoft/fast-foundation#BaseProgress} component.
 * @public
 */

const progressRingTemplate = (context, definition) => html`<template role="progressbar" aria-valuenow="${x => x.value}" aria-valuemin="${x => x.min}" aria-valuemax="${x => x.max}" class="${x => x.paused ? "paused" : ""}">${when(x => typeof x.value === "number", html`<svg class="progress" part="progress" viewBox="0 0 16 16" slot="determinate"><circle class="background" part="background" cx="8px" cy="8px" r="7px"></circle><circle class="determinate" part="determinate" style="stroke-dasharray:${x => 44 * x.value / 100}px 44px" cx="8px" cy="8px" r="7px"></circle></svg>`)} ${when(x => typeof x.value !== "number", html`<slot name="indeterminate" slot="indeterminate">${definition.indeterminateIndicator || ""}</slot>`)}</template>`;

/**
 * An Progress HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#progressbar | ARIA progressbar }.
 *
 * @public
 */

class BaseProgress extends FoundationElement {}

__decorate([attr({
  converter: nullableNumberConverter
})], BaseProgress.prototype, "value", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], BaseProgress.prototype, "min", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], BaseProgress.prototype, "max", void 0);

__decorate([attr({
  mode: "boolean"
})], BaseProgress.prototype, "paused", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#BaseProgress} component.
 * @public
 */

const progressTemplate = (context, defintion) => html`<template role="progressbar" aria-valuenow="${x => x.value}" aria-valuemin="${x => x.min}" aria-valuemax="${x => x.max}" class="${x => x.paused ? "paused" : ""}">${when(x => typeof x.value === "number", html`<div class="progress" part="progress" slot="determinate"><div class="determinate" part="determinate" style="width:${x => x.value}%"></div></div>`)} ${when(x => typeof x.value !== "number", html`<div class="progress" part="progress" slot="indeterminate"><slot class="indeterminate" name="indeterminate">${defintion.indeterminateIndicator1 || ""} ${defintion.indeterminateIndicator2 || ""}</slot></div>`)}</template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#RadioGroup} component.
 * @public
 */

const radioGroupTemplate = (context, definition) => html`<template role="radiogroup" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" @click="${(x, c) => x.clickHandler(c.event)}" @keydown="${(x, c) => x.keydownHandler(c.event)}" @focusout="${(x, c) => x.focusOutHandler(c.event)}"><slot name="label"></slot><div class="positioning-region ${x => x.orientation === Orientation.horizontal ? "horizontal" : "vertical"}" part="positioning-region"><slot ${slotted({
  property: "slottedRadioButtons",
  filter: elements("[role=radio]")
})}></slot></div></template>`;

/**
 * An Radio Group Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#radiogroup | ARIA radiogroup }.
 *
 * @public
 */

class RadioGroup extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The orientation of the group
     *
     * @public
     * @remarks
     * HTML Attribute: orientation
     */

    this.orientation = Orientation.horizontal;

    this.radioChangeHandler = e => {
      const changedRadio = e.target;

      if (changedRadio.checked) {
        this.slottedRadioButtons.forEach(radio => {
          if (radio !== changedRadio) {
            radio.checked = false;

            if (!this.isInsideFoundationToolbar) {
              radio.setAttribute("tabindex", "-1");
            }
          }
        });
        this.selectedRadio = changedRadio;
        this.value = changedRadio.value;
        changedRadio.setAttribute("tabindex", "0");
        this.focusedRadio = changedRadio;
      }

      e.stopPropagation();
    };

    this.moveToRadioByIndex = (group, index) => {
      const radio = group[index];

      if (!this.isInsideToolbar) {
        radio.setAttribute("tabindex", "0");

        if (radio.readOnly) {
          this.slottedRadioButtons.forEach(nextRadio => {
            if (nextRadio !== radio) {
              nextRadio.setAttribute("tabindex", "-1");
            }
          });
        } else {
          radio.checked = true;
          this.selectedRadio = radio;
        }
      }

      this.focusedRadio = radio;
      radio.focus();
    };

    this.moveRightOffGroup = () => {
      var _a;

      (_a = this.nextElementSibling) === null || _a === void 0 ? void 0 : _a.focus();
    };

    this.moveLeftOffGroup = () => {
      var _a;

      (_a = this.previousElementSibling) === null || _a === void 0 ? void 0 : _a.focus();
    };
    /**
     * @internal
     */


    this.focusOutHandler = e => {
      const group = this.slottedRadioButtons;
      const radio = e.target;
      const index = radio !== null ? group.indexOf(radio) : 0;
      const focusedIndex = this.focusedRadio ? group.indexOf(this.focusedRadio) : -1;

      if (focusedIndex === 0 && index === focusedIndex || focusedIndex === group.length - 1 && focusedIndex === index) {
        if (!this.selectedRadio) {
          this.focusedRadio = group[0];
          this.focusedRadio.setAttribute("tabindex", "0");
          group.forEach(nextRadio => {
            if (nextRadio !== this.focusedRadio) {
              nextRadio.setAttribute("tabindex", "-1");
            }
          });
        } else {
          this.focusedRadio = this.selectedRadio;

          if (!this.isInsideFoundationToolbar) {
            this.selectedRadio.setAttribute("tabindex", "0");
            group.forEach(nextRadio => {
              if (nextRadio !== this.selectedRadio) {
                nextRadio.setAttribute("tabindex", "-1");
              }
            });
          }
        }
      }

      return true;
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      const radio = e.target;

      if (radio) {
        const group = this.slottedRadioButtons;

        if (radio.checked || group.indexOf(radio) === 0) {
          radio.setAttribute("tabindex", "0");
          this.selectedRadio = radio;
        } else {
          radio.setAttribute("tabindex", "-1");
          this.selectedRadio = null;
        }

        this.focusedRadio = radio;
      }

      e.preventDefault();
    };

    this.shouldMoveOffGroupToTheRight = (index, group, keyCode) => {
      return index === group.length && this.isInsideToolbar && keyCode === keyCodeArrowRight;
    };

    this.shouldMoveOffGroupToTheLeft = (group, keyCode) => {
      const index = this.focusedRadio ? group.indexOf(this.focusedRadio) - 1 : 0;
      return index < 0 && this.isInsideToolbar && keyCode === keyCodeArrowLeft;
    };

    this.checkFocusedRadio = () => {
      if (this.focusedRadio !== null && !this.focusedRadio.readOnly && !this.focusedRadio.checked) {
        this.focusedRadio.checked = true;
        this.focusedRadio.setAttribute("tabindex", "0");
        this.focusedRadio.focus();
        this.selectedRadio = this.focusedRadio;
      }
    };

    this.moveRight = e => {
      const group = this.slottedRadioButtons;
      let index = 0;
      index = this.focusedRadio ? group.indexOf(this.focusedRadio) + 1 : 1;

      if (this.shouldMoveOffGroupToTheRight(index, group, e.keyCode)) {
        this.moveRightOffGroup();
        return;
      } else if (index === group.length) {
        index = 0;
      }
      /* looping to get to next radio that is not disabled */

      /* matching native radio/radiogroup which does not select an item if there is only 1 in the group */


      while (index < group.length && group.length > 1) {
        if (!group[index].disabled) {
          this.moveToRadioByIndex(group, index);
          break;
        } else if (this.focusedRadio && index === group.indexOf(this.focusedRadio)) {
          break;
        } else if (index + 1 >= group.length) {
          if (this.isInsideToolbar) {
            break;
          } else {
            index = 0;
          }
        } else {
          index += 1;
        }
      }
    };

    this.moveLeft = e => {
      const group = this.slottedRadioButtons;
      let index = 0;
      index = this.focusedRadio ? group.indexOf(this.focusedRadio) - 1 : 0;
      index = index < 0 ? group.length - 1 : index;

      if (this.shouldMoveOffGroupToTheLeft(group, e.keyCode)) {
        this.moveLeftOffGroup();
        return;
      }
      /* looping to get to next radio that is not disabled */


      while (index >= 0 && group.length > 1) {
        if (!group[index].disabled) {
          this.moveToRadioByIndex(group, index);
          break;
        } else if (this.focusedRadio && index === group.indexOf(this.focusedRadio)) {
          break;
        } else if (index - 1 < 0) {
          index = group.length - 1;
        } else {
          index -= 1;
        }
      }
    };
    /**
     * keyboard handling per https://w3c.github.io/aria-practices/#for-radio-groups-not-contained-in-a-toolbar
     * navigation is different when there is an ancestor with role='toolbar'
     *
     * @internal
     */


    this.keydownHandler = e => {
      const key = e.key;

      if (key in ArrowKeys && this.isInsideFoundationToolbar) {
        return true;
      }

      switch (key) {
        case keyEnter:
          {
            this.checkFocusedRadio();
            break;
          }

        case keyArrowRight:
        case keyArrowDown:
          {
            if (this.direction === Direction.ltr) {
              this.moveRight(e);
            } else {
              this.moveLeft(e);
            }

            break;
          }

        case keyArrowLeft:
        case keyArrowUp:
          {
            if (this.direction === Direction.ltr) {
              this.moveLeft(e);
            } else {
              this.moveRight(e);
            }

            break;
          }

        default:
          {
            return true;
          }
      }
    };
  }

  readOnlyChanged() {
    if (this.slottedRadioButtons !== undefined) {
      this.slottedRadioButtons.forEach(radio => {
        if (this.readOnly) {
          radio.readOnly = true;
        } else {
          radio.readOnly = false;
        }
      });
    }
  }

  disabledChanged() {
    if (this.slottedRadioButtons !== undefined) {
      this.slottedRadioButtons.forEach(radio => {
        if (this.disabled) {
          radio.disabled = true;
        } else {
          radio.disabled = false;
        }
      });
    }
  }

  nameChanged() {
    if (this.slottedRadioButtons) {
      this.slottedRadioButtons.forEach(radio => {
        radio.setAttribute("name", this.name);
      });
    }
  }

  valueChanged() {
    if (this.slottedRadioButtons) {
      this.slottedRadioButtons.forEach(radio => {
        if (radio.getAttribute("value") === this.value) {
          radio.checked = true;
          this.selectedRadio = radio;
        }
      });
    }

    this.$emit("change");
  }

  slottedRadioButtonsChanged(oldValue, newValue) {
    if (this.slottedRadioButtons && this.slottedRadioButtons.length > 0) {
      this.setupRadioButtons();
    }
  }

  get parentToolbar() {
    return this.closest('[role="toolbar"]');
  }

  get isInsideToolbar() {
    var _a;

    return (_a = this.parentToolbar) !== null && _a !== void 0 ? _a : false;
  }

  get isInsideFoundationToolbar() {
    var _a;

    return !!((_a = this.parentToolbar) === null || _a === void 0 ? void 0 : _a["$fastController"]);
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.direction = getDirection(this);
    this.setupRadioButtons();
  }

  disconnectedCallback() {
    this.slottedRadioButtons.forEach(radio => {
      radio.removeEventListener("change", this.radioChangeHandler);
    });
  }

  setupRadioButtons() {
    const checkedRadios = this.slottedRadioButtons.filter(radio => {
      return radio.hasAttribute("checked");
    });
    const numberOfCheckedRadios = checkedRadios ? checkedRadios.length : 0;

    if (numberOfCheckedRadios > 1) {
      const lastCheckedRadio = checkedRadios[numberOfCheckedRadios - 1];
      lastCheckedRadio.checked = true;
    }

    let foundMatchingVal = false;
    this.slottedRadioButtons.forEach(radio => {
      if (this.name !== undefined) {
        radio.setAttribute("name", this.name);
      }

      if (this.disabled) {
        radio.disabled = true;
      }

      if (this.readOnly) {
        radio.readOnly = true;
      }

      if (this.value && this.value === radio.value) {
        this.selectedRadio = radio;
        this.focusedRadio = radio;
        radio.checked = true;
        radio.setAttribute("tabindex", "0");
        foundMatchingVal = true;
      } else {
        if (!this.isInsideFoundationToolbar) {
          radio.setAttribute("tabindex", "-1");
        }

        radio.checked = false;
      }

      radio.addEventListener("change", this.radioChangeHandler);
    });

    if (this.value === undefined && this.slottedRadioButtons.length > 0) {
      const checkedRadios = this.slottedRadioButtons.filter(radio => {
        return radio.hasAttribute("checked");
      });
      const numberOfCheckedRadios = checkedRadios !== null ? checkedRadios.length : 0;

      if (numberOfCheckedRadios > 0 && !foundMatchingVal) {
        const lastCheckedRadio = checkedRadios[numberOfCheckedRadios - 1];
        lastCheckedRadio.checked = true;
        this.focusedRadio = lastCheckedRadio;
        lastCheckedRadio.setAttribute("tabindex", "0");
      } else {
        this.slottedRadioButtons[0].setAttribute("tabindex", "0");
        this.focusedRadio = this.slottedRadioButtons[0];
      }
    }
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], RadioGroup.prototype, "readOnly", void 0);

__decorate([attr({
  attribute: "disabled",
  mode: "boolean"
})], RadioGroup.prototype, "disabled", void 0);

__decorate([attr], RadioGroup.prototype, "name", void 0);

__decorate([attr], RadioGroup.prototype, "value", void 0);

__decorate([attr], RadioGroup.prototype, "orientation", void 0);

__decorate([observable], RadioGroup.prototype, "childItems", void 0);

__decorate([observable], RadioGroup.prototype, "slottedRadioButtons", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Radio:class)} component.
 * @public
 */

const radioTemplate = (context, definition) => html`<template role="radio" class="${x => x.checked ? "checked" : ""} ${x => x.readOnly ? "readonly" : ""}" aria-checked="${x => x.checked}" aria-required="${x => x.required}" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" @keypress="${(x, c) => x.keypressHandler(c.event)}" @click="${(x, c) => x.clickHandler(c.event)}"><div part="control" class="control"><slot name="checked-indicator">${definition.checkedIndicator || ""}</slot></div><label part="label" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label></template>`;

class _Radio extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(Radio:class)} component.
 *
 * @internal
 */


class FormAssociatedRadio extends FormAssociated(_Radio) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * A Radio Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#radio | ARIA radio }.
 *
 * @public
 */

class Radio extends FormAssociatedRadio {
  constructor() {
    var _a;

    super();
    /**
     * The element's value to be included in form submission when checked.
     * Default to "on" to reach parity with input[type="radio"]
     *
     * @internal
     */

    this.initialValue = "on";
    /**
     * Provides the default checkedness of the input element
     * Passed down to proxy
     *
     * @public
     * @remarks
     * HTML Attribute: checked
     */

    this.checkedAttribute = false;
    /**
     * Tracks whether the "checked" property has been changed.
     * This is necessary to provide consistent behavior with
     * normal input radios
     */

    this.dirtyChecked = false;
    /**
     * @internal
     */

    this.formResetCallback = () => {
      this.checked = !!this.defaultChecked;
      this.dirtyChecked = false;
    };
    /**
     * @internal
     */


    this.keypressHandler = e => {
      switch (e.keyCode) {
        case keyCodeSpace:
          if (!this.checked && !this.readOnly) {
            this.checked = true;
          }

          return;
      }

      return true;
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      if (!this.disabled && !this.readOnly && !this.checked) {
        this.checked = true;
      }
    };

    this.checked = (_a = this.defaultChecked) !== null && _a !== void 0 ? _a : false;
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  checkedAttributeChanged() {
    this.defaultChecked = this.checkedAttribute;
  }

  defaultCheckedChanged() {
    var _a;

    if (this.$fastController.isConnected && !this.dirtyChecked) {
      // Setting this.checked will cause us to enter a dirty state,
      // but if we are clean when defaultChecked is changed, we want to stay
      // in a clean state, so reset this.dirtyChecked
      if (!this.isInsideRadioGroup()) {
        this.checked = (_a = this.defaultChecked) !== null && _a !== void 0 ? _a : false;
        this.dirtyChecked = false;
      }
    }
  }

  checkedChanged() {
    if (this.$fastController.isConnected) {
      // changing the value via code and from radio-group
      if (!this.dirtyChecked) {
        this.dirtyChecked = true;
      }

      this.updateForm();

      if (this.proxy instanceof HTMLInputElement) {
        this.proxy.checked = this.checked;
      }

      this.$emit("change");
      this.validate();
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    var _a, _b;

    super.connectedCallback();
    this.proxy.setAttribute("type", "radio");
    this.validate();

    if (((_a = this.parentElement) === null || _a === void 0 ? void 0 : _a.getAttribute("role")) !== "radiogroup" && this.getAttribute("tabindex") === null) {
      if (!this.disabled) {
        this.setAttribute("tabindex", "0");
      }
    }

    this.updateForm();

    if (this.checkedAttribute) {
      if (!this.dirtyChecked) {
        // Setting this.checked will cause us to enter a dirty state,
        // but if we are clean when defaultChecked is changed, we want to stay
        // in a clean state, so reset this.dirtyChecked
        if (!this.isInsideRadioGroup()) {
          this.checked = (_b = this.defaultChecked) !== null && _b !== void 0 ? _b : false;
          this.dirtyChecked = false;
        }
      }
    }
  }

  isInsideRadioGroup() {
    const parent = this.closest("[role=radiogroup]");
    return parent !== null;
  }

  updateForm() {
    const value = this.checked ? this.value : null;
    this.setFormValue(value, value);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Radio.prototype, "readOnly", void 0);

__decorate([observable], Radio.prototype, "name", void 0);

__decorate([attr({
  attribute: "checked",
  mode: "boolean"
})], Radio.prototype, "checkedAttribute", void 0);

__decorate([observable], Radio.prototype, "defaultSlottedNodes", void 0);

__decorate([observable], Radio.prototype, "defaultChecked", void 0);

__decorate([observable], Radio.prototype, "checked", void 0);

/**
 * A HorizontalScroll Custom HTML Element
 * @public
 */

class HorizontalScroll extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * @internal
     */

    this.framesPerSecond = 120;
    /**
     * Flag indicating that the items are being updated
     *
     * @internal
     */

    this.updatingItems = false;
    /**
     * Speed of scroll in pixels per second
     * @public
     */

    this.speed = 600;
    /**
     * Attribute used for easing, defaults to ease-in-out
     * @public
     */

    this.easing = "ease-in-out";
    /**
     * Attribute to hide flippers from assistive technology
     * @public
     */

    this.flippersHiddenFromAT = false;
    /**
     * Scrolling state
     * @internal
     */

    this.scrolling = false;
    /**
     * Detects if the component has been resized
     * @internal
     */

    this.resizeDetector = null;
  }
  /**
   * The calculated duration for a frame.
   *
   * @internal
   */


  get frameTime() {
    return 1000 / this.framesPerSecond;
  }
  /**
   * In RTL mode
   * @internal
   */


  get isRtl() {
    return this.scrollItems.length > 1 && this.scrollItems[0].offsetLeft > this.scrollItems[1].offsetLeft;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeResizeDetector();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectResizeDetector();
  }
  /**
   * Updates scroll stops and flippers when scroll items change
   * @param previous - current scroll items
   * @param next - new updated scroll items
   * @public
   */


  scrollItemsChanged(previous, next) {
    if (next && !this.updatingItems) {
      this.setStops();
    }
  }
  /**
   * destroys the instance's resize observer
   * @internal
   */


  disconnectResizeDetector() {
    if (this.resizeDetector) {
      this.resizeDetector.disconnect();
      this.resizeDetector = null;
    }
  }
  /**
   * initializes the instance's resize observer
   * @internal
   */


  initializeResizeDetector() {
    this.disconnectResizeDetector();
    this.resizeDetector = new window.ResizeObserver(this.resized.bind(this));
    this.resizeDetector.observe(this);
  }
  /**
   * Looks for slots and uses child nodes instead
   * @internal
   */


  updateScrollStops() {
    this.updatingItems = true;
    let updatedItems = [];
    this.scrollItems.forEach(item => {
      if (item instanceof HTMLSlotElement) {
        updatedItems = updatedItems.concat(item.assignedElements());
      } else {
        updatedItems.push(item);
      }
    });
    this.scrollItems = updatedItems;
    this.updatingItems = false;
  }
  /**
   * Finds all of the scroll stops between elements
   * @internal
   */


  setStops() {
    this.updateScrollStops();
    this.width = this.offsetWidth;
    let lastStop = 0;
    let stops = this.scrollItems.map(({
      offsetLeft: left,
      offsetWidth: width
    }, index) => {
      const right = left + width;

      if (this.isRtl) {
        return -right;
      }

      lastStop = right;
      return index === 0 ? 0 : left;
    }).concat(lastStop);
    /* Fixes a FireFox bug where it doesn't scroll to the start */

    stops = this.fixScrollMisalign(stops);
    /* Sort to zero */

    stops.sort((a, b) => Math.abs(a) - Math.abs(b));
    this.scrollStops = stops;
    this.setFlippers();
  }
  /**
   *
   */


  fixScrollMisalign(stops) {
    if (this.isRtl && stops.some(stop => stop > 0)) {
      stops.sort((a, b) => b - a);
      const offset = stops[0];
      stops = stops.map(stop => stop - offset);
    }

    return stops;
  }
  /**
   * Sets the controls view if enabled
   * @internal
   */


  setFlippers() {
    const position = this.scrollContainer.scrollLeft;

    if (this.previousFlipperContainer) {
      this.previousFlipperContainer.classList.toggle("disabled", position === 0);
    }

    if (this.nextFlipperContainer && this.scrollStops) {
      const lastStop = Math.abs(this.scrollStops[this.scrollStops.length - 1]);
      this.nextFlipperContainer.classList.toggle("disabled", Math.abs(position) + this.width >= lastStop);
    }
  }
  /**
   * Lets the user arrow left and right through the horizontal scroll
   * @param e - Keyboard event
   * @public
   */


  keyupHandler(e) {
    const key = e.key;

    switch (key) {
      case "ArrowLeft":
        this.scrollToPrevious();
        break;

      case "ArrowRight":
        this.scrollToNext();
        break;
    }
  }
  /**
   * Scrolls items to the left
   * @public
   */


  scrollToPrevious() {
    const scrollPosition = this.scrollContainer.scrollLeft;
    const current = this.scrollStops.findIndex((stop, index) => stop <= scrollPosition && (this.isRtl || index === this.scrollStops.length - 1 || this.scrollStops[index + 1] > scrollPosition));
    const right = Math.abs(this.scrollStops[current + 1]);
    let nextIndex = this.scrollStops.findIndex(stop => Math.abs(stop) + this.width > right);

    if (nextIndex > current || nextIndex === -1) {
      nextIndex = current > 0 ? current - 1 : 0;
    }

    this.scrollToPosition(this.scrollStops[nextIndex], scrollPosition);
  }
  /**
   * Scrolls items to the right
   * @public
   */


  scrollToNext() {
    const scrollPosition = this.scrollContainer.scrollLeft;
    const current = this.scrollStops.findIndex(stop => Math.abs(stop) >= Math.abs(scrollPosition));
    const outOfView = this.scrollStops.findIndex(stop => Math.abs(scrollPosition) + this.width <= Math.abs(stop));
    let nextIndex = current;

    if (outOfView > current + 2) {
      nextIndex = outOfView - 2;
    } else if (current < this.scrollStops.length - 2) {
      nextIndex = current + 1;
    }

    const nextStop = this.scrollStops[nextIndex];
    this.scrollToPosition(nextStop, scrollPosition);
  }
  /**
   * Handles scrolling with easing
   * @param position - starting position
   * @param newPosition - position to scroll to
   * @public
   */


  scrollToPosition(newPosition, position = this.scrollContainer.scrollLeft) {
    if (this.scrolling) {
      return;
    }

    this.scrolling = true;
    const steps = [];
    const direction = position < newPosition ? 1 : -1;
    const scrollDistance = Math.abs(newPosition - position);
    const seconds = scrollDistance / this.speed;
    const stepCount = Math.floor(this.framesPerSecond * seconds);

    if (stepCount < 1) {
      this.scrolling = false;
      return;
    }

    for (let i = 0; i < stepCount; i++) {
      const progress = i / stepCount;
      const easingFactor = this.getEasedFactor(this.easing, progress);
      const travel = scrollDistance * easingFactor * direction;
      steps.push(travel + position);
    }

    steps.push(newPosition);
    this.move(steps, this.frameTime);
  }
  /**
   *
   * @param steps - An array of positions to move
   * @param time - The duration between moves
   * @internal
   */


  move(steps, time) {
    if (!steps || steps.length <= 0) {
      this.setFlippers();
      this.scrolling = false;
      return;
    }

    this.moveStartTime = requestAnimationFrame(timestamp => {
      if (timestamp - this.moveStartTime >= time) {
        const nextStep = steps.shift();
        this.scrollContainer.scrollLeft = nextStep !== null && nextStep !== void 0 ? nextStep : this.scrollContainer.scrollLeft;
      }

      this.move(steps, time);
    });
  }
  /**
   * Monitors resize event on the horizontal-scroll element
   * @public
   */


  resized() {
    if (this.resizeTimeout) {
      this.resizeTimeout = clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      this.width = this.offsetWidth;
      this.setFlippers();
    }, this.frameTime);
  }
  /**
   * Monitors scrolled event on the content container
   * @public
   */


  scrolled() {
    if (this.scrollTimeout) {
      this.scrollTimeout = clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.setFlippers();
    }, this.frameTime);
  }
  /**
   *
   * @param easing - Type of easing
   * @param progress - Progress completed, 0 - 1
   * @internal
   */


  getEasedFactor(easing, progress) {
    if (progress > 1) {
      progress = 1;
    }

    switch (easing) {
      case "ease-in":
        return Math.pow(progress, 1.675);

      case "ease-out":
        return 1 - Math.pow(1 - progress, 1.675);

      case "ease-in-out":
        return 0.5 * (Math.sin((progress - 0.5) * Math.PI) + 1);

      default:
        return progress;
    }
  }

}

__decorate([attr({
  converter: nullableNumberConverter
})], HorizontalScroll.prototype, "speed", void 0);

__decorate([attr], HorizontalScroll.prototype, "easing", void 0);

__decorate([attr({
  attribute: "aria-hidden",
  converter: booleanConverter
})], HorizontalScroll.prototype, "flippersHiddenFromAT", void 0);

__decorate([observable], HorizontalScroll.prototype, "scrollItems", void 0);

__decorate([attr({
  attribute: "view"
})], HorizontalScroll.prototype, "view", void 0);

/**
 * @public
 */

const horizontalScrollTemplate = (context, definition) => html`<template class="horizontal-scroll" @keyup="${(x, c) => x.keyupHandler(c.event)}">${startTemplate}<div class="scroll-area"><div class="scroll-view" @scroll="${x => x.scrolled()}" ${ref("scrollContainer")}><div class="content-container"><slot ${slotted({
  property: "scrollItems",
  filter: elements()
})}></slot></div></div>${when(x => x.view !== "mobile", html`<div class="scroll scroll-prev" part="scroll-prev" ${ref("previousFlipperContainer")}><div class="scroll-action"><slot name="previous-flipper">${definition.previousFlipper || ""}</slot></div></div><div class="scroll scroll-next" part="scroll-next" ${ref("nextFlipperContainer")}><div class="scroll-action"><slot name="next-flipper">${definition.nextFlipper || ""}</slot></div></div>`)}</div>${endTemplate}</template>`;

class _Select extends Listbox {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(Select:class)} component.
 *
 * @internal
 */


class FormAssociatedSelect extends FormAssociated(_Select) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("select");
  }

}

/**
 * A Select Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#select | ARIA select }.
 *
 * @public
 */

class Select extends FormAssociatedSelect {
  constructor() {
    super(...arguments);
    /**
     * The open attribute.
     *
     * @internal
     */

    this.open = false;
    /**
     * Indicates the initial state of the position attribute.
     *
     * @internal
     */

    this.forcedPosition = false;
    /**
     * The role of the element.
     *
     * @public
     * @remarks
     * HTML Attribute: role
     */

    this.role = SelectRole.combobox;
    /**
     * Holds the current state for the calculated position of the listbox.
     *
     * @public
     */

    this.position = SelectPosition.below;
    /**
     * The max height for the listbox when opened.
     *
     * @internal
     */

    this.maxHeight = 0;
    /**
     * The value displayed on the button.
     *
     * @public
     */

    this.displayValue = "";
    /**
     * Reset the element to its first selectable option when its parent form is reset.
     *
     * @internal
     */

    this.formResetCallback = () => {
      this.setProxyOptions();
      this.setDefaultSelectedOption();
      this.value = this.firstSelectedOption.value;
    };
  }

  openChanged() {
    this.ariaExpanded = this.open ? "true" : "false";

    if (this.open) {
      this.setPositioning();
      this.focusAndScrollOptionIntoView();
      this.indexWhenOpened = this.selectedIndex;
    }
  }
  /**
   * The value property.
   *
   * @public
   */


  get value() {
    Observable.track(this, "value");
    return this._value;
  }

  set value(next) {
    const prev = `${this._value}`;

    if (this.$fastController.isConnected && this.options) {
      const selectedIndex = this.options.findIndex(el => el.value === next);
      const prevSelectedOption = this.options[this.selectedIndex];
      const nextSelectedOption = this.options[selectedIndex];
      const prevSelectedValue = prevSelectedOption ? prevSelectedOption.value : null;
      const nextSelectedValue = nextSelectedOption ? nextSelectedOption.value : null;

      if (selectedIndex === -1 || prevSelectedValue !== nextSelectedValue) {
        next = "";
        this.selectedIndex = selectedIndex;
      }

      if (this.firstSelectedOption) {
        next = this.firstSelectedOption.value;
      }
    }

    if (prev !== next) {
      this._value = next;
      super.valueChanged(prev, next);
      Observable.notify(this, "value");
    }
  }

  updateValue(shouldEmit) {
    if (this.$fastController.isConnected) {
      this.value = this.firstSelectedOption ? this.firstSelectedOption.value : "";
      this.displayValue = this.firstSelectedOption ? this.firstSelectedOption.textContent || this.firstSelectedOption.value : this.value;
    }

    if (shouldEmit) {
      this.$emit("input");
      this.$emit("change", this, {
        bubbles: true,
        composed: undefined
      });
    }
  }
  /**
   * Updates the proxy value when the selected index changes.
   *
   * @param prev - the previous selected index
   * @param next - the next selected index
   *
   * @internal
   */


  selectedIndexChanged(prev, next) {
    super.selectedIndexChanged(prev, next);
    this.updateValue();
  }
  /**
   * Calculate and apply listbox positioning based on available viewport space.
   *
   * @param force - direction to force the listbox to display
   * @public
   */


  setPositioning() {
    const currentBox = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const availableBottom = viewportHeight - currentBox.bottom;
    this.position = this.forcedPosition ? this.positionAttribute : currentBox.top > availableBottom ? SelectPosition.above : SelectPosition.below;
    this.positionAttribute = this.forcedPosition ? this.positionAttribute : this.position;
    this.maxHeight = this.position === SelectPosition.above ? ~~currentBox.top : ~~availableBottom;
  }
  /**
   * Synchronize the `aria-disabled` property when the `disabled` property changes.
   *
   * @param prev - The previous disabled value
   * @param next - The next disabled value
   *
   * @internal
   */


  disabledChanged(prev, next) {
    if (super.disabledChanged) {
      super.disabledChanged(prev, next);
    }

    this.ariaDisabled = this.disabled ? "true" : "false";
  }
  /**
   * Handle opening and closing the listbox when the select is clicked.
   *
   * @param e - the mouse event
   * @internal
   */


  clickHandler(e) {
    // do nothing if the select is disabled
    if (this.disabled) {
      return;
    }

    if (this.open) {
      const captured = e.target.closest(`option,[role=option]`);

      if (captured && captured.disabled) {
        return;
      }
    }

    super.clickHandler(e);
    this.open = !this.open;

    if (!this.open && this.indexWhenOpened !== this.selectedIndex) {
      this.updateValue(true);
    }

    return true;
  }
  /**
   * Handle focus state when the element or its children lose focus.
   *
   * @param e - The focus event
   * @internal
   */


  focusoutHandler(e) {
    var _a;

    if (!this.open) {
      return true;
    }

    const focusTarget = e.relatedTarget;

    if (this.isSameNode(focusTarget)) {
      this.focus();
      return;
    }

    if (!((_a = this.options) === null || _a === void 0 ? void 0 : _a.includes(focusTarget))) {
      this.open = false;

      if (this.indexWhenOpened !== this.selectedIndex) {
        this.updateValue(true);
      }
    }
  }
  /**
   * Synchronize the form-associated proxy and update the value property of the element.
   *
   * @param prev - the previous collection of slotted option elements
   * @param next - the next collection of slotted option elements
   *
   * @internal
   */


  slottedOptionsChanged(prev, next) {
    super.slottedOptionsChanged(prev, next);
    this.setProxyOptions();
    this.updateValue();
  }
  /**
   * Reset and fill the proxy to match the component's options.
   *
   * @internal
   */


  setProxyOptions() {
    if (this.proxy instanceof HTMLSelectElement && this.options) {
      this.proxy.options.length = 0;
      this.options.forEach(option => {
        const proxyOption = option.proxy || (option instanceof HTMLOptionElement ? option.cloneNode() : null);

        if (proxyOption) {
          this.proxy.appendChild(proxyOption);
        }
      });
    }
  }
  /**
   * Handle keyboard interaction for the select.
   *
   * @param e - the keyboard event
   * @internal
   */


  keydownHandler(e) {
    super.keydownHandler(e);
    const key = e.key || e.key.charCodeAt(0);

    switch (key) {
      case " ":
        {
          if (this.typeAheadExpired) {
            e.preventDefault();
            this.open = !this.open;
          }

          break;
        }

      case "Enter":
        {
          e.preventDefault();
          this.open = !this.open;
          break;
        }

      case "Escape":
        {
          if (this.open) {
            e.preventDefault();
            this.open = false;
          }

          break;
        }

      case "Tab":
        {
          if (!this.open) {
            return true;
          }

          e.preventDefault();
          this.open = false;
        }
    }

    if (!this.open && this.indexWhenOpened !== this.selectedIndex) {
      this.updateValue(true);
      this.indexWhenOpened = this.selectedIndex;
    }

    return true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.forcedPosition = !!this.positionAttribute;
  }

}

__decorate([attr({
  attribute: "open",
  mode: "boolean"
})], Select.prototype, "open", void 0);

__decorate([attr({
  attribute: "position"
})], Select.prototype, "positionAttribute", void 0);

__decorate([observable], Select.prototype, "position", void 0);

__decorate([observable], Select.prototype, "maxHeight", void 0);

__decorate([observable], Select.prototype, "displayValue", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA select role.
 *
 * @public
 */


class DelegatesARIASelect {}

__decorate([observable], DelegatesARIASelect.prototype, "ariaExpanded", void 0);

__decorate([attr({
  attribute: "aria-pressed",
  mode: "fromView"
})], DelegatesARIASelect.prototype, "ariaPressed", void 0);

applyMixins(DelegatesARIASelect, ARIAGlobalStatesAndProperties);
applyMixins(Select, StartEnd, DelegatesARIASelect);

/**
 * The template for the {@link @microsoft/fast-foundation#(Select:class)} component.
 * @public
 */

const selectTemplate = (context, definition) => html`<template class="${x => x.open ? "open" : ""} ${x => x.disabled ? "disabled" : ""} ${x => x.position}" role="${x => x.role}" tabindex="${x => !x.disabled ? "0" : null}" aria-disabled="${x => x.ariaDisabled}" aria-expanded="${x => x.ariaExpanded}" @click="${(x, c) => x.clickHandler(c.event)}" @focusout="${(x, c) => x.focusoutHandler(c.event)}" @keydown="${(x, c) => x.keydownHandler(c.event)}"><div aria-activedescendant="${x => x.open ? x.ariaActiveDescendant : null}" aria-controls="listbox" aria-expanded="${x => x.ariaExpanded}" aria-haspopup="listbox" class="control" part="control" role="button" ?disabled="${x => x.disabled}">${startTemplate}<slot name="button-container"><div class="selected-value" part="selected-value"><slot name="selected-value">${x => x.displayValue}</slot></div><div class="indicator" part="indicator" aria-hidden="true"><slot name="indicator">${definition.indicator || ""}</slot></div></slot>${endTemplate}</div><div aria-disabled="${x => x.disabled}" class="listbox" id="listbox" part="listbox" role="listbox" style="--max-height:${x => x.maxHeight}px" ?disabled="${x => x.disabled}" ?hidden="${x => !x.open}"><slot ${slotted({
  filter: Listbox.slottedOptionFilter,
  flatten: true,
  property: "slottedOptions"
})}></slot></div></template>`;

/**
 * The template for the fast-skeleton component
 * @public
 */

const skeletonTemplate = (context, definition) => html`<template class="${x => x.shape === "circle" ? "circle" : "rect"}" pattern="${x => x.pattern}" ?shimmer="${x => x.shimmer}">${when(x => x.shimmer === true, html`<span class="shimmer"></span>`)}<object type="image/svg+xml" data="${x => x.pattern}"><img class="pattern" src="${x => x.pattern}" /></object><slot></slot></template>`;

/**
 * A Skeleton Custom HTML Element.
 *
 * @public
 */

class Skeleton extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * Indicates what the shape of the Skeleton should be.
     *
     * @public
     * @remarks
     * HTML Attribute: shape
     */

    this.shape = "rect";
  }

}

__decorate([attr], Skeleton.prototype, "fill", void 0);

__decorate([attr], Skeleton.prototype, "shape", void 0);

__decorate([attr], Skeleton.prototype, "pattern", void 0);

__decorate([attr({
  mode: "boolean"
})], Skeleton.prototype, "shimmer", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(SliderLabel:class)} component.
 * @public
 */

const sliderLabelTemplate = (context, definition) => html`<template aria-disabled="${x => x.disabled}" class="${x => x.sliderOrientation || Orientation.horizontal} ${x => x.disabled ? "disabled" : ""}"><div ${ref("root")}part="root" class="root" style="${x => x.positionStyle}"><div class="container">${when(x => !x.hideMark, html`<div class="mark"></div>`)}<div class="label"><slot></slot></div></div></div></template>`;

/**
 * Converts a pixel coordinate on the track to a percent of the track's range
 */

function convertPixelToPercent(pixelPos, minPosition, maxPosition, direction) {
  let pct = limit(0, 1, (pixelPos - minPosition) / (maxPosition - minPosition));

  if (direction === Direction.rtl) {
    pct = 1 - pct;
  }

  return pct;
}

const defaultConfig = {
  min: 0,
  max: 0,
  direction: Direction.ltr,
  orientation: Orientation.horizontal,
  disabled: false
};
/**
 * A label element intended to be used with the {@link @microsoft/fast-foundation#(Slider:class)} component.
 *
 * @public
 */

class SliderLabel extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * Hides the tick mark.
     *
     * @public
     * @remarks
     * HTML Attribute: hide-mark
     */

    this.hideMark = false;
    /**
     * @internal
     */

    this.sliderDirection = Direction.ltr;

    this.getSliderConfiguration = () => {
      if (!this.isSliderConfig(this.parentNode)) {
        this.sliderDirection = defaultConfig.direction || Direction.ltr;
        this.sliderOrientation = defaultConfig.orientation || Orientation.horizontal;
        this.sliderMaxPosition = defaultConfig.max;
        this.sliderMinPosition = defaultConfig.min;
      } else {
        const parentSlider = this.parentNode;
        const {
          min,
          max,
          direction,
          orientation,
          disabled
        } = parentSlider;

        if (disabled !== undefined) {
          this.disabled = disabled;
        }

        this.sliderDirection = direction || Direction.ltr;
        this.sliderOrientation = orientation || Orientation.horizontal;
        this.sliderMaxPosition = max;
        this.sliderMinPosition = min;
      }
    };

    this.positionAsStyle = () => {
      const direction = this.sliderDirection ? this.sliderDirection : Direction.ltr;
      const pct = convertPixelToPercent(Number(this.position), Number(this.sliderMinPosition), Number(this.sliderMaxPosition));
      let rightNum = Math.round((1 - pct) * 100);
      let leftNum = Math.round(pct * 100);

      if (leftNum === Number.NaN && rightNum === Number.NaN) {
        rightNum = 50;
        leftNum = 50;
      }

      if (this.sliderOrientation === Orientation.horizontal) {
        return direction === Direction.rtl ? `right: ${leftNum}%; left: ${rightNum}%;` : `left: ${leftNum}%; right: ${rightNum}%;`;
      } else {
        return `top: ${leftNum}%; bottom: ${rightNum}%;`;
      }
    };
  }

  positionChanged() {
    this.positionStyle = this.positionAsStyle();
  }
  /**
   * @internal
   */


  sliderOrientationChanged() {
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.getSliderConfiguration();
    this.positionStyle = this.positionAsStyle();
    this.notifier = Observable.getNotifier(this.parentNode);
    this.notifier.subscribe(this, "orientation");
    this.notifier.subscribe(this, "direction");
    this.notifier.subscribe(this, "max");
    this.notifier.subscribe(this, "min");
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();
    this.notifier.unsubscribe(this, "orientation");
    this.notifier.unsubscribe(this, "direction");
    this.notifier.unsubscribe(this, "max");
    this.notifier.unsubscribe(this, "min");
  }
  /**
   * @internal
   */


  handleChange(source, propertyName) {
    switch (propertyName) {
      case "direction":
        this.sliderDirection = source.direction;
        break;

      case "orientation":
        this.sliderOrientation = source.orientation;
        break;

      case "max":
        this.sliderMinPosition = source.max;
        break;

      case "min":
        this.sliderMinPosition = source.min;
        break;
    }

    this.positionStyle = this.positionAsStyle();
  }

  isSliderConfig(node) {
    return node.max !== undefined && node.min !== undefined;
  }

}

__decorate([observable], SliderLabel.prototype, "positionStyle", void 0);

__decorate([attr], SliderLabel.prototype, "position", void 0);

__decorate([attr({
  attribute: "hide-mark",
  mode: "boolean"
})], SliderLabel.prototype, "hideMark", void 0);

__decorate([attr({
  attribute: "disabled",
  mode: "boolean"
})], SliderLabel.prototype, "disabled", void 0);

__decorate([observable], SliderLabel.prototype, "sliderOrientation", void 0);

__decorate([observable], SliderLabel.prototype, "sliderMinPosition", void 0);

__decorate([observable], SliderLabel.prototype, "sliderMaxPosition", void 0);

__decorate([observable], SliderLabel.prototype, "sliderDirection", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Slider:class)} component.
 * @public
 */

const sliderTemplate = (context, definition) => html`<template role="slider" class="${x => x.readOnly ? "readonly" : ""} ${x => x.orientation || Orientation.horizontal}" tabindex="${x => x.disabled ? null : 0}" aria-valuetext="${x => x.valueTextFormatter(x.value)}" aria-valuenow="${x => x.value}" aria-valuemin="${x => x.min}" aria-valuemax="${x => x.max}" aria-disabled="${x => x.disabled ? true : void 0}" aria-readonly="${x => x.readOnly ? true : void 0}" aria-orientation="${x => x.orientation}" class="${x => x.orientation}"><div part="positioning-region" class="positioning-region"><div ${ref("track")}part="track-container" class="track"><slot name="track"></slot></div><slot></slot><div ${ref("thumb")}part="thumb-container" class="thumb-container" style="${x => x.position}"><slot name="thumb">${definition.thumb || ""}</slot></div></div></template>`;

class _Slider extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(Slider:class)} component.
 *
 * @internal
 */


class FormAssociatedSlider extends FormAssociated(_Slider) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * The selection modes of a {@link @microsoft/fast-foundation#(Slider:class)}.
 * @public
 */

var SliderMode;

(function (SliderMode) {
  SliderMode["singleValue"] = "single-value";
})(SliderMode || (SliderMode = {}));
/**
 * A Slider Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#slider | ARIA slider }.
 *
 * @public
 */


class Slider extends FormAssociatedSlider {
  constructor() {
    super(...arguments);
    /**
     * @internal
     */

    this.direction = Direction.ltr;
    /**
     * @internal
     */

    this.isDragging = false;
    /**
     * @internal
     */

    this.trackWidth = 0;
    /**
     * @internal
     */

    this.trackMinWidth = 0;
    /**
     * @internal
     */

    this.trackHeight = 0;
    /**
     * @internal
     */

    this.trackLeft = 0;
    /**
     * @internal
     */

    this.trackMinHeight = 0;
    /**
     * Custom function that generates a string for the component's "aria-valuetext" attribute based on the current value.
     *
     * @public
     */

    this.valueTextFormatter = () => null;
    /**
     * The minimum allowed value.
     *
     * @defaultValue - 0
     * @public
     * @remarks
     * HTML Attribute: min
     */


    this.min = 0; // Map to proxy element.

    /**
     * The maximum allowed value.
     *
     * @defaultValue - 10
     * @public
     * @remarks
     * HTML Attribute: max
     */

    this.max = 10; // Map to proxy element.

    /**
     * Value to increment or decrement via arrow keys, mouse click or drag.
     *
     * @public
     * @remarks
     * HTML Attribute: step
     */

    this.step = 1; // Map to proxy element.

    /**
     * The orientation of the slider.
     *
     * @public
     * @remarks
     * HTML Attribute: orientation
     */

    this.orientation = Orientation.horizontal;
    /**
     * The selection mode.
     *
     * @public
     * @remarks
     * HTML Attribute: mode
     */

    this.mode = SliderMode.singleValue;

    this.keypressHandler = e => {
      if (e.keyCode !== keyCodeTab) {
        e.preventDefault();
      }

      if (e.keyCode === keyCodeHome) {
        this.value = `${this.min}`;
      } else if (e.keyCode === keyCodeEnd) {
        this.value = `${this.max}`;
      } else if (!e.shiftKey) {
        switch (e.keyCode) {
          case keyCodeArrowRight:
          case keyCodeArrowUp:
            this.increment();
            break;

          case keyCodeArrowLeft:
          case keyCodeArrowDown:
            this.decrement();
            break;
        }
      }
    };

    this.setupTrackConstraints = () => {
      const clientRect = this.track.getBoundingClientRect();
      this.trackWidth = this.track.clientWidth;
      this.trackMinWidth = this.track.clientLeft;
      this.trackHeight = clientRect.bottom;
      this.trackMinHeight = clientRect.top;
      this.trackLeft = this.getBoundingClientRect().left;

      if (this.trackWidth === 0) {
        this.trackWidth = 1;
      }
    };

    this.setupListeners = () => {
      this.addEventListener("keydown", this.keypressHandler);
      this.addEventListener("mousedown", this.handleMouseDown);
      this.thumb.addEventListener("mousedown", this.handleThumbMouseDown);
      this.thumb.addEventListener("touchstart", this.handleThumbMouseDown);
    };
    /**
     * @internal
     */


    this.initialValue = "";
    /**
     *  Handle mouse moves during a thumb drag operation
     */

    this.handleThumbMouseDown = event => {
      if (this.readOnly || this.disabled || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      event.target.focus();
      window.addEventListener("mouseup", this.handleWindowMouseUp);
      window.addEventListener("mousemove", this.handleMouseMove);
      window.addEventListener("touchmove", this.handleMouseMove);
      window.addEventListener("touchend", this.handleWindowMouseUp);
      this.isDragging = true;
    };
    /**
     *  Handle mouse moves during a thumb drag operation
     */


    this.handleMouseMove = e => {
      if (this.readOnly || this.disabled || e.defaultPrevented) {
        return;
      } // update the value based on current position


      const sourceEvent = window.TouchEvent && e instanceof TouchEvent ? e.touches[0] : e;
      const eventValue = this.orientation === Orientation.horizontal ? sourceEvent.pageX - this.trackLeft : sourceEvent.pageY;
      this.value = `${this.calculateNewValue(eventValue)}`;
    };

    this.calculateNewValue = rawValue => {
      // update the value based on current position
      const newPosition = convertPixelToPercent(rawValue, this.orientation === Orientation.horizontal ? this.trackMinWidth : this.trackMinHeight, this.orientation === Orientation.horizontal ? this.trackWidth : this.trackHeight, this.direction);
      const newValue = (this.max - this.min) * newPosition + this.min;
      return this.convertToConstrainedValue(newValue);
    };
    /**
     * Handle a window mouse up during a drag operation
     */


    this.handleWindowMouseUp = event => {
      this.stopDragging();
    };

    this.stopDragging = () => {
      this.isDragging = false;
      window.removeEventListener("mouseup", this.handleWindowMouseUp);
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("touchmove", this.handleMouseMove);
      window.removeEventListener("touchend", this.handleWindowMouseUp);
    };

    this.handleMouseDown = e => {
      e.preventDefault();

      if (!this.disabled && !this.readOnly) {
        this.setupTrackConstraints();
        e.target.focus();
        window.addEventListener("mouseup", this.handleWindowMouseUp);
        window.addEventListener("mousemove", this.handleMouseMove);
        const controlValue = this.orientation === Orientation.horizontal ? e.pageX - this.trackLeft : e.pageY;
        this.value = `${this.calculateNewValue(controlValue)}`;
      }
    };

    this.convertToConstrainedValue = value => {
      if (isNaN(value)) {
        value = this.min;
      }
      /**
       * The following logic intends to overcome the issue with math in JavaScript with regards to floating point numbers.
       * This is needed as the `step` may be an integer but could also be a float. To accomplish this the step  is assumed to be a float
       * and is converted to an integer by determining the number of decimal places it represent, multiplying it until it is an
       * integer and then dividing it to get back to the correct number.
       */


      let constrainedValue = value - this.min;
      const roundedConstrainedValue = Math.round(constrainedValue / this.step);
      const remainderValue = constrainedValue - roundedConstrainedValue * (this.stepMultiplier * this.step) / this.stepMultiplier;
      constrainedValue = remainderValue >= Number(this.step) / 2 ? constrainedValue - remainderValue + Number(this.step) : constrainedValue - remainderValue;
      return constrainedValue + this.min;
    };
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }
  /**
   * @internal
   */


  valueChanged(previous, next) {
    super.valueChanged(previous, next);

    if (this.$fastController.isConnected) {
      this.setThumbPositionForOrientation(this.direction);
    }

    this.$emit("change");
  }

  minChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.min = `${this.min}`;
    }

    this.validate();
  }

  maxChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.max = `${this.max}`;
    }

    this.validate();
  }

  stepChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.step = `${this.step}`;
    }

    this.updateStepMultiplier();
    this.validate();
  }

  orientationChanged() {
    if (this.$fastController.isConnected) {
      this.setThumbPositionForOrientation(this.direction);
    }
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "range");
    this.direction = getDirection(this);
    this.updateStepMultiplier();
    this.setupTrackConstraints();
    this.setupListeners();
    this.setupDefaultValue();
    this.setThumbPositionForOrientation(this.direction);
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    this.removeEventListener("keydown", this.keypressHandler);
    this.removeEventListener("mousedown", this.handleMouseDown);
    this.thumb.removeEventListener("mousedown", this.handleThumbMouseDown);
    this.thumb.removeEventListener("touchstart", this.handleThumbMouseDown);
  }
  /**
   * Increment the value by the step
   *
   * @public
   */


  increment() {
    const newVal = this.direction !== Direction.rtl && this.orientation !== Orientation.vertical ? Number(this.value) + Number(this.step) : Number(this.value) - Number(this.step);
    const incrementedVal = this.convertToConstrainedValue(newVal);
    const incrementedValString = incrementedVal < Number(this.max) ? `${incrementedVal}` : `${this.max}`;
    this.value = incrementedValString;
  }
  /**
   * Decrement the value by the step
   *
   * @public
   */


  decrement() {
    const newVal = this.direction !== Direction.rtl && this.orientation !== Orientation.vertical ? Number(this.value) - Number(this.step) : Number(this.value) + Number(this.step);
    const decrementedVal = this.convertToConstrainedValue(newVal);
    const decrementedValString = decrementedVal > Number(this.min) ? `${decrementedVal}` : `${this.min}`;
    this.value = decrementedValString;
  }
  /**
   * Places the thumb based on the current value
   *
   * @public
   * @param direction - writing mode
   */


  setThumbPositionForOrientation(direction) {
    const newPct = convertPixelToPercent(Number(this.value), Number(this.min), Number(this.max), direction);
    const percentage = Math.round((1 - newPct) * 100);

    if (this.orientation === Orientation.horizontal) {
      this.position = this.isDragging ? `right: ${percentage}%; transition: none;` : `right: ${percentage}%; transition: all 0.2s ease;`;
    } else {
      this.position = this.isDragging ? `bottom: ${percentage}%; transition: none;` : `bottom: ${percentage}%; transition: all 0.2s ease;`;
    }
  }
  /**
   * Update the step multiplier used to ensure rounding errors from steps that
   * are not whole numbers
   */


  updateStepMultiplier() {
    const stepString = this.step + "";
    const decimalPlacesOfStep = !!(this.step % 1) ? stepString.length - stepString.indexOf(".") - 1 : 0;
    this.stepMultiplier = Math.pow(10, decimalPlacesOfStep);
  }

  get midpoint() {
    return `${this.convertToConstrainedValue((this.max + this.min) / 2)}`;
  }

  setupDefaultValue() {
    if (typeof this.value === "string") {
      if (this.value.length === 0) {
        this.initialValue = this.midpoint;
      } else {
        const value = parseFloat(this.value);

        if (!Number.isNaN(value) && (value < this.min || value > this.max)) {
          this.value = this.midpoint;
        }
      }
    }
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Slider.prototype, "readOnly", void 0);

__decorate([observable], Slider.prototype, "direction", void 0);

__decorate([observable], Slider.prototype, "isDragging", void 0);

__decorate([observable], Slider.prototype, "position", void 0);

__decorate([observable], Slider.prototype, "trackWidth", void 0);

__decorate([observable], Slider.prototype, "trackMinWidth", void 0);

__decorate([observable], Slider.prototype, "trackHeight", void 0);

__decorate([observable], Slider.prototype, "trackLeft", void 0);

__decorate([observable], Slider.prototype, "trackMinHeight", void 0);

__decorate([observable], Slider.prototype, "valueTextFormatter", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], Slider.prototype, "min", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], Slider.prototype, "max", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], Slider.prototype, "step", void 0);

__decorate([attr], Slider.prototype, "orientation", void 0);

__decorate([attr], Slider.prototype, "mode", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Switch:class)} component.
 * @public
 */

const switchTemplate = (context, definition) => html`<template role="switch" aria-checked="${x => x.checked}" aria-disabled="${x => x.disabled}" aria-readonly="${x => x.readOnly}" tabindex="${x => x.disabled ? null : 0}" @keypress="${(x, c) => x.keypressHandler(c.event)}" @click="${(x, c) => x.clickHandler(c.event)}" class="${x => x.checked ? "checked" : ""}"><label part="label" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label><div part="switch" class="switch"><slot name="switch">${definition.switch || ""}</slot></div><span class="status-message" part="status-message"><span class="checked-message" part="checked-message"><slot name="checked-message"></slot></span><span class="unchecked-message" part="unchecked-message"><slot name="unchecked-message"></slot></span></span></template>`;

class _Switch extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(Switch:class)} component.
 *
 * @internal
 */


class FormAssociatedSwitch extends FormAssociated(_Switch) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("input");
  }

}

/**
 * A Switch Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#switch | ARIA switch }.
 *
 * @public
 */

class Switch extends FormAssociatedSwitch {
  constructor() {
    super();
    /**
     * The element's value to be included in form submission when checked.
     * Default to "on" to reach parity with input[type="checkbox"]
     *
     * @internal
     */

    this.initialValue = "on";
    /**
     * Tracks whether the "checked" property has been changed.
     * This is necessary to provide consistent behavior with
     * normal input checkboxes
     */

    this.dirtyChecked = false;
    /**
     * @internal
     */

    this.formResetCallback = () => {
      this.checked = this.checkedAttribute;
      this.dirtyChecked = false;
    };
    /**
     * @internal
     */


    this.keypressHandler = e => {
      switch (e.keyCode) {
        case keyCodeSpace:
          this.checked = !this.checked;
          break;
      }
    };
    /**
     * @internal
     */


    this.clickHandler = e => {
      if (!this.disabled && !this.readOnly) {
        this.checked = !this.checked;
      }
    };

    this.defaultChecked = !!this.checkedAttribute;
    this.checked = this.defaultChecked;
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.readOnly = this.readOnly;
    }

    this.readOnly ? this.classList.add("readonly") : this.classList.remove("readonly");
  }

  checkedAttributeChanged() {
    this.defaultChecked = this.checkedAttribute;
  }

  defaultCheckedChanged() {
    if (!this.dirtyChecked) {
      // Setting this.checked will cause us to enter a dirty state,
      // but if we are clean when defaultChecked is changed, we want to stay
      // in a clean state, so reset this.dirtyChecked
      this.checked = this.defaultChecked;
      this.dirtyChecked = false;
    }
  }

  checkedChanged() {
    if (!this.dirtyChecked) {
      this.dirtyChecked = true;
    }

    this.updateForm();

    if (this.proxy instanceof HTMLInputElement) {
      this.proxy.checked = this.checked;
    }

    this.$emit("change");
    this.checked ? this.classList.add("checked") : this.classList.remove("checked");
    this.validate();
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.proxy.setAttribute("type", "checkbox");
    this.updateForm();
  }

  updateForm() {
    const value = this.checked ? this.value : null;
    this.setFormValue(value, value);
  }

}

__decorate([attr({
  attribute: "readonly",
  mode: "boolean"
})], Switch.prototype, "readOnly", void 0);

__decorate([attr({
  attribute: "checked",
  mode: "boolean"
})], Switch.prototype, "checkedAttribute", void 0);

__decorate([observable], Switch.prototype, "defaultSlottedNodes", void 0);

__decorate([observable], Switch.prototype, "defaultChecked", void 0);

__decorate([observable], Switch.prototype, "checked", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#TabPanel} component.
 * @public
 */

const tabPanelTemplate = (context, definition) => html`<template slot="tabpanel" role="tabpanel"><slot></slot></template>`;

/**
 * A TabPanel Component to be used with {@link @microsoft/fast-foundation#(Tabs:class)}
 * @public
 */

class TabPanel extends FoundationElement {}

/**
 * The template for the {@link @microsoft/fast-foundation#Tab} component.
 * @public
 */

const tabTemplate = (context, definition) => html`<template slot="tab" role="tab" aria-disabled="${x => x.disabled}"><slot></slot></template>`;

/**
 * A Tab Component to be used with {@link @microsoft/fast-foundation#(Tabs:class)}
 * @public
 */

class Tab extends FoundationElement {}

__decorate([attr({
  mode: "boolean"
})], Tab.prototype, "disabled", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(Tabs:class)} component.
 * @public
 */

const tabsTemplate = (context, definition) => html`<template class="${x => x.orientation}">${startTemplate}<div class="tablist" part="tablist" role="tablist"><slot class="tab" name="tab" part="tab" ${slotted("tabs")}></slot>${when(x => x.showActiveIndicator, html`<div ${ref("activeIndicatorRef")}class="activeIndicator" part="activeIndicator"></div>`)}</div>${endTemplate}<div class="tabpanel"><slot name="tabpanel" part="tabpanel" ${slotted("tabpanels")}></slot></div></template>`;

/**
 * The orientation of the {@link @microsoft/fast-foundation#(Tabs:class)} component
 * @public
 */

var TabsOrientation;

(function (TabsOrientation) {
  TabsOrientation["vertical"] = "vertical";
  TabsOrientation["horizontal"] = "horizontal";
})(TabsOrientation || (TabsOrientation = {}));
/**
 * A Tabs Custom HTML Element.
 * Implements the {@link https://www.w3.org/TR/wai-aria-1.1/#tablist | ARIA tablist }.
 *
 * @public
 */


class Tabs extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The orientation
     * @public
     * @remarks
     * HTML Attribute: orientation
     */

    this.orientation = TabsOrientation.horizontal;
    /**
     * Whether or not to show the active indicator
     * @public
     * @remarks
     * HTML Attribute: activeindicator
     */

    this.activeindicator = true;
    /**
     * @internal
     */

    this.showActiveIndicator = true;
    this.prevActiveTabIndex = 0;
    this.activeTabIndex = 0;
    this.ticking = false;

    this.change = () => {
      this.$emit("change", this.activetab);
    };

    this.isDisabledElement = el => {
      return el.getAttribute("aria-disabled") === "true";
    };

    this.isFocusableElement = el => {
      return !this.isDisabledElement(el);
    };

    this.setTabs = () => {
      const gridProperty = this.isHorizontal() ? "gridColumn" : "gridRow";
      this.tabIds = this.getTabIds();
      this.tabpanelIds = this.getTabPanelIds();
      this.activeTabIndex = this.getActiveIndex();
      this.showActiveIndicator = false;
      this.tabs.forEach((tab, index) => {
        if (tab.slot === "tab" && this.isFocusableElement(tab)) {
          if (this.activeindicator) {
            this.showActiveIndicator = true;
          }

          const tabId = this.tabIds[index];
          const tabpanelId = this.tabpanelIds[index];
          tab.setAttribute("id", typeof tabId !== "string" ? `tab-${index + 1}` : tabId);
          tab.setAttribute("aria-selected", this.activeTabIndex === index ? "true" : "false");
          tab.setAttribute("aria-controls", typeof tabpanelId !== "string" ? `panel-${index + 1}` : tabpanelId);
          tab.addEventListener("click", this.handleTabClick);
          tab.addEventListener("keydown", this.handleTabKeyDown);
          tab.setAttribute("tabindex", this.activeTabIndex === index ? "0" : "-1");

          if (this.activeTabIndex === index) {
            this.activetab = tab;
          }
        }

        tab.style[gridProperty] = `${index + 1}`;
        !this.isHorizontal() ? tab.classList.add("vertical") : tab.classList.remove("vertical");
      });
    };

    this.setTabPanels = () => {
      this.tabIds = this.getTabIds();
      this.tabpanelIds = this.getTabPanelIds();
      this.tabpanels.forEach((tabpanel, index) => {
        const tabId = this.tabIds[index];
        const tabpanelId = this.tabpanelIds[index];
        tabpanel.setAttribute("id", typeof tabpanelId !== "string" ? `panel-${index + 1}` : tabpanelId);
        tabpanel.setAttribute("aria-labelledby", typeof tabId !== "string" ? `tab-${index + 1}` : tabId);
        this.activeTabIndex !== index ? tabpanel.setAttribute("hidden", "") : tabpanel.removeAttribute("hidden");
      });
    };

    this.handleTabClick = event => {
      const selectedTab = event.currentTarget;

      if (selectedTab.nodeType === 1) {
        this.prevActiveTabIndex = this.activeTabIndex;
        this.activeTabIndex = this.tabs.indexOf(selectedTab);
        this.setComponent();
      }
    };

    this.handleTabKeyDown = event => {
      const keyCode = event.keyCode;

      if (this.isHorizontal()) {
        switch (keyCode) {
          case keyCodeArrowLeft:
            event.preventDefault();
            this.adjustBackward(event);
            break;

          case keyCodeArrowRight:
            event.preventDefault();
            this.adjustForward(event);
            break;
        }
      } else {
        switch (keyCode) {
          case keyCodeArrowUp:
            event.preventDefault();
            this.adjustBackward(event);
            break;

          case keyCodeArrowDown:
            event.preventDefault();
            this.adjustForward(event);
            break;
        }
      }

      switch (keyCode) {
        case keyCodeHome:
          event.preventDefault();
          this.adjust(-this.activeTabIndex);
          break;

        case keyCodeEnd:
          event.preventDefault();
          this.adjust(this.tabs.length - this.activeTabIndex - 1);
          break;
      }
    };

    this.adjustForward = e => {
      const group = this.tabs;
      let index = 0;
      index = this.activetab ? group.indexOf(this.activetab) + 1 : 1;

      if (index === group.length) {
        index = 0;
      }

      while (index < group.length && group.length > 1) {
        if (this.isFocusableElement(group[index])) {
          this.moveToTabByIndex(group, index);
          break;
        } else if (this.activetab && index === group.indexOf(this.activetab)) {
          break;
        } else if (index + 1 >= group.length) {
          index = 0;
        } else {
          index += 1;
        }
      }
    };

    this.adjustBackward = e => {
      const group = this.tabs;
      let index = 0;
      index = this.activetab ? group.indexOf(this.activetab) - 1 : 0;
      index = index < 0 ? group.length - 1 : index;

      while (index >= 0 && group.length > 1) {
        if (this.isFocusableElement(group[index])) {
          this.moveToTabByIndex(group, index);
          break;
        } else if (index - 1 < 0) {
          index = group.length - 1;
        } else {
          index -= 1;
        }
      }
    };

    this.moveToTabByIndex = (group, index) => {
      const tab = group[index];
      this.activetab = tab;
      this.prevActiveTabIndex = this.activeTabIndex;
      this.activeTabIndex = index;
      tab.focus();
      this.setComponent();
    };
  }
  /**
   * @internal
   */


  activeidChanged() {
    if (this.$fastController.isConnected && this.tabs.length <= this.tabpanels.length) {
      this.setTabs();
      this.setTabPanels();
      this.handleActiveIndicatorPosition();
    }
  }
  /**
   * @internal
   */


  tabsChanged() {
    if (this.$fastController.isConnected && this.tabs.length <= this.tabpanels.length) {
      this.setTabs();
      this.setTabPanels();
      this.handleActiveIndicatorPosition();
    }
  }
  /**
   * @internal
   */


  tabpanelsChanged() {
    if (this.$fastController.isConnected && this.tabpanels.length <= this.tabs.length) {
      this.setTabs();
      this.setTabPanels();
      this.handleActiveIndicatorPosition();
    }
  }

  getActiveIndex() {
    const id = this.activeid;

    if (id !== undefined) {
      return this.tabIds.indexOf(this.activeid) === -1 ? 0 : this.tabIds.indexOf(this.activeid);
    } else {
      return 0;
    }
  }

  getTabIds() {
    return this.tabs.map(tab => {
      return tab.getAttribute("id");
    });
  }

  getTabPanelIds() {
    return this.tabpanels.map(tabPanel => {
      return tabPanel.getAttribute("id");
    });
  }

  setComponent() {
    if (this.activeTabIndex !== this.prevActiveTabIndex) {
      this.activeid = this.tabIds[this.activeTabIndex];
      this.change();
      this.setTabs();
      this.handleActiveIndicatorPosition();
      this.setTabPanels();
      this.focusTab();
      this.change();
    }
  }

  isHorizontal() {
    return this.orientation === TabsOrientation.horizontal;
  }

  handleActiveIndicatorPosition() {
    // Ignore if we click twice on the same tab
    if (this.showActiveIndicator && this.activeindicator && this.activeTabIndex !== this.prevActiveTabIndex) {
      if (this.ticking) {
        this.ticking = false;
      } else {
        this.ticking = true;
        this.animateActiveIndicator();
      }
    }
  }

  animateActiveIndicator() {
    this.ticking = true;
    const gridProperty = this.isHorizontal() ? "gridColumn" : "gridRow";
    const translateProperty = this.isHorizontal() ? "translateX" : "translateY";
    const offsetProperty = this.isHorizontal() ? "offsetLeft" : "offsetTop";
    const prev = this.activeIndicatorRef[offsetProperty];
    this.activeIndicatorRef.style[gridProperty] = `${this.activeTabIndex + 1}`;
    const next = this.activeIndicatorRef[offsetProperty];
    this.activeIndicatorRef.style[gridProperty] = `${this.prevActiveTabIndex + 1}`;
    const dif = next - prev;
    this.activeIndicatorRef.style.transform = `${translateProperty}(${dif}px)`;
    this.activeIndicatorRef.classList.add("activeIndicatorTransition");
    this.activeIndicatorRef.addEventListener("transitionend", () => {
      this.ticking = false;
      this.activeIndicatorRef.style[gridProperty] = `${this.activeTabIndex + 1}`;
      this.activeIndicatorRef.style.transform = `${translateProperty}(0px)`;
      this.activeIndicatorRef.classList.remove("activeIndicatorTransition");
    });
  }
  /**
   * The adjust method for FASTTabs
   * @public
   * @remarks
   * This method allows the active index to be adjusted by numerical increments
   */


  adjust(adjustment) {
    this.prevActiveTabIndex = this.activeTabIndex;
    this.activeTabIndex = wrapInBounds(0, this.tabs.length - 1, this.activeTabIndex + adjustment);
    this.setComponent();
  }

  focusTab() {
    this.tabs[this.activeTabIndex].focus();
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.tabIds = this.getTabIds();
    this.tabpanelIds = this.getTabPanelIds();
    this.activeTabIndex = this.getActiveIndex();
  }

}

__decorate([attr], Tabs.prototype, "orientation", void 0);

__decorate([attr], Tabs.prototype, "activeid", void 0);

__decorate([observable], Tabs.prototype, "tabs", void 0);

__decorate([observable], Tabs.prototype, "tabpanels", void 0);

__decorate([attr({
  mode: "boolean"
})], Tabs.prototype, "activeindicator", void 0);

__decorate([observable], Tabs.prototype, "activeIndicatorRef", void 0);

__decorate([observable], Tabs.prototype, "showActiveIndicator", void 0);

applyMixins(Tabs, StartEnd);

class _TextArea extends FoundationElement {}
/**
 * A form-associated base class for the {@link @microsoft/fast-foundation#(TextArea:class)} component.
 *
 * @internal
 */


class FormAssociatedTextArea extends FormAssociated(_TextArea) {
  constructor() {
    super(...arguments);
    this.proxy = document.createElement("textarea");
  }

}

/**
 * Resize mode for a TextArea
 * @public
 */
var TextAreaResize;

(function (TextAreaResize) {
  /**
   * No resize.
   */
  TextAreaResize["none"] = "none";
  /**
   * Resize vertically and horizontally.
   */

  TextAreaResize["both"] = "both";
  /**
   * Resize horizontally.
   */

  TextAreaResize["horizontal"] = "horizontal";
  /**
   * Resize vertically.
   */

  TextAreaResize["vertical"] = "vertical";
})(TextAreaResize || (TextAreaResize = {}));

/**
 * A Text Area Custom HTML Element.
 * Based largely on the {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea | <textarea> element }.
 *
 * @public
 */

class TextArea extends FormAssociatedTextArea {
  constructor() {
    super(...arguments);
    /**
     * The resize mode of the element.
     * @public
     * @remarks
     * HTML Attribute: resize
     */

    this.resize = TextAreaResize.none;
    /**
     * Sizes the element horizontally by a number of character columns.
     *
     * @public
     * @remarks
     * HTML Attribute: cols
     */

    this.cols = 20;
    /**
     * @internal
     */

    this.handleTextInput = () => {
      this.value = this.control.value;
    };
  }

  readOnlyChanged() {
    if (this.proxy instanceof HTMLTextAreaElement) {
      this.proxy.readOnly = this.readOnly;
    }
  }

  autofocusChanged() {
    if (this.proxy instanceof HTMLTextAreaElement) {
      this.proxy.autofocus = this.autofocus;
    }
  }

  listChanged() {
    if (this.proxy instanceof HTMLTextAreaElement) {
      this.proxy.setAttribute("list", this.list);
    }
  }

  maxlengthChanged() {
    if (this.proxy instanceof HTMLTextAreaElement) {
      this.proxy.maxLength = this.maxlength;
    }
  }

  minlengthChanged() {
    if (this.proxy instanceof HTMLTextAreaElement) {
      this.proxy.minLength = this.minlength;
    }
  }

  spellcheckChanged() {
    if (this.proxy instanceof HTMLTextAreaElement) {
      this.proxy.spellcheck = this.spellcheck;
    }
  }
  /**
   * Change event handler for inner control.
   * @remarks
   * "Change" events are not `composable` so they will not
   * permeate the shadow DOM boundary. This fn effectively proxies
   * the change event, emitting a `change` event whenever the internal
   * control emits a `change` event
   * @internal
   */


  handleChange() {
    this.$emit("change");
  }

}

__decorate([attr({
  mode: "boolean"
})], TextArea.prototype, "readOnly", void 0);

__decorate([attr], TextArea.prototype, "resize", void 0);

__decorate([attr({
  mode: "boolean"
})], TextArea.prototype, "autofocus", void 0);

__decorate([attr({
  attribute: "form"
})], TextArea.prototype, "formId", void 0);

__decorate([attr], TextArea.prototype, "list", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextArea.prototype, "maxlength", void 0);

__decorate([attr({
  converter: nullableNumberConverter
})], TextArea.prototype, "minlength", void 0);

__decorate([attr], TextArea.prototype, "name", void 0);

__decorate([attr], TextArea.prototype, "placeholder", void 0);

__decorate([attr({
  converter: nullableNumberConverter,
  mode: "fromView"
})], TextArea.prototype, "cols", void 0);

__decorate([attr({
  converter: nullableNumberConverter,
  mode: "fromView"
})], TextArea.prototype, "rows", void 0);

__decorate([attr({
  mode: "boolean"
})], TextArea.prototype, "spellcheck", void 0);

__decorate([observable], TextArea.prototype, "defaultSlottedNodes", void 0);

applyMixins(TextArea, DelegatesARIATextbox);

/**
 * The template for the {@link @microsoft/fast-foundation#(TextArea:class)} component.
 * @public
 */

const textAreaTemplate = (context, definition) => html`<template class=" ${x => x.readOnly ? "readonly" : ""} ${x => x.resize !== TextAreaResize.none ? `resize-${x.resize}` : ""}"><label part="label" for="control" class="${x => x.defaultSlottedNodes && x.defaultSlottedNodes.length ? "label" : "label label__hidden"}"><slot ${slotted("defaultSlottedNodes")}></slot></label><textarea part="control" class="control" id="control" ?autofocus="${x => x.autofocus}" cols="${x => x.cols}" ?disabled="${x => x.disabled}" form="${x => x.form}" list="${x => x.list}" maxlength="${x => x.maxlength}" minlength="${x => x.minlength}" name="${x => x.name}" placeholder="${x => x.placeholder}" ?readonly="${x => x.readOnly}" ?required="${x => x.required}" rows="${x => x.rows}" ?spellcheck="${x => x.spellcheck}" :value="${x => x.value}" aria-atomic="${x => x.ariaAtomic}" aria-busy="${x => x.ariaBusy}" aria-controls="${x => x.ariaControls}" aria-current="${x => x.ariaCurrent}" aria-describedBy="${x => x.ariaDescribedby}" aria-details="${x => x.ariaDetails}" aria-disabled="${x => x.ariaDisabled}" aria-errormessage="${x => x.ariaErrormessage}" aria-flowto="${x => x.ariaFlowto}" aria-haspopup="${x => x.ariaHaspopup}" aria-hidden="${x => x.ariaHidden}" aria-invalid="${x => x.ariaInvalid}" aria-keyshortcuts="${x => x.ariaKeyshortcuts}" aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-live="${x => x.ariaLive}" aria-owns="${x => x.ariaOwns}" aria-relevant="${x => x.ariaRelevant}" aria-roledescription="${x => x.ariaRoledescription}" @input="${(x, c) => x.handleTextInput()}" @change="${x => x.handleChange()}" ${ref("control")}></textarea></template>`;

/**
 * The template for the {@link @microsoft/fast-foundation#(Toolbar:class)} component.
 *
 * @public
 */

const toolbarTemplate = (context, definition) => html`<template aria-label="${x => x.ariaLabel}" aria-labelledby="${x => x.ariaLabelledby}" aria-orientation="${x => x.orientation}" orientation="${x => x.orientation}" role="toolbar" @click="${(x, c) => x.clickHandler(c.event)}" @focusin="${(x, c) => x.focusinHandler(c.event)}" @keydown="${(x, c) => x.keydownHandler(c.event)}"><slot name="label"></slot><div class="positioning-region" part="positioning-region">${startTemplate}<slot ${slotted({
  filter: elements(),
  property: "slottedItems"
})}></slot>${endTemplate}</div></template>`;

/**
 * A map for directionality derived from keyboard input strings,
 * visual orientation, and text direction.
 *
 * @internal
 */

const ToolbarArrowKeyMap = Object.freeze({
  [ArrowKeys.ArrowUp]: {
    [Orientation.vertical]: -1
  },
  [ArrowKeys.ArrowDown]: {
    [Orientation.vertical]: 1
  },
  [ArrowKeys.ArrowLeft]: {
    [Orientation.horizontal]: {
      [Direction.ltr]: -1,
      [Direction.rtl]: 1
    }
  },
  [ArrowKeys.ArrowRight]: {
    [Orientation.horizontal]: {
      [Direction.ltr]: 1,
      [Direction.rtl]: -1
    }
  }
});
/**
 * A Toolbar Custom HTML Element.
 * Implements the {@link https://w3c.github.io/aria-practices/#Toolbar|ARIA Toolbar}.
 *
 * @public
 */

class Toolbar extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The internal index of the currently focused element.
     *
     * @internal
     */

    this._activeIndex = 0;
    /**
     * The text direction of the toolbar.
     *
     * @internal
     */

    this.direction = Direction.ltr;
    /**
     * The orientation of the toolbar.
     *
     * @public
     * @remarks
     * HTML Attribute: `orientation`
     */

    this.orientation = Orientation.horizontal;
  }
  /**
   * The index of the currently focused element, clamped between 0 and the last element.
   *
   * @internal
   */


  get activeIndex() {
    Observable.track(this, "activeIndex");
    return this._activeIndex;
  }

  set activeIndex(value) {
    if (this.$fastController.isConnected) {
      this._activeIndex = limit(0, this.focusableElements.length - 1, value);
      Observable.notify(this, "activeIndex");
    }
  }
  /**
   * Prepare the slotted elements which can be focusable.
   *
   * @param prev - The previous list of slotted elements.
   * @param next - The new list of slotted elements.
   * @internal
   */


  slottedItemsChanged(prev, next) {
    if (this.$fastController.isConnected) {
      this.focusableElements = next.reduce(Toolbar.reduceFocusableItems, []);
      this.setFocusableElements();
    }
  }
  /**
   * Set the activeIndex when a focusable element in the toolbar is clicked.
   *
   * @internal
   */


  clickHandler(e) {
    var _a;

    const activeIndex = (_a = this.focusableElements) === null || _a === void 0 ? void 0 : _a.indexOf(e.target);

    if (activeIndex > -1 && this.activeIndex !== activeIndex) {
      this.setFocusedElement(activeIndex);
    }

    return true;
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    this.direction = getDirection(this);
  }
  /**
   * When the toolbar receives focus, set the currently active element as focused.
   *
   * @internal
   */


  focusinHandler(e) {
    const relatedTarget = e.relatedTarget;

    if (!relatedTarget || this.contains(relatedTarget)) {
      return;
    }

    this.setFocusedElement();
  }
  /**
   * Determines a value that can be used to iterate a list with the arrow keys.
   *
   * @param this - An element with an orientation and direction
   * @param key - The event key value
   * @internal
   */


  getDirectionalIncrementer(key) {
    var _a, _b, _c, _d, _e;

    return (_e = (_c = (_b = (_a = ToolbarArrowKeyMap[key]) === null || _a === void 0 ? void 0 : _a[this.orientation]) === null || _b === void 0 ? void 0 : _b[this.direction]) !== null && _c !== void 0 ? _c : (_d = ToolbarArrowKeyMap[key]) === null || _d === void 0 ? void 0 : _d[this.orientation]) !== null && _e !== void 0 ? _e : 0;
  }
  /**
   * Handle keyboard events for the toolbar.
   *
   * @internal
   */


  keydownHandler(e) {
    const key = e.key;

    if (!(key in ArrowKeys) || e.defaultPrevented || e.shiftKey) {
      return true;
    }

    const incrementer = this.getDirectionalIncrementer(key);

    if (!incrementer) {
      return !e.target.closest("[role=radiogroup]");
    }

    const nextIndex = this.activeIndex + incrementer;

    if (this.focusableElements[nextIndex]) {
      e.preventDefault();
    }

    this.setFocusedElement(nextIndex);
    return true;
  }
  /**
   * Set the activeIndex and focus the corresponding control.
   *
   * @param activeIndex - The new index to set
   * @internal
   */


  setFocusedElement(activeIndex = this.activeIndex) {
    var _a;

    this.activeIndex = activeIndex;
    this.setFocusableElements();
    (_a = this.focusableElements[this.activeIndex]) === null || _a === void 0 ? void 0 : _a.focus();
  }
  /**
   * Reduce a collection to only its focusable elements.
   *
   * @param elements - Collection of elements to reduce
   * @param element - The current element
   *
   * @internal
   */


  static reduceFocusableItems(elements, element) {
    var _a, _b, _c, _d;

    const isRoleRadio = element.getAttribute("role") === "radio";
    const isFocusableFastElement = (_b = (_a = element.$fastController) === null || _a === void 0 ? void 0 : _a.definition.shadowOptions) === null || _b === void 0 ? void 0 : _b.delegatesFocus;
    const hasFocusableShadow = Array.from((_d = (_c = element.shadowRoot) === null || _c === void 0 ? void 0 : _c.querySelectorAll("*")) !== null && _d !== void 0 ? _d : []).some(x => isFocusable(x));

    if (isFocusable(element) || isRoleRadio || isFocusableFastElement || hasFocusableShadow) {
      elements.push(element);
      return elements;
    }

    if (element.childElementCount) {
      return elements.concat(Array.from(element.children).reduce(Toolbar.reduceFocusableItems, []));
    }

    return elements;
  }
  /**
   * @internal
   */


  setFocusableElements() {
    if (this.$fastController.isConnected && this.focusableElements.length > 0) {
      this.focusableElements.forEach((element, index) => {
        element.tabIndex = this.activeIndex === index ? 0 : -1;
      });
    }
  }

}

__decorate([observable], Toolbar.prototype, "direction", void 0);

__decorate([attr], Toolbar.prototype, "orientation", void 0);

__decorate([observable], Toolbar.prototype, "slottedItems", void 0);

__decorate([observable], Toolbar.prototype, "slottedLabel", void 0);
/**
 * Includes ARIA states and properties relating to the ARIA toolbar role
 *
 * @public
 */


class DelegatesARIAToolbar {}

__decorate([attr({
  attribute: "aria-labelledby"
})], DelegatesARIAToolbar.prototype, "ariaLabelledby", void 0);

__decorate([attr({
  attribute: "aria-label"
})], DelegatesARIAToolbar.prototype, "ariaLabel", void 0);

applyMixins(DelegatesARIAToolbar, ARIAGlobalStatesAndProperties);
applyMixins(Toolbar, StartEnd, DelegatesARIAToolbar);

/**
 * Creates a template for the {@link @microsoft/fast-foundation#(Tooltip:class)} component using the provided prefix.
 * @public
 */

const tooltipTemplate = (context, definition) => {
  return html` ${when(x => x.tooltipVisible, html`<${context.tagFor(AnchoredRegion)}fixed-placement="true" vertical-positioning-mode="${x => x.verticalPositioningMode}" vertical-default-position="${x => x.verticalDefaultPosition}" vertical-inset="${x => x.verticalInset}" vertical-scaling="${x => x.verticalScaling}" horizontal-positioning-mode="${x => x.horizontalPositioningMode}" horizontal-default-position="${x => x.horizontalDefaultPosition}" horizontal-scaling="${x => x.horizontalScaling}" horizontal-inset="${x => x.horizontalInset}" dir="${x => x.currentDirection}" ${ref("region")}><div class="tooltip" part="tooltip" role="tooltip"><slot></slot></div></${context.tagFor(AnchoredRegion)}>`)} `;
};

/**
 * Enumerates possible tooltip positions
 *
 * @public
 */
var TooltipPosition;

(function (TooltipPosition) {
  /**
   * The tooltip is positioned above the element
   */
  TooltipPosition["top"] = "top";
  /**
   * The tooltip is positioned to the right of the element
   */

  TooltipPosition["right"] = "right";
  /**
   * The tooltip is positioned below the element
   */

  TooltipPosition["bottom"] = "bottom";
  /**
   * The tooltip is positioned to the left of the element
   */

  TooltipPosition["left"] = "left";
  /**
   * The tooltip is positioned before the element
   */

  TooltipPosition["start"] = "start";
  /**
   * The tooltip is positioned after the element
   */

  TooltipPosition["end"] = "end";
})(TooltipPosition || (TooltipPosition = {}));

/**
 * An Tooltip Custom HTML Element.
 *
 * @public
 */

class Tooltip extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * The id of the element the tooltip is anchored to
     *
     * @defaultValue - undefined
     * @public
     * HTML Attribute: anchor
     */

    this.anchor = "";
    /**
     * The delay in milliseconds before a tooltip is shown after a hover event
     *
     * @defaultValue - 300
     * @public
     * HTML Attribute: delay
     */

    this.delay = 300;
    /**
     * the html element currently being used as anchor.
     * Setting this directly overrides the anchor attribute.
     *
     * @public
     */

    this.anchorElement = null;
    /**
     * The current viewport element instance
     *
     * @internal
     */

    this.viewportElement = null;
    /**
     * @internal
     */

    this.verticalPositioningMode = "dynamic";
    /**
     * @internal
     */

    this.horizontalPositioningMode = "dynamic";
    /**
     * @internal
     */

    this.horizontalInset = "true";
    /**
     * @internal
     */

    this.verticalInset = "false";
    /**
     * @internal
     */

    this.horizontalScaling = "anchor";
    /**
     * @internal
     */

    this.verticalScaling = "content";
    /**
     * @internal
     */

    this.verticalDefaultPosition = undefined;
    /**
     * @internal
     */

    this.horizontalDefaultPosition = undefined;
    /**
     * @internal
     */

    this.tooltipVisible = false;
    /**
     * Track current direction to pass to the anchored region
     * updated when tooltip is shown
     *
     * @internal
     */

    this.currentDirection = Direction.ltr;
    /**
     * The timer that tracks delay time before the tooltip is shown on hover
     */

    this.delayTimer = null;
    /**
     * Indicates whether the anchor is currently being hovered
     */

    this.isAnchorHovered = false;
    /**
     * invoked when the anchored region's position relative to the anchor changes
     *
     * @internal
     */

    this.handlePositionChange = ev => {
      this.classList.toggle("top", this.region.verticalPosition === "top");
      this.classList.toggle("bottom", this.region.verticalPosition === "bottom");
      this.classList.toggle("inset-top", this.region.verticalPosition === "insetTop");
      this.classList.toggle("inset-bottom", this.region.verticalPosition === "insetBottom");
      this.classList.toggle("left", this.region.horizontalPosition === "left");
      this.classList.toggle("right", this.region.horizontalPosition === "right");
      this.classList.toggle("inset-left", this.region.horizontalPosition === "insetLeft");
      this.classList.toggle("inset-right", this.region.horizontalPosition === "insetRight");
    };
    /**
     * mouse enters anchor
     */


    this.handleAnchorMouseOver = ev => {
      this.startHoverTimer();
    };
    /**
     * mouse leaves anchor
     */


    this.handleAnchorMouseOut = ev => {
      if (this.isAnchorHovered) {
        this.isAnchorHovered = false;
        this.updateTooltipVisibility();
      }

      this.clearDelayTimer();
    };
    /**
     * starts the hover timer if not currently running
     */


    this.startHoverTimer = () => {
      if (this.isAnchorHovered) {
        return;
      }

      if (this.delay > 1) {
        if (this.delayTimer === null) this.delayTimer = window.setTimeout(() => {
          this.startHover();
        }, this.delay);
        return;
      }

      this.startHover();
    };
    /**
     * starts the hover delay timer
     */


    this.startHover = () => {
      this.isAnchorHovered = true;
      this.updateTooltipVisibility();
    };
    /**
     * clears the hover delay
     */


    this.clearDelayTimer = () => {
      if (this.delayTimer !== null) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
    };
    /**
     *  Gets the anchor element by id
     */


    this.getAnchor = () => {
      const rootNode = this.getRootNode();

      if (rootNode instanceof ShadowRoot) {
        return rootNode.getElementById(this.anchor);
      }

      return document.getElementById(this.anchor);
    };
    /**
     * handles key down events to check for dismiss
     */


    this.handleDocumentKeydown = e => {
      if (!e.defaultPrevented && this.tooltipVisible) {
        switch (e.keyCode) {
          case keyCodeEscape:
            this.isAnchorHovered = false;
            this.updateTooltipVisibility();
            this.$emit("dismiss");
            break;
        }
      }
    };
    /**
     * determines whether to show or hide the tooltip based on current state
     */


    this.updateTooltipVisibility = () => {
      if (this.visible === false) {
        this.hideTooltip();
      } else if (this.visible === true) {
        this.showTooltip();
      } else {
        if (this.isAnchorHovered) {
          this.showTooltip();
          return;
        }

        this.hideTooltip();
      }
    };
    /**
     * shows the tooltip
     */


    this.showTooltip = () => {
      if (this.tooltipVisible) {
        return;
      }

      this.currentDirection = getDirection(this);
      this.tooltipVisible = true;
      document.addEventListener("keydown", this.handleDocumentKeydown);
      DOM.queueUpdate(this.setRegionProps);
    };
    /**
     * hides the tooltip
     */


    this.hideTooltip = () => {
      if (!this.tooltipVisible) {
        return;
      }

      if (this.region !== null && this.region !== undefined) {
        this.region.removeEventListener("positionchange", this.handlePositionChange);
        this.region.viewportElement = null;
        this.region.anchorElement = null;
      }

      document.removeEventListener("keydown", this.handleDocumentKeydown);
      this.tooltipVisible = false;
    };
    /**
     * updates the tooltip anchored region props after it has been
     * added to the DOM
     */


    this.setRegionProps = () => {
      if (!this.tooltipVisible) {
        return;
      }

      this.viewportElement = document.body;
      this.region.viewportElement = this.viewportElement;
      this.region.anchorElement = this.anchorElement;
      this.region.addEventListener("positionchange", this.handlePositionChange);
    };
  }

  visibleChanged() {
    if (this.$fastController.isConnected) {
      this.updateTooltipVisibility();
      this.updateLayout();
    }
  }

  anchorChanged() {
    if (this.$fastController.isConnected) {
      this.updateLayout();
    }
  }

  positionChanged() {
    if (this.$fastController.isConnected) {
      this.updateLayout();
    }
  }

  anchorElementChanged(oldValue) {
    if (this.$fastController.isConnected) {
      if (oldValue !== null && oldValue !== undefined) {
        oldValue.removeEventListener("mouseover", this.handleAnchorMouseOver);
        oldValue.removeEventListener("mouseout", this.handleAnchorMouseOut);
      }

      if (this.anchorElement !== null && this.anchorElement !== undefined) {
        this.anchorElement.addEventListener("mouseover", this.handleAnchorMouseOver, {
          passive: true
        });
        this.anchorElement.addEventListener("mouseout", this.handleAnchorMouseOut, {
          passive: true
        });
        const anchorId = this.anchorElement.id;

        if (this.anchorElement.parentElement !== null) {
          this.anchorElement.parentElement.querySelectorAll(":hover").forEach(element => {
            if (element.id === anchorId) {
              this.startHoverTimer();
            }
          });
        }
      }

      if (this.region !== null && this.region !== undefined && this.tooltipVisible) {
        this.region.anchorElement = this.anchorElement;
      }

      this.updateLayout();
    }
  }

  viewportElementChanged() {
    if (this.region !== null && this.region !== undefined) {
      this.region.viewportElement = this.viewportElement;
    }

    this.updateLayout();
  }

  connectedCallback() {
    super.connectedCallback();
    this.anchorElement = this.getAnchor();
    this.updateLayout();
    this.updateTooltipVisibility();
  }

  disconnectedCallback() {
    this.hideTooltip();
    this.clearDelayTimer();
    super.disconnectedCallback();
  }
  /**
   * updated the properties being passed to the anchored region
   */


  updateLayout() {
    switch (this.position) {
      case TooltipPosition.top:
      case TooltipPosition.bottom:
        this.verticalPositioningMode = "locktodefault";
        this.horizontalPositioningMode = "dynamic";
        this.verticalDefaultPosition = this.position;
        this.horizontalDefaultPosition = undefined;
        this.horizontalInset = "true";
        this.verticalInset = "false";
        this.horizontalScaling = "anchor";
        this.verticalScaling = "content";
        break;

      case TooltipPosition.right:
      case TooltipPosition.left:
      case TooltipPosition.start:
      case TooltipPosition.end:
        this.verticalPositioningMode = "dynamic";
        this.horizontalPositioningMode = "locktodefault";
        this.verticalDefaultPosition = undefined;
        this.horizontalDefaultPosition = this.position;
        this.horizontalInset = "false";
        this.verticalInset = "true";
        this.horizontalScaling = "content";
        this.verticalScaling = "anchor";
        break;

      default:
        this.verticalPositioningMode = "dynamic";
        this.horizontalPositioningMode = "dynamic";
        this.verticalDefaultPosition = undefined;
        this.horizontalDefaultPosition = undefined;
        this.horizontalInset = "true";
        this.verticalInset = "false";
        this.horizontalScaling = "anchor";
        this.verticalScaling = "content";
        break;
    }
  }

}
Tooltip.DirectionAttributeName = "dir";

__decorate([attr({
  mode: "boolean"
})], Tooltip.prototype, "visible", void 0);

__decorate([attr], Tooltip.prototype, "anchor", void 0);

__decorate([attr], Tooltip.prototype, "delay", void 0);

__decorate([attr], Tooltip.prototype, "position", void 0);

__decorate([observable], Tooltip.prototype, "anchorElement", void 0);

__decorate([observable], Tooltip.prototype, "viewportElement", void 0);

__decorate([observable], Tooltip.prototype, "verticalPositioningMode", void 0);

__decorate([observable], Tooltip.prototype, "horizontalPositioningMode", void 0);

__decorate([observable], Tooltip.prototype, "horizontalInset", void 0);

__decorate([observable], Tooltip.prototype, "verticalInset", void 0);

__decorate([observable], Tooltip.prototype, "horizontalScaling", void 0);

__decorate([observable], Tooltip.prototype, "verticalScaling", void 0);

__decorate([observable], Tooltip.prototype, "verticalDefaultPosition", void 0);

__decorate([observable], Tooltip.prototype, "horizontalDefaultPosition", void 0);

__decorate([observable], Tooltip.prototype, "tooltipVisible", void 0);

__decorate([observable], Tooltip.prototype, "currentDirection", void 0);

/**
 * The template for the {@link @microsoft/fast-foundation#(TreeItem:class)} component.
 * @public
 */

const treeItemTemplate = (context, definition) => html`<template role="treeitem" slot="${x => x.isNestedItem() ? "item" : void 0}" tabindex="${x => x.disabled || !x.focusable ? void 0 : 0}" class="${x => x.expanded ? "expanded" : ""} ${x => x.selected ? "selected" : ""} ${x => x.nested ? "nested" : ""} ${x => x.disabled ? "disabled" : ""}" aria-expanded="${x => x.childItems && x.childItemLength() > 0 ? x.expanded : void 0}" aria-selected="${x => x.selected}" aria-disabled="${x => x.disabled}" @keydown="${(x, c) => x.handleKeyDown(c.event)}" @click="${(x, c) => x.handleClick(c.event)}" ${children({
  property: "childItems",
  filter: elements()
})}><div class="positioning-region" part="positioning-region"><div class="content-region" part="content-region">${when(x => x.childItems && x.childItemLength() > 0, html`<div aria-hidden="true" class="expand-collapse-button" part="expand-collapse-button" @click="${(x, c) => x.handleExpandCollapseButtonClick(c.event)}" ${ref("expandCollapseButton")}><slot name="expand-collapse-glyph">${definition.expandCollapseGlyph || ""}</slot></div>`)} ${startTemplate}<slot></slot>${endTemplate}</div></div>${when(x => x.childItems && x.childItemLength() > 0 && (x.expanded || x.renderCollapsedChildren), html`<div role="group" class="items" part="items"><slot name="item" ${slotted("items")}></slot></div>`)}</template>`;

/**
 * check if the item is a tree item
 * @public
 * @remarks
 * determines if element is an HTMLElement and if it has the role treeitem
 */

function isTreeItemElement(el) {
  return isHTMLElement(el) && el.getAttribute("role") === "treeitem";
}
/**
 * A Tree item Custom HTML Element.
 *
 * @public
 */

class TreeItem extends FoundationElement {
  constructor() {
    super(...arguments);
    /**
     * When true, the control will be appear expanded by user interaction.
     * @public
     * @remarks
     * HTML Attribute: expanded
     */

    this.expanded = false;
    this.focusable = false;
    this.enabledChildTreeItems = [];
    /**
     * The keyboarding on treeview should conform to the following spec
     * https://w3c.github.io/aria-practices/#keyboard-interaction-23
     * @param e - Event object for keyDown event
     */

    this.handleKeyDown = e => {
      if (e.target !== e.currentTarget) {
        return true;
      }

      switch (e.keyCode) {
        case keyCodeArrowLeft:
          // preventDefault to ensure we don't scroll the page
          e.preventDefault();
          this.collapseOrFocusParent();
          break;

        case keyCodeArrowRight:
          // preventDefault to ensure we don't scroll the page
          e.preventDefault();
          this.expandOrFocusFirstChild();
          break;

        case keyCodeArrowDown:
          // preventDefault to ensure we don't scroll the page
          e.preventDefault();
          this.focusNextNode(1);
          break;

        case keyCodeArrowUp:
          // preventDefault to ensure we don't scroll the page
          e.preventDefault();
          this.focusNextNode(-1);
          break;

        case keyCodeEnter:
          // In single-select trees where selection does not follow focus (see note below),
          // the default action is typically to select the focused node.
          this.handleSelected(e);
          break;
      }

      return true;
    };

    this.handleExpandCollapseButtonClick = e => {
      if (!this.disabled) {
        e.preventDefault();
        this.setExpanded(!this.expanded);
      }
    };

    this.handleClick = e => {
      if (!e.defaultPrevented && !this.disabled) {
        this.handleSelected(e);
      }
    };

    this.isNestedItem = () => {
      return isTreeItemElement(this.parentElement);
    };
  }

  itemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      this.items.forEach(node => {
        if (isTreeItemElement(node)) {
          // TODO: maybe not require it to be a TreeItem?
          node.nested = true;
        }
      });
      this.enabledChildTreeItems = this.items.filter(item => {
        return isTreeItemElement(item) && !item.hasAttribute("disabled");
      });
    }
  }

  getParentTreeNode() {
    const parentNode = this.parentElement.closest("[role='tree']");
    return parentNode;
  }
  /**
   * @internal
   */


  connectedCallback() {
    super.connectedCallback();
    const parentTreeNode = this.getParentTreeNode();

    if (parentTreeNode) {
      if (parentTreeNode.hasAttribute("render-collapsed-nodes")) {
        this.renderCollapsedChildren = parentTreeNode.getAttribute("render-collapsed-nodes") === "true";
      }

      this.notifier = Observable.getNotifier(parentTreeNode);
      this.notifier.subscribe(this, "renderCollapsedNodes");
    }
  }
  /**
   * @internal
   */


  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.notifier) {
      this.notifier.unsubscribe(this, "renderCollapsedNodes");
    }
  }
  /**
   * Places document focus on a tree item and adds the item to the sequential tab order.
   * @param el - the element to focus
   */


  static focusItem(el) {
    el.setAttribute("tabindex", "0");
    el.focusable = true;
    el.focus();
  }

  handleChange(source, propertyName) {
    switch (propertyName) {
      case "renderCollapsedNodes":
        this.renderCollapsedChildren = source.renderCollapsedNodes;
        break;
    }
  }

  childItemLength() {
    const treeChildren = this.childItems.filter(item => {
      return isTreeItemElement(item);
    });
    return treeChildren ? treeChildren.length : 0;
  }

  collapseOrFocusParent() {
    if (this.expanded) {
      this.setExpanded(false);
    } else if (isHTMLElement(this.parentElement)) {
      const parentTreeItemNode = this.parentElement.closest("[role='treeitem']");

      if (isHTMLElement(parentTreeItemNode)) {
        TreeItem.focusItem(parentTreeItemNode);
      }
    }
  }

  expandOrFocusFirstChild() {
    if (typeof this.expanded !== "boolean") {
      return;
    }

    if (!this.expanded && this.childItemLength() > 0) {
      this.setExpanded(true);
    } else {
      if (this.enabledChildTreeItems.length > 0) {
        TreeItem.focusItem(this.enabledChildTreeItems[0]);
      }
    }
  }

  focusNextNode(delta) {
    const visibleNodes = this.getVisibleNodes();

    if (!visibleNodes) {
      return;
    }

    const currentIndex = visibleNodes.indexOf(this);

    if (currentIndex !== -1) {
      let nextElement = visibleNodes[currentIndex + delta];

      if (nextElement !== undefined) {
        while (nextElement.hasAttribute("disabled")) {
          const offset = delta >= 0 ? 1 : -1;
          nextElement = visibleNodes[currentIndex + delta + offset];

          if (!nextElement) {
            break;
          }
        }
      }

      if (isHTMLElement(nextElement)) {
        TreeItem.focusItem(nextElement);
      }
    }
  }

  getVisibleNodes() {
    return getDisplayedNodes(this.getTreeRoot(), "[role='treeitem']");
  }

  getTreeRoot() {
    /* eslint-disable-next-line  @typescript-eslint/no-this-alias */
    const currentNode = this;

    if (!isHTMLElement(currentNode)) {
      return null;
    }

    return currentNode.closest("[role='tree']");
  }

  handleSelected(e) {
    this.selected = !this.selected;
    this.$emit("selected-change", e);
  }

  setExpanded(expanded) {
    this.expanded = expanded;
    this.$emit("expanded-change", this);
  }

}

__decorate([attr({
  mode: "boolean"
})], TreeItem.prototype, "expanded", void 0);

__decorate([attr({
  mode: "boolean"
})], TreeItem.prototype, "selected", void 0);

__decorate([attr({
  mode: "boolean"
})], TreeItem.prototype, "disabled", void 0);

__decorate([observable], TreeItem.prototype, "focusable", void 0);

__decorate([observable], TreeItem.prototype, "childItems", void 0);

__decorate([observable], TreeItem.prototype, "items", void 0);

__decorate([observable], TreeItem.prototype, "nested", void 0);

__decorate([observable], TreeItem.prototype, "renderCollapsedChildren", void 0);

applyMixins(TreeItem, StartEnd);

/**
 * The template for the {@link @microsoft/fast-foundation#TreeView} component.
 * @public
 */

const treeViewTemplate = (context, definition) => html`<template role="tree" ${ref("treeView")}@keydown="${(x, c) => x.handleKeyDown(c.event)}" @focusout="${(x, c) => x.handleBlur(c.event)}"><slot ${slotted("slottedTreeItems")}></slot></template>`;

/**
 * A Tree view Custom HTML Element.
 * Implements the {@link https://w3c.github.io/aria-practices/#TreeView | ARIA TreeView }.
 *
 * @public
 */

class TreeView extends FoundationElement {
  constructor() {
    super(...arguments);

    this.handleBlur = e => {
      const {
        relatedTarget,
        target
      } = e;
      /**
       * Clean up previously focused item's tabindex if we've moved to another item in the tree
       */

      if (relatedTarget instanceof HTMLElement && target instanceof HTMLElement && this.contains(relatedTarget)) {
        target.removeAttribute("tabindex");
      }
    };

    this.handleKeyDown = e => {
      if (!this.treeItems) {
        return true;
      }

      switch (e.keyCode) {
        case keyCodeHome:
          if (this.treeItems && this.treeItems.length) {
            TreeItem.focusItem(this.treeItems[0]);
          }

          break;

        case keyCodeEnd:
          if (this.treeItems && this.treeItems.length) {
            TreeItem.focusItem(this.treeItems[this.treeItems.length - 1]);
          }

          break;

        default:
          return true;
      }
    };

    this.setItems = () => {
      const focusIndex = this.treeItems.findIndex(this.isFocusableElement);

      for (let item = 0; item < this.treeItems.length; item++) {
        if (item === focusIndex && !this.treeItems[item].hasAttribute("disabled")) {
          this.treeItems[item].setAttribute("tabindex", "0");
        }

        this.treeItems[item].addEventListener("selected-change", this.handleItemSelected);
      }
    };

    this.resetItems = () => {
      for (let item = 0; item < this.treeItems.length; item++) {
        this.treeItems[item].removeEventListener("selected-change", this.handleItemSelected);
      }
    };

    this.handleItemSelected = e => {
      const newSelection = e.target;

      if (newSelection !== this.currentSelected) {
        if (this.currentSelected) {
          // TODO: fix this below, shouldn't need both
          this.currentSelected.removeAttribute("selected");
          this.currentSelected.selected = false;
        }

        this.currentSelected = newSelection;
      }
    };
    /**
     * check if the item is focusable
     */


    this.isFocusableElement = el => {
      return isTreeItemElement(el) && !this.isDisabledElement(el);
    };
    /**
     * check if the item is disabled
     */


    this.isDisabledElement = el => {
      return isTreeItemElement(el) && el.getAttribute("aria-disabled") === "true";
    };
  }

  slottedTreeItemsChanged(oldValue, newValue) {
    if (this.$fastController.isConnected) {
      // filter the tree items until that's done for us in the framework
      this.resetItems();
      this.treeItems = this.getVisibleNodes();
      this.setItems(); // check if any tree items have nested items
      // if they do, apply the nested attribute

      if (this.checkForNestedItems()) {
        this.slottedTreeItems.forEach(node => {
          if (isTreeItemElement(node)) {
            node.nested = true;
          }
        });
      }
    }
  }

  checkForNestedItems() {
    return this.slottedTreeItems.some(node => {
      return isTreeItemElement(node) && node.querySelector("[role='treeitem']");
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.treeItems = this.getVisibleNodes();
    DOM.queueUpdate(() => {
      //only supporting single select
      const node = this.treeView.querySelector("[aria-selected='true']");

      if (node) {
        this.currentSelected = node;
      }
    });
  }

  getVisibleNodes() {
    const treeItems = [];

    if (this.slottedTreeItems !== undefined) {
      this.slottedTreeItems.forEach(item => {
        if (isTreeItemElement(item)) {
          treeItems.push(item);
        }
      });
    }

    return treeItems;
  }

}

__decorate([attr({
  attribute: "render-collapsed-nodes"
})], TreeView.prototype, "renderCollapsedNodes", void 0);

__decorate([observable], TreeView.prototype, "currentSelected", void 0);

__decorate([observable], TreeView.prototype, "nested", void 0);

__decorate([observable], TreeView.prototype, "slottedTreeItems", void 0);

/**
 * Ensures that an input number does not exceed a max value and is not less than a min value.
 * @param i - the number to clamp
 * @param min - the maximum (inclusive) value
 * @param max - the minimum (inclusive) value
 * @public
 */
function clamp(i, min, max) {
  if (isNaN(i) || i <= min) {
    return min;
  } else if (i >= max) {
    return max;
  }

  return i;
}
/**
 * Scales an input to a number between 0 and 1
 * @param i - a number between min and max
 * @param min - the max value
 * @param max - the min value
 * @public
 */

function normalize(i, min, max) {
  if (isNaN(i) || i <= min) {
    return 0.0;
  } else if (i >= max) {
    return 1.0;
  }

  return i / (max - min);
}
/**
 * Scales a number between 0 and 1
 * @param i - the number to denormalize
 * @param min - the min value
 * @param max - the max value
 * @public
 */

function denormalize(i, min, max) {
  if (isNaN(i)) {
    return min;
  }

  return min + i * (max - min);
}
/**
 * Converts degrees to radians.
 * @param i - degrees
 * @public
 */

function degreesToRadians(i) {
  return i * (Math.PI / 180.0);
}
/**
 * Converts radians to degrees.
 * @param i - radians
 * @public
 */

function radiansToDegrees(i) {
  return i * (180.0 / Math.PI);
}
/**
 * Converts a number between 0 and 255 to a hex string.
 * @param i - the number to convert to a hex string
 * @public
 */

function getHexStringForByte(i) {
  const s = Math.round(clamp(i, 0.0, 255.0)).toString(16);

  if (s.length === 1) {
    return "0" + s;
  }

  return s;
}
/**
 * Linearly interpolate
 * @public
 */

function lerp(i, min, max) {
  if (isNaN(i) || i <= 0.0) {
    return min;
  } else if (i >= 1.0) {
    return max;
  }

  return min + i * (max - min);
}
/**
 * Linearly interpolate angles in degrees
 * @public
 */

function lerpAnglesInDegrees(i, min, max) {
  if (i <= 0.0) {
    return min % 360.0;
  } else if (i >= 1.0) {
    return max % 360.0;
  }

  const a = (min - max + 360.0) % 360.0;
  const b = (max - min + 360.0) % 360.0;

  if (a <= b) {
    return (min - a * i + 360.0) % 360.0;
  }

  return (min + a * i + 360.0) % 360.0;
}
/**
 *
 * Will return infinity if i*10^(precision) overflows number
 * note that floating point rounding rules come into play here
 * so values that end up rounding on a .5 round to the nearest
 * even not always up so 2.5 rounds to 2
 * @param i - the number to round
 * @param precision - the precision to round to
 *
 * @public
 */

function roundToPrecisionSmall(i, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(i * factor) / factor;
}

/**
 * This uses Hue values in "degree" format. So expect a range of [0,360]. Some other implementations instead uses radians or a normalized Hue with range [0,1]. Be aware of this when checking values or using other libraries.
 *
 * @public
 */

class ColorHSL {
  constructor(hue, sat, lum) {
    this.h = hue;
    this.s = sat;
    this.l = lum;
  }
  /**
   * Construct a {@link ColorHSL} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.h) && !isNaN(data.s) && !isNaN(data.l)) {
      return new ColorHSL(data.h, data.s, data.l);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.h === rhs.h && this.s === rhs.s && this.l === rhs.l;
  }
  /**
   * Returns a new {@link ColorHSL} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorHSL(roundToPrecisionSmall(this.h, precision), roundToPrecisionSmall(this.s, precision), roundToPrecisionSmall(this.l, precision));
  }
  /**
   * Returns the {@link ColorHSL} formatted as an object.
   */


  toObject() {
    return {
      h: this.h,
      s: this.s,
      l: this.l
    };
  }

}

/**
 * This uses Hue values in "degree" format. So expect a range of [0,360]. Some other implementations instead uses radians or a normalized Hue with range [0,1]. Be aware of this when checking values or using other libraries.
 *
 * @public
 */

class ColorHSV {
  constructor(hue, sat, val) {
    this.h = hue;
    this.s = sat;
    this.v = val;
  }
  /**
   * Construct a {@link ColorHSV} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.h) && !isNaN(data.s) && !isNaN(data.v)) {
      return new ColorHSV(data.h, data.s, data.v);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.h === rhs.h && this.s === rhs.s && this.v === rhs.v;
  }
  /**
   * Returns a new {@link ColorHSV} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorHSV(roundToPrecisionSmall(this.h, precision), roundToPrecisionSmall(this.s, precision), roundToPrecisionSmall(this.v, precision));
  }
  /**
   * Returns the {@link ColorHSV} formatted as an object.
   */


  toObject() {
    return {
      h: this.h,
      s: this.s,
      v: this.v
    };
  }

}

/**
 * {@link https://en.wikipedia.org/wiki/CIELAB_color_space | CIELAB color space}
 * This implementation uses the D65 constants for 2 degrees. That determines the constants used for the pure white point of the XYZ space of 0.95047, 1.0, 1.08883.
 * {@link https://en.wikipedia.org/wiki/Illuminant_D65}
 * These constants determine how the XYZ, LCH and LAB colors convert to/from RGB.
 *
 * @public
 */

class ColorLAB {
  constructor(l, a, b) {
    this.l = l;
    this.a = a;
    this.b = b;
  }
  /**
   * Construct a {@link ColorLAB} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.l) && !isNaN(data.a) && !isNaN(data.b)) {
      return new ColorLAB(data.l, data.a, data.b);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.l === rhs.l && this.a === rhs.a && this.b === rhs.b;
  }
  /**
   * Returns a new {@link ColorLAB} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorLAB(roundToPrecisionSmall(this.l, precision), roundToPrecisionSmall(this.a, precision), roundToPrecisionSmall(this.b, precision));
  }
  /**
   * Returns the {@link ColorLAB} formatted as an object.
   */


  toObject() {
    return {
      l: this.l,
      a: this.a,
      b: this.b
    };
  }

}
ColorLAB.epsilon = 216 / 24389;
ColorLAB.kappa = 24389 / 27;

/**
 *
 * {@link https://en.wikipedia.org/wiki/CIELAB_color_space | CIELCH color space}
 *
 * This is a cylindrical representation of the CIELAB space useful for saturation operations
 * This uses Hue values in "degree" format. So expect a range of [0,360]. Some other implementations instead uses radians or a normalized Hue with range [0,1]. Be aware of this when checking values or using other libraries.
 * This implementation uses the D65 constants for 2 degrees. That determines the constants used for the pure white point of the XYZ space of 0.95047, 1.0, 1.08883.
 * {@link https://en.wikipedia.org/wiki/Illuminant_D65}
 * These constants determine how the XYZ, LCH and LAB colors convert to/from RGB.
 *
 * @public
 */

class ColorLCH {
  constructor(l, c, h) {
    this.l = l;
    this.c = c;
    this.h = h;
  }
  /**
   * Construct a {@link ColorLCH} from a config object.
   * @param data - the config object
   */


  static fromObject(data) {
    if (data && !isNaN(data.l) && !isNaN(data.c) && !isNaN(data.h)) {
      return new ColorLCH(data.l, data.c, data.h);
    }

    return null;
  }
  /**
   * Determines if one color is equal to another.
   * @param rhs - the color to compare
   */


  equalValue(rhs) {
    return this.l === rhs.l && this.c === rhs.c && this.h === rhs.h;
  }
  /**
   * Returns a new {@link ColorLCH} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorLCH(roundToPrecisionSmall(this.l, precision), roundToPrecisionSmall(this.c, precision), roundToPrecisionSmall(this.h, precision));
  }
  /**
   * Converts the {@link ColorLCH} to a config object.
   */


  toObject() {
    return {
      l: this.l,
      c: this.c,
      h: this.h
    };
  }

}

/**
 * A RGBA color with 64 bit channels.
 *
 * @example
 * ```ts
 * new ColorRGBA64(1, 0, 0, 1) // red
 * ```
 * @public
 */

class ColorRGBA64 {
  /**
   *
   * @param red - the red value
   * @param green - the green value
   * @param blue - the blue value
   * @param alpha - the alpha value
   */
  constructor(red, green, blue, alpha) {
    this.r = red;
    this.g = green;
    this.b = blue;
    this.a = typeof alpha === "number" && !isNaN(alpha) ? alpha : 1;
  }
  /**
   * Construct a {@link ColorRGBA64} from a {@link ColorRGBA64Config}
   * @param data - the config object
   */


  static fromObject(data) {
    return data && !isNaN(data.r) && !isNaN(data.g) && !isNaN(data.b) ? new ColorRGBA64(data.r, data.g, data.b, data.a) : null;
  }
  /**
   * Determines if one color is equal to another.
   * @param rhs - the color to compare
   */


  equalValue(rhs) {
    return this.r === rhs.r && this.g === rhs.g && this.b === rhs.b && this.a === rhs.a;
  }
  /**
   * Returns the color formatted as a string; #RRGGBB
   */


  toStringHexRGB() {
    return "#" + [this.r, this.g, this.b].map(this.formatHexValue).join("");
  }
  /**
   * Returns the color formatted as a string; #RRGGBBAA
   */


  toStringHexRGBA() {
    return this.toStringHexRGB() + this.formatHexValue(this.a);
  }
  /**
   * Returns the color formatted as a string; #AARRGGBB
   */


  toStringHexARGB() {
    return "#" + [this.a, this.r, this.g, this.b].map(this.formatHexValue).join("");
  }
  /**
   * Returns the color formatted as a string; "rgb(0xRR, 0xGG, 0xBB)"
   */


  toStringWebRGB() {
    return `rgb(${Math.round(denormalize(this.r, 0.0, 255.0))},${Math.round(denormalize(this.g, 0.0, 255.0))},${Math.round(denormalize(this.b, 0.0, 255.0))})`;
  }
  /**
   * Returns the color formatted as a string; "rgba(0xRR, 0xGG, 0xBB, a)"
   * @remarks
   * Note that this follows the convention of putting alpha in the range [0.0,1.0] while the other three channels are [0,255]
   */


  toStringWebRGBA() {
    return `rgba(${Math.round(denormalize(this.r, 0.0, 255.0))},${Math.round(denormalize(this.g, 0.0, 255.0))},${Math.round(denormalize(this.b, 0.0, 255.0))},${clamp(this.a, 0, 1)})`;
  }
  /**
   * Returns a new {@link ColorRGBA64} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorRGBA64(roundToPrecisionSmall(this.r, precision), roundToPrecisionSmall(this.g, precision), roundToPrecisionSmall(this.b, precision), roundToPrecisionSmall(this.a, precision));
  }
  /**
   * Returns a new {@link ColorRGBA64} with channel values clamped between 0 and 1.
   */


  clamp() {
    return new ColorRGBA64(clamp(this.r, 0, 1), clamp(this.g, 0, 1), clamp(this.b, 0, 1), clamp(this.a, 0, 1));
  }
  /**
   * Converts the {@link ColorRGBA64} to a {@link ColorRGBA64Config}.
   */


  toObject() {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.a
    };
  }

  formatHexValue(value) {
    return getHexStringForByte(denormalize(value, 0.0, 255.0));
  }

}

/**
 * {@link https://en.wikipedia.org/wiki/CIE_1931_color_space | XYZ color space}
 *
 * This implementation uses the D65 constants for 2 degrees. That determines the constants used for the pure white point of the XYZ space of 0.95047, 1.0, 1.08883.
 * {@link https://en.wikipedia.org/wiki/Illuminant_D65}
 * These constants determine how the XYZ, LCH and LAB colors convert to/from RGB.
 *
 * @public
 */

class ColorXYZ {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  /**
   * Construct a {@link ColorXYZ} from a config object.
   */


  static fromObject(data) {
    if (data && !isNaN(data.x) && !isNaN(data.y) && !isNaN(data.z)) {
      return new ColorXYZ(data.x, data.y, data.z);
    }

    return null;
  }
  /**
   * Determines if a color is equal to another
   * @param rhs - the value to compare
   */


  equalValue(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
  }
  /**
   * Returns a new {@link ColorXYZ} rounded to the provided precision
   * @param precision - the precision to round to
   */


  roundToPrecision(precision) {
    return new ColorXYZ(roundToPrecisionSmall(this.x, precision), roundToPrecisionSmall(this.y, precision), roundToPrecisionSmall(this.z, precision));
  }
  /**
   * Returns the {@link ColorXYZ} formatted as an object.
   */


  toObject() {
    return {
      x: this.x,
      y: this.y,
      z: this.z
    };
  }

}
/**
 * D65 2 degree white point
 */

ColorXYZ.whitePoint = new ColorXYZ(0.95047, 1.0, 1.08883);

// All conversions use the D65 2 degree white point for XYZ
// Info on conversions and constants used can be found in the following:
// https://en.wikipedia.org/wiki/CIELAB_color_space
// https://en.wikipedia.org/wiki/Illuminant_D65
// https://ninedegreesbelow.com/photography/xyz-rgb.html
// http://user.engineering.uiowa.edu/~aip/Misc/ColorFAQ.html
// https://web.stanford.edu/~sujason/ColorBalancing/adaptation.html
// http://brucelindbloom.com/index.html

/**
 * Get the luminance of a color in the linear RGB space.
 * This is not the same as the relative luminance in the sRGB space for WCAG contrast calculations. Use rgbToRelativeLuminance instead.
 * @param rgb - The input color
 *
 * @public
 */

function rgbToLinearLuminance(rgb) {
  return rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
}
/**
 * Get the relative luminance of a color.
 * Adjusts the color to sRGB space, which is necessary for the WCAG contrast spec.
 * The alpha channel of the input is ignored.
 * @param rgb - The input color
 *
 * @public
 */

function rgbToRelativeLuminance(rgb) {
  function luminanceHelper(i) {
    if (i <= 0.03928) {
      return i / 12.92;
    }

    return Math.pow((i + 0.055) / 1.055, 2.4);
  }

  return rgbToLinearLuminance(new ColorRGBA64(luminanceHelper(rgb.r), luminanceHelper(rgb.g), luminanceHelper(rgb.b), 1));
}

const calculateContrastRatio = (a, b) => (a + 0.05) / (b + 0.05);
/**
 * Calculate the contrast ratio between two colors. Uses the formula described by {@link https://www.w3.org/TR/WCAG20-TECHS/G17.html | WCAG 2.0}.
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */


function contrastRatio(a, b) {
  const luminanceA = rgbToRelativeLuminance(a);
  const luminanceB = rgbToRelativeLuminance(b);
  return luminanceA > luminanceB ? calculateContrastRatio(luminanceA, luminanceB) : calculateContrastRatio(luminanceB, luminanceA);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorHSL}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToHSL(rgb) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === rgb.r) {
      hue = 60 * ((rgb.g - rgb.b) / delta % 6);
    } else if (max === rgb.g) {
      hue = 60 * ((rgb.b - rgb.r) / delta + 2);
    } else {
      hue = 60 * ((rgb.r - rgb.g) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  const lum = (max + min) / 2;
  let sat = 0;

  if (delta !== 0) {
    sat = delta / (1 - Math.abs(2 * lum - 1));
  }

  return new ColorHSL(hue, sat, lum);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorHSL} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param hsl - the hsl color to convert
 * @param alpha - the alpha value
 *
 * @public
 */

function hslToRGB(hsl, alpha = 1) {
  const c = (1 - Math.abs(2 * hsl.l - 1)) * hsl.s;
  const x = c * (1 - Math.abs(hsl.h / 60 % 2 - 1));
  const m = hsl.l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hsl.h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hsl.h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hsl.h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hsl.h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hsl.h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hsl.h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return new ColorRGBA64(r + m, g + m, b + m, alpha);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorHSV}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToHSV(rgb) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === rgb.r) {
      hue = 60 * ((rgb.g - rgb.b) / delta % 6);
    } else if (max === rgb.g) {
      hue = 60 * ((rgb.b - rgb.r) / delta + 2);
    } else {
      hue = 60 * ((rgb.r - rgb.g) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  let sat = 0;

  if (max !== 0) {
    sat = delta / max;
  }

  return new ColorHSV(hue, sat, max);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorHSV} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param hsv - the hsv color to convert
 * @param alpha - the alpha value
 *
 * @public
 */

function hsvToRGB(hsv, alpha = 1) {
  const c = hsv.s * hsv.v;
  const x = c * (1 - Math.abs(hsv.h / 60 % 2 - 1));
  const m = hsv.v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hsv.h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hsv.h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hsv.h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hsv.h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hsv.h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hsv.h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return new ColorRGBA64(r + m, g + m, b + m, alpha);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLCH} to a {@link @microsoft/fast-colors#ColorLAB}
 * @param lch - the lch color to convert
 *
 * @public
 */

function lchToLAB(lch) {
  let a = 0;
  let b = 0;

  if (lch.h !== 0) {
    a = Math.cos(degreesToRadians(lch.h)) * lch.c;
    b = Math.sin(degreesToRadians(lch.h)) * lch.c;
  }

  return new ColorLAB(lch.l, a, b);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLAB} to a {@link @microsoft/fast-colors#ColorLCH}
 * @param lab - the lab color to convert
 *
 * @remarks
 * The discontinuity in the C parameter at 0 means that floating point errors will often result in values near 0 giving unpredictable results.
 * EG: 0.0000001 gives a very different result than -0.0000001
 * In cases where both a and b are very near zero this function will return an LCH color with an H of 0
 * More info about the atan2 function: {@link https://en.wikipedia.org/wiki/Atan2}
 * @public
 */

function labToLCH(lab) {
  let h = 0; // Because of the discontuity at 0 if a number is very close to 0 - often due to floating point errors - then
  // it gives unexpected results. EG: 0.000000000001 gives a different result than 0. So just avoid any number
  // that has both a and b very close to zero and lump it in with the h = 0 case.

  if (Math.abs(lab.b) > 0.001 || Math.abs(lab.a) > 0.001) {
    h = radiansToDegrees(Math.atan2(lab.b, lab.a));
  }

  if (h < 0) {
    h += 360;
  }

  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  return new ColorLCH(lab.l, c, h);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLAB} to a {@link @microsoft/fast-colors#ColorXYZ}
 * @param lab - the lab color to convert
 *
 * @public
 */

function labToXYZ(lab) {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const xcubed = Math.pow(fx, 3);
  const ycubed = Math.pow(fy, 3);
  const zcubed = Math.pow(fz, 3);
  let x = 0;

  if (xcubed > ColorLAB.epsilon) {
    x = xcubed;
  } else {
    x = (116 * fx - 16) / ColorLAB.kappa;
  }

  let y = 0;

  if (lab.l > ColorLAB.epsilon * ColorLAB.kappa) {
    y = ycubed;
  } else {
    y = lab.l / ColorLAB.kappa;
  }

  let z = 0;

  if (zcubed > ColorLAB.epsilon) {
    z = zcubed;
  } else {
    z = (116 * fz - 16) / ColorLAB.kappa;
  }

  x = ColorXYZ.whitePoint.x * x;
  y = ColorXYZ.whitePoint.y * y;
  z = ColorXYZ.whitePoint.z * z;
  return new ColorXYZ(x, y, z);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorXYZ} to a {@link @microsoft/fast-colors#ColorLAB}
 * @param xyz - the xyz color to convert
 *
 * @public
 */

function xyzToLAB(xyz) {
  function xyzToLABHelper(i) {
    if (i > ColorLAB.epsilon) {
      return Math.pow(i, 1 / 3);
    }

    return (ColorLAB.kappa * i + 16) / 116;
  }

  const x = xyzToLABHelper(xyz.x / ColorXYZ.whitePoint.x);
  const y = xyzToLABHelper(xyz.y / ColorXYZ.whitePoint.y);
  const z = xyzToLABHelper(xyz.z / ColorXYZ.whitePoint.z);
  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);
  return new ColorLAB(l, a, b);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorXYZ}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 * @public
 */

function rgbToXYZ(rgb) {
  function rgbToXYZHelper(i) {
    if (i <= 0.04045) {
      return i / 12.92;
    }

    return Math.pow((i + 0.055) / 1.055, 2.4);
  }

  const r = rgbToXYZHelper(rgb.r);
  const g = rgbToXYZHelper(rgb.g);
  const b = rgbToXYZHelper(rgb.b);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  return new ColorXYZ(x, y, z);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorXYZ} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param xyz - the xyz color to convert
 * @param alpha - the alpha value
 *
 * @remarks
 * Note that the xyz color space is significantly larger than sRGB. As such, this can return colors rgb values greater than 1 or less than 0
 * @public
 */

function xyzToRGB(xyz, alpha = 1) {
  function xyzToRGBHelper(i) {
    if (i <= 0.0031308) {
      return i * 12.92;
    }

    return 1.055 * Math.pow(i, 1 / 2.4) - 0.055;
  }

  const r = xyzToRGBHelper(xyz.x * 3.2404542 - xyz.y * 1.5371385 - xyz.z * 0.4985314);
  const g = xyzToRGBHelper(xyz.x * -0.969266 + xyz.y * 1.8760108 + xyz.z * 0.041556);
  const b = xyzToRGBHelper(xyz.x * 0.0556434 - xyz.y * 0.2040259 + xyz.z * 1.0572252);
  return new ColorRGBA64(r, g, b, alpha);
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorLAB}
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToLAB(rgb) {
  return xyzToLAB(rgbToXYZ(rgb));
}
/**
 * Converts a {@link @microsoft/fast-colors#ColorLAB} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param lab - the LAB color to convert
 * @param alpha - the alpha value
 *
 * @remarks
 * Note that the xyz color space (which the conversion from LAB uses) is significantly larger than sRGB. As such, this can return colors rgb values greater than 1 or less than 0
 *
 * @public
 */

function labToRGB(lab, alpha = 1) {
  return xyzToRGB(labToXYZ(lab), alpha);
}
/**
 * Convert a {@link @microsoft/fast-colors#ColorRGBA64} to a {@link @microsoft/fast-colors#ColorLCH}
 *
 * @param rgb - the rgb color to convert
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function rgbToLCH(rgb) {
  return labToLCH(rgbToLAB(rgb));
}
/**
 * Convert a {@link @microsoft/fast-colors#ColorLCH} to a {@link @microsoft/fast-colors#ColorRGBA64}
 * @param lch - the LCH color to convert
 * @param alpha - the alpha value
 *
 * @public
 */

function lchToRGB(lch, alpha = 1) {
  return labToRGB(lchToLAB(lch), alpha);
}

/**
 * Saturate a color using LCH color space
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function saturateViaLCH(input, saturation, saturationConstant = 18) {
  const lch = rgbToLCH(input);
  let sat = lch.c + saturation * saturationConstant;

  if (sat < 0) {
    sat = 0;
  }

  return lchToRGB(new ColorLCH(lch.l, sat, lch.h));
}
/**
 * @public
 */

function blendMultiplyChannel(bottom, top) {
  return bottom * top;
}
/**
 * Blends two colors with the multiply mode
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function blendMultiply(bottom, top) {
  return new ColorRGBA64(blendMultiplyChannel(bottom.r, top.r), blendMultiplyChannel(bottom.g, top.g), blendMultiplyChannel(bottom.b, top.b), 1);
}
/**
 * @public
 */

function blendOverlayChannel(bottom, top) {
  if (bottom < 0.5) {
    return clamp(2.0 * top * bottom, 0, 1);
  }

  return clamp(1.0 - 2.0 * (1.0 - top) * (1.0 - bottom), 0, 1);
}
/**
 * Blends two colors with the overlay mode
 *
 * @remarks
 * The alpha channel of the input is ignored
 *
 * @public
 */

function blendOverlay(bottom, top) {
  return new ColorRGBA64(blendOverlayChannel(bottom.r, top.r), blendOverlayChannel(bottom.g, top.g), blendOverlayChannel(bottom.b, top.b), 1);
}
/**
 * Color blend modes.
 * @public
 */

var ColorBlendMode;

(function (ColorBlendMode) {
  ColorBlendMode[ColorBlendMode["Burn"] = 0] = "Burn";
  ColorBlendMode[ColorBlendMode["Color"] = 1] = "Color";
  ColorBlendMode[ColorBlendMode["Darken"] = 2] = "Darken";
  ColorBlendMode[ColorBlendMode["Dodge"] = 3] = "Dodge";
  ColorBlendMode[ColorBlendMode["Lighten"] = 4] = "Lighten";
  ColorBlendMode[ColorBlendMode["Multiply"] = 5] = "Multiply";
  ColorBlendMode[ColorBlendMode["Overlay"] = 6] = "Overlay";
  ColorBlendMode[ColorBlendMode["Screen"] = 7] = "Screen";
})(ColorBlendMode || (ColorBlendMode = {}));

/**
 * Interpolate by RGB color space
 *
 * @public
 */

function interpolateRGB(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorRGBA64(lerp(position, left.r, right.r), lerp(position, left.g, right.g), lerp(position, left.b, right.b), lerp(position, left.a, right.a));
}
/**
 * Interpolate by HSL color space
 *
 * @public
 */

function interpolateHSL(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorHSL(lerpAnglesInDegrees(position, left.h, right.h), lerp(position, left.s, right.s), lerp(position, left.l, right.l));
}
/**
 * Interpolate by HSV color space
 *
 * @public
 */

function interpolateHSV(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorHSV(lerpAnglesInDegrees(position, left.h, right.h), lerp(position, left.s, right.s), lerp(position, left.v, right.v));
}
/**
 * Interpolate by XYZ color space
 *
 * @public
 */

function interpolateXYZ(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorXYZ(lerp(position, left.x, right.x), lerp(position, left.y, right.y), lerp(position, left.z, right.z));
}
/**
 * Interpolate by LAB color space
 *
 * @public
 */

function interpolateLAB(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorLAB(lerp(position, left.l, right.l), lerp(position, left.a, right.a), lerp(position, left.b, right.b));
}
/**
 * Interpolate by LCH color space
 *
 * @public
 */

function interpolateLCH(position, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  return new ColorLCH(lerp(position, left.l, right.l), lerp(position, left.c, right.c), lerpAnglesInDegrees(position, left.h, right.h));
}
/**
 * Color interpolation spaces
 *
 * @public
 */

var ColorInterpolationSpace;

(function (ColorInterpolationSpace) {
  ColorInterpolationSpace[ColorInterpolationSpace["RGB"] = 0] = "RGB";
  ColorInterpolationSpace[ColorInterpolationSpace["HSL"] = 1] = "HSL";
  ColorInterpolationSpace[ColorInterpolationSpace["HSV"] = 2] = "HSV";
  ColorInterpolationSpace[ColorInterpolationSpace["XYZ"] = 3] = "XYZ";
  ColorInterpolationSpace[ColorInterpolationSpace["LAB"] = 4] = "LAB";
  ColorInterpolationSpace[ColorInterpolationSpace["LCH"] = 5] = "LCH";
})(ColorInterpolationSpace || (ColorInterpolationSpace = {}));
/**
 * Interpolate by color space
 *
 * @public
 */


function interpolateByColorSpace(position, space, left, right) {
  if (isNaN(position) || position <= 0) {
    return left;
  } else if (position >= 1) {
    return right;
  }

  switch (space) {
    case ColorInterpolationSpace.HSL:
      return hslToRGB(interpolateHSL(position, rgbToHSL(left), rgbToHSL(right)));

    case ColorInterpolationSpace.HSV:
      return hsvToRGB(interpolateHSV(position, rgbToHSV(left), rgbToHSV(right)));

    case ColorInterpolationSpace.XYZ:
      return xyzToRGB(interpolateXYZ(position, rgbToXYZ(left), rgbToXYZ(right)));

    case ColorInterpolationSpace.LAB:
      return labToRGB(interpolateLAB(position, rgbToLAB(left), rgbToLAB(right)));

    case ColorInterpolationSpace.LCH:
      return lchToRGB(interpolateLCH(position, rgbToLCH(left), rgbToLCH(right)));

    default:
      return interpolateRGB(position, left, right);
  }
}

/**
 * A color scale created from linear stops
 * @public
 */

class ColorScale {
  constructor(stops) {
    if (stops == null || stops.length === 0) {
      throw new Error("The stops argument must be non-empty");
    } else {
      this.stops = this.sortColorScaleStops(stops);
    }
  }

  static createBalancedColorScale(colors) {
    if (colors == null || colors.length === 0) {
      throw new Error("The colors argument must be non-empty");
    }

    const stops = new Array(colors.length);

    for (let i = 0; i < colors.length; i++) {
      // Special case first and last in order to avoid floating point jaggies
      if (i === 0) {
        stops[i] = {
          color: colors[i],
          position: 0
        };
      } else if (i === colors.length - 1) {
        stops[i] = {
          color: colors[i],
          position: 1
        };
      } else {
        stops[i] = {
          color: colors[i],
          position: i * (1 / (colors.length - 1))
        };
      }
    }

    return new ColorScale(stops);
  }

  getColor(position, interpolationMode = ColorInterpolationSpace.RGB) {
    if (this.stops.length === 1) {
      return this.stops[0].color;
    } else if (position <= 0) {
      return this.stops[0].color;
    } else if (position >= 1) {
      return this.stops[this.stops.length - 1].color;
    }

    let lowerIndex = 0;

    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].position <= position) {
        lowerIndex = i;
      }
    }

    let upperIndex = lowerIndex + 1;

    if (upperIndex >= this.stops.length) {
      upperIndex = this.stops.length - 1;
    }

    const scalePosition = (position - this.stops[lowerIndex].position) * (1.0 / (this.stops[upperIndex].position - this.stops[lowerIndex].position));
    return interpolateByColorSpace(scalePosition, interpolationMode, this.stops[lowerIndex].color, this.stops[upperIndex].color);
  }

  trim(lowerBound, upperBound, interpolationMode = ColorInterpolationSpace.RGB) {
    if (lowerBound < 0 || upperBound > 1 || upperBound < lowerBound) {
      throw new Error("Invalid bounds");
    }

    if (lowerBound === upperBound) {
      return new ColorScale([{
        color: this.getColor(lowerBound, interpolationMode),
        position: 0
      }]);
    }

    const containedStops = [];

    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].position >= lowerBound && this.stops[i].position <= upperBound) {
        containedStops.push(this.stops[i]);
      }
    }

    if (containedStops.length === 0) {
      return new ColorScale([{
        color: this.getColor(lowerBound),
        position: lowerBound
      }, {
        color: this.getColor(upperBound),
        position: upperBound
      }]);
    }

    if (containedStops[0].position !== lowerBound) {
      containedStops.unshift({
        color: this.getColor(lowerBound),
        position: lowerBound
      });
    }

    if (containedStops[containedStops.length - 1].position !== upperBound) {
      containedStops.push({
        color: this.getColor(upperBound),
        position: upperBound
      });
    }

    const range = upperBound - lowerBound;
    const finalStops = new Array(containedStops.length);

    for (let i = 0; i < containedStops.length; i++) {
      finalStops[i] = {
        color: containedStops[i].color,
        position: (containedStops[i].position - lowerBound) / range
      };
    }

    return new ColorScale(finalStops);
  }

  findNextColor(position, contrast, searchDown = false, interpolationMode = ColorInterpolationSpace.RGB, contrastErrorMargin = 0.005, maxSearchIterations = 32) {
    if (isNaN(position) || position <= 0) {
      position = 0;
    } else if (position >= 1) {
      position = 1;
    }

    const startingColor = this.getColor(position, interpolationMode);
    const finalPosition = searchDown ? 0 : 1;
    const finalColor = this.getColor(finalPosition, interpolationMode);
    const finalContrast = contrastRatio(startingColor, finalColor);

    if (finalContrast <= contrast) {
      return finalPosition;
    }

    let testRangeMin = searchDown ? 0 : position;
    let testRangeMax = searchDown ? position : 0;
    let mid = finalPosition;
    let iterations = 0;

    while (iterations <= maxSearchIterations) {
      mid = Math.abs(testRangeMax - testRangeMin) / 2 + testRangeMin;
      const midColor = this.getColor(mid, interpolationMode);
      const midContrast = contrastRatio(startingColor, midColor);

      if (Math.abs(midContrast - contrast) <= contrastErrorMargin) {
        return mid;
      } else if (midContrast > contrast) {
        if (searchDown) {
          testRangeMin = mid;
        } else {
          testRangeMax = mid;
        }
      } else {
        if (searchDown) {
          testRangeMax = mid;
        } else {
          testRangeMin = mid;
        }
      }

      iterations++;
    }

    return mid;
  }

  clone() {
    const newStops = new Array(this.stops.length);

    for (let i = 0; i < newStops.length; i++) {
      newStops[i] = {
        color: this.stops[i].color,
        position: this.stops[i].position
      };
    }

    return new ColorScale(newStops);
  }

  sortColorScaleStops(stops) {
    return stops.sort((a, b) => {
      const A = a.position;
      const B = b.position;

      if (A < B) {
        return -1;
      } else if (A > B) {
        return 1;
      } else {
        return 0;
      }
    });
  }

}

const hexRGBRegex = /^#((?:[0-9a-f]{6}|[0-9a-f]{3}))$/i; // Matches #RGB and #RRGGBBAA, where R, G, B, and A are [0-9] or [A-F]
/**
 * Converts a hexadecimal color string to a {@link @microsoft/fast-colors#ColorRGBA64}.
 * @param raw - a color string in the form of "#RRGGBB" or "#RGB"
 * @example
 * ```ts
 * parseColorHexRGBA("#FF0000");
 * parseColorHexRGBA("#F00");
 * ```
 * @public
 */

function parseColorHexRGB(raw) {
  const result = hexRGBRegex.exec(raw);

  if (result === null) {
    return null;
  }

  let digits = result[1];

  if (digits.length === 3) {
    const r = digits.charAt(0);
    const g = digits.charAt(1);
    const b = digits.charAt(2);
    digits = r.concat(r, g, g, b, b);
  }

  const rawInt = parseInt(digits, 16);

  if (isNaN(rawInt)) {
    return null;
  } // Note the use of >>> rather than >> as we want JS to manipulate these as unsigned numbers


  return new ColorRGBA64(normalize((rawInt & 0xff0000) >>> 16, 0, 255), normalize((rawInt & 0x00ff00) >>> 8, 0, 255), normalize(rawInt & 0x0000ff, 0, 255), 1);
}

/**
 * Generates a color palette
 * @public
 */

class ColorPalette {
  constructor(config) {
    this.config = Object.assign({}, ColorPalette.defaultPaletteConfig, config);
    this.palette = [];
    this.updatePaletteColors();
  }

  updatePaletteGenerationValues(newConfig) {
    let changed = false;

    for (const key in newConfig) {
      if (this.config[key]) {
        if (this.config[key].equalValue) {
          if (!this.config[key].equalValue(newConfig[key])) {
            this.config[key] = newConfig[key];
            changed = true;
          }
        } else {
          if (newConfig[key] !== this.config[key]) {
            this.config[key] = newConfig[key];
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.updatePaletteColors();
    }

    return changed;
  }

  updatePaletteColors() {
    const scale = this.generatePaletteColorScale();

    for (let i = 0; i < this.config.steps; i++) {
      this.palette[i] = scale.getColor(i / (this.config.steps - 1), this.config.interpolationMode);
    }
  }

  generatePaletteColorScale() {
    // Even when config.baseScalePosition is specified, using 0.5 for the baseColor
    // in the baseScale gives better results. Otherwise very off-center palettes
    // tend to go completely grey at the end furthest from the specified base color.
    const baseColorHSL = rgbToHSL(this.config.baseColor);
    const baseScale = new ColorScale([{
      position: 0,
      color: this.config.scaleColorLight
    }, {
      position: 0.5,
      color: this.config.baseColor
    }, {
      position: 1,
      color: this.config.scaleColorDark
    }]);
    const trimmedScale = baseScale.trim(this.config.clipLight, 1 - this.config.clipDark);
    const trimmedLight = trimmedScale.getColor(0);
    const trimmedDark = trimmedScale.getColor(1);
    let adjustedLight = trimmedLight;
    let adjustedDark = trimmedDark;

    if (baseColorHSL.s >= this.config.saturationAdjustmentCutoff) {
      adjustedLight = saturateViaLCH(adjustedLight, this.config.saturationLight);
      adjustedDark = saturateViaLCH(adjustedDark, this.config.saturationDark);
    }

    if (this.config.multiplyLight !== 0) {
      const multiply = blendMultiply(this.config.baseColor, adjustedLight);
      adjustedLight = interpolateByColorSpace(this.config.multiplyLight, this.config.interpolationMode, adjustedLight, multiply);
    }

    if (this.config.multiplyDark !== 0) {
      const multiply = blendMultiply(this.config.baseColor, adjustedDark);
      adjustedDark = interpolateByColorSpace(this.config.multiplyDark, this.config.interpolationMode, adjustedDark, multiply);
    }

    if (this.config.overlayLight !== 0) {
      const overlay = blendOverlay(this.config.baseColor, adjustedLight);
      adjustedLight = interpolateByColorSpace(this.config.overlayLight, this.config.interpolationMode, adjustedLight, overlay);
    }

    if (this.config.overlayDark !== 0) {
      const overlay = blendOverlay(this.config.baseColor, adjustedDark);
      adjustedDark = interpolateByColorSpace(this.config.overlayDark, this.config.interpolationMode, adjustedDark, overlay);
    }

    if (this.config.baseScalePosition) {
      if (this.config.baseScalePosition <= 0) {
        return new ColorScale([{
          position: 0,
          color: this.config.baseColor
        }, {
          position: 1,
          color: adjustedDark.clamp()
        }]);
      } else if (this.config.baseScalePosition >= 1) {
        return new ColorScale([{
          position: 0,
          color: adjustedLight.clamp()
        }, {
          position: 1,
          color: this.config.baseColor
        }]);
      }

      return new ColorScale([{
        position: 0,
        color: adjustedLight.clamp()
      }, {
        position: this.config.baseScalePosition,
        color: this.config.baseColor
      }, {
        position: 1,
        color: adjustedDark.clamp()
      }]);
    }

    return new ColorScale([{
      position: 0,
      color: adjustedLight.clamp()
    }, {
      position: 0.5,
      color: this.config.baseColor
    }, {
      position: 1,
      color: adjustedDark.clamp()
    }]);
  }

}
ColorPalette.defaultPaletteConfig = {
  baseColor: parseColorHexRGB("#808080"),
  steps: 11,
  interpolationMode: ColorInterpolationSpace.RGB,
  scaleColorLight: new ColorRGBA64(1, 1, 1, 1),
  scaleColorDark: new ColorRGBA64(0, 0, 0, 1),
  clipLight: 0.185,
  clipDark: 0.16,
  saturationAdjustmentCutoff: 0.05,
  saturationLight: 0.35,
  saturationDark: 1.25,
  overlayLight: 0,
  overlayDark: 0.25,
  multiplyLight: 0,
  multiplyDark: 0,
  baseScalePosition: 0.5
};
ColorPalette.greyscalePaletteConfig = {
  baseColor: parseColorHexRGB("#808080"),
  steps: 11,
  interpolationMode: ColorInterpolationSpace.RGB,
  scaleColorLight: new ColorRGBA64(1, 1, 1, 1),
  scaleColorDark: new ColorRGBA64(0, 0, 0, 1),
  clipLight: 0,
  clipDark: 0,
  saturationAdjustmentCutoff: 0,
  saturationLight: 0,
  saturationDark: 0,
  overlayLight: 0,
  overlayDark: 0,
  multiplyLight: 0,
  multiplyDark: 0,
  baseScalePosition: 0.5
};
/**
 * @public
 */

({
  targetSize: 63,
  spacing: 4,
  scaleColorLight: ColorPalette.defaultPaletteConfig.scaleColorLight,
  scaleColorDark: ColorPalette.defaultPaletteConfig.scaleColorDark
});

/**
 * Creates a color palette for UI components
 * @public
 */

class ComponentStateColorPalette {
  constructor(config) {
    this.palette = [];
    this.config = Object.assign({}, ComponentStateColorPalette.defaultPaletteConfig, config);
    this.regenPalettes();
  }

  regenPalettes() {
    let steps = this.config.steps;

    if (isNaN(steps) || steps < 3) {
      steps = 3;
    } // This palette is tuned to go as dark as differences between the levels can be perceived according to tests
    // on numerous monitors in different conditions. Stay linear from white until this first cutoff.


    const darkLum = 0.14; // In the dark compression, this is the last luminance value before full black.

    const darkestLum = 0.06; // The Color for the luminance value above, placed on the ramp at it's normal position, so darker colors after
    // it can be compressed.

    const darkLumColor = new ColorRGBA64(darkLum, darkLum, darkLum, 1); // The number of steps in the ramp that has been tuned for default use. This coincides with the size of the
    // default ramp, but the palette could be generated with fewer steps to increase final contrast. This number
    // should however stay the same.

    const stepsForLuminanceRamp = 94; // Create the reference, dark-compressed, grey palette, like:
    // F------------------------------------------------------------------------------------[dark]------[darkest]0
    //                                                                                      |--compressed area--|

    const r = new ColorPalette(Object.assign(Object.assign({}, ColorPalette.greyscalePaletteConfig), {
      baseColor: darkLumColor,
      baseScalePosition: (1 - darkLum) * 100 / stepsForLuminanceRamp,
      steps
    }));
    const referencePalette = r.palette; // Find the requested base color on the adjusted luminance reference ramp.
    // There is no _right_ way to desaturate a color, and both methods we've tested have value, so average them out.

    const baseColorLum1 = rgbToLinearLuminance(this.config.baseColor);
    const baseColorLum2 = rgbToHSL(this.config.baseColor).l;
    const baseColorLum = (baseColorLum1 + baseColorLum2) / 2;
    const baseColorRefIndex = this.matchRelativeLuminanceIndex(baseColorLum, referencePalette);
    const baseColorPercent = baseColorRefIndex / (steps - 1); // Find the luminance location for the dark cutoff.

    const darkRefIndex = this.matchRelativeLuminanceIndex(darkLum, referencePalette);
    const darkPercent = darkRefIndex / (steps - 1); // Issue https://github.com/microsoft/fast/issues/1904
    // Creating a color from H, S, and a known L value is not the inverse of getting the relative
    // luminace as above. Need to derive a relative luminance version of the color to better match on the dark end.
    // Find the dark cutoff and darkest variations of the requested base color.

    const baseColorHSL = rgbToHSL(this.config.baseColor);
    const darkBaseColor = hslToRGB(ColorHSL.fromObject({
      h: baseColorHSL.h,
      s: baseColorHSL.s,
      l: darkLum
    }));
    const darkestBaseColor = hslToRGB(ColorHSL.fromObject({
      h: baseColorHSL.h,
      s: baseColorHSL.s,
      l: darkestLum
    })); // Create the gradient stops, including the base color and anchor colors for the dark end compression.

    const fullColorScaleStops = new Array(5);
    fullColorScaleStops[0] = {
      position: 0,
      color: new ColorRGBA64(1, 1, 1, 1)
    };
    fullColorScaleStops[1] = {
      position: baseColorPercent,
      color: this.config.baseColor
    };
    fullColorScaleStops[2] = {
      position: darkPercent,
      color: darkBaseColor
    };
    fullColorScaleStops[3] = {
      position: 0.99,
      color: darkestBaseColor
    };
    fullColorScaleStops[4] = {
      position: 1,
      color: new ColorRGBA64(0, 0, 0, 1)
    };
    const scale = new ColorScale(fullColorScaleStops); // Create the palette.

    this.palette = new Array(steps);

    for (let i = 0; i < steps; i++) {
      const c = scale.getColor(i / (steps - 1), ColorInterpolationSpace.RGB);
      this.palette[i] = c;
    }
  }

  matchRelativeLuminanceIndex(input, reference) {
    let bestFitValue = Number.MAX_VALUE;
    let bestFitIndex = 0;
    let i = 0;
    const referenceLength = reference.length;

    for (; i < referenceLength; i++) {
      const fitValue = Math.abs(rgbToLinearLuminance(reference[i]) - input);

      if (fitValue < bestFitValue) {
        bestFitValue = fitValue;
        bestFitIndex = i;
      }
    }

    return bestFitIndex;
  }

}
ComponentStateColorPalette.defaultPaletteConfig = {
  baseColor: parseColorHexRGB("#808080"),
  steps: 94
};

/**
 * @internal
 */
function contrast(a, b) {
  const L1 = a.relativeLuminance > b.relativeLuminance ? a : b;
  const L2 = a.relativeLuminance > b.relativeLuminance ? b : a;
  return (L1.relativeLuminance + 0.05) / (L2.relativeLuminance + 0.05);
}

/** @public */

const SwatchRGB = Object.freeze({
  create(r, g, b) {
    return new SwatchRGBImpl(r, g, b);
  },

  from(obj) {
    return new SwatchRGBImpl(obj.r, obj.g, obj.b);
  }

});
/**
 * A RGB implementation of {@link Swatch}
 * @internal
 */

class SwatchRGBImpl extends ColorRGBA64 {
  /**
   *
   * @param red - Red channel expressed as a number between 0 and 1
   * @param green - Green channel expressed as a number between 0 and 1
   * @param blue - Blue channel expressed as a number between 0 and 1
   */
  constructor(red, green, blue) {
    super(red, green, blue, 1);
    this.toColorString = this.toStringHexRGB;
    this.contrast = contrast.bind(null, this);
    this.createCSS = this.toColorString;
    this.relativeLuminance = rgbToRelativeLuminance(this);
  }

  static fromObject(obj) {
    return new SwatchRGBImpl(obj.r, obj.g, obj.b);
  }

}

/**
 * @internal
 */
function binarySearch(valuesToSearch, searchCondition, startIndex = 0, endIndex = valuesToSearch.length - 1) {
  if (endIndex === startIndex) {
    return valuesToSearch[startIndex];
  }

  const middleIndex = Math.floor((endIndex - startIndex) / 2) + startIndex; // Check to see if this passes on the item in the center of the array
  // if it does check the previous values

  return searchCondition(valuesToSearch[middleIndex]) ? binarySearch(valuesToSearch, searchCondition, startIndex, middleIndex // include this index because it passed the search condition
  ) : binarySearch(valuesToSearch, searchCondition, middleIndex + 1, // exclude this index because it failed the search condition
  endIndex);
}

/*
 * A color is in "dark" if there is more contrast between #000000 and a reference
 * color than #FFFFFF and the reference color. That threshold can be expressed as a relative luminance
 * using the contrast formula as (1 + 0.5) / (R + 0.05) === (R + 0.05) / (0 + 0.05),
 * which reduces to the following, where 'R' is the relative luminance of the reference color
 */
const target = (-0.1 + Math.sqrt(0.21)) / 2;
/**
 * Determines if a color should be considered Dark Mode
 * @param color - The color to check to mode of
 * @returns boolean
 *
 * @public
 */

function isDark(color) {
  return color.relativeLuminance <= target;
}

/**
 * @internal
 */

function directionByIsDark(color) {
  return isDark(color) ? -1 : 1;
}

/** @public */

const PaletteRGB = Object.freeze({
  create(source) {
    return PaletteRGBImpl.from(source);
  }

});
/**
 * A {@link Palette} representing RGB swatch values.
 * @public
 */

class PaletteRGBImpl {
  /**
   *
   * @param source - The source color for the palette
   * @param swatches - All swatches in the palette
   */
  constructor(source, swatches) {
    this.source = source;
    this.swatches = swatches;
    this.reversedSwatches = Object.freeze([...this.swatches].reverse());
    this.lastIndex = this.swatches.length - 1;
  }
  /**
   * {@inheritdoc Palette.colorContrast}
   */


  colorContrast(reference, contrastTarget, initialSearchIndex, direction) {
    if (initialSearchIndex === undefined) {
      initialSearchIndex = this.closestIndexOf(reference);
    }

    let source = this.swatches;
    const endSearchIndex = this.lastIndex;
    let startSearchIndex = initialSearchIndex;

    if (direction === undefined) {
      direction = directionByIsDark(reference);
    }

    const condition = value => contrast(reference, value) >= contrastTarget;

    if (direction === -1) {
      source = this.reversedSwatches;
      startSearchIndex = endSearchIndex - startSearchIndex;
    }

    return binarySearch(source, condition, startSearchIndex, endSearchIndex);
  }
  /**
   * {@inheritdoc Palette.get}
   */


  get(index) {
    return this.swatches[index] || this.swatches[clamp(index, 0, this.lastIndex)];
  }
  /**
   * {@inheritdoc Palette.closestIndexOf}
   */


  closestIndexOf(reference) {
    const index = this.swatches.indexOf(reference);

    if (index !== -1) {
      return index;
    }

    const closest = this.swatches.reduce((previous, next) => Math.abs(next.relativeLuminance - reference.relativeLuminance) < Math.abs(previous.relativeLuminance - reference.relativeLuminance) ? next : previous);
    return this.swatches.indexOf(closest);
  }
  /**
   * Create a color palette from a provided swatch
   * @param source - The source swatch to create a palette from
   * @returns
   */


  static from(source) {
    return new PaletteRGBImpl(source, Object.freeze(new ComponentStateColorPalette({
      baseColor: ColorRGBA64.fromObject(source)
    }).palette.map(x => {
      const _x = parseColorHexRGB(x.toStringHexRGB());

      return SwatchRGB.create(_x.r, _x.g, _x.b);
    })));
  }

}

/**
 * @internal
 */
function accentFill(palette, neutralPalette, reference, hoverDelta, activeDelta, focusDelta, neutralFillRestDelta, neutralFillHoverDelta, neutralFillActiveDelta) {
  const accent = palette.source;
  const referenceIndex = neutralPalette.closestIndexOf(reference);
  const swapThreshold = Math.max(neutralFillRestDelta, neutralFillHoverDelta, neutralFillActiveDelta);
  const direction = referenceIndex >= swapThreshold ? -1 : 1;
  const accentIndex = palette.closestIndexOf(accent);
  const hoverIndex = accentIndex;
  const restIndex = hoverIndex + direction * -1 * hoverDelta;
  const activeIndex = restIndex + direction * activeDelta;
  const focusIndex = restIndex + direction * focusDelta;
  return {
    rest: palette.get(restIndex),
    hover: palette.get(hoverIndex),
    active: palette.get(activeIndex),
    focus: palette.get(focusIndex)
  };
}

/**
 * @internal
 */

function accentForeground(palette, reference, contrastTarget, restDelta, hoverDelta, activeDelta, focusDelta) {
  const accent = palette.source;
  const accentIndex = palette.closestIndexOf(accent);
  const direction = directionByIsDark(reference);
  const startIndex = accentIndex + (direction === 1 ? Math.min(restDelta, hoverDelta) : Math.max(direction * restDelta, direction * hoverDelta));
  const accessibleSwatch = palette.colorContrast(reference, contrastTarget, startIndex, direction);
  const accessibleIndex1 = palette.closestIndexOf(accessibleSwatch);
  const accessibleIndex2 = accessibleIndex1 + direction * Math.abs(restDelta - hoverDelta);
  const indexOneIsRestState = direction === 1 ? restDelta < hoverDelta : direction * restDelta > direction * hoverDelta;
  let restIndex;
  let hoverIndex;

  if (indexOneIsRestState) {
    restIndex = accessibleIndex1;
    hoverIndex = accessibleIndex2;
  } else {
    restIndex = accessibleIndex2;
    hoverIndex = accessibleIndex1;
  }

  return {
    rest: palette.get(restIndex),
    hover: palette.get(hoverIndex),
    active: palette.get(restIndex + direction * activeDelta),
    focus: palette.get(restIndex + direction * focusDelta)
  };
}

/**
 * @internal
 */

const white = SwatchRGB.create(1, 1, 1);
/**
 * @internal
 */

const black = SwatchRGB.create(0, 0, 0);
/**
 * @internal
 */

const middleGrey = SwatchRGB.create(0.5, 0.5, 0.5);
/**
 * @internal
 */

const base = parseColorHexRGB("#DA1A5F");
const accentBase = SwatchRGB.create(base.r, base.g, base.b);

/**
 * @internal
 */

function foregroundOnAccent(reference, contrastTarget) {
  return reference.contrast(white) >= contrastTarget ? white : black;
}

/**
 *
 * @param palette - The palette to operate on
 * @param reference - The reference color to calculate a color for
 * @param delta - The offset from the reference's location
 * @param threshold - Determines if a lighter or darker color than the reference will be picked.
 * @returns
 *
 * @internal
 */
function neutralFill(palette, reference, restDelta, hoverDelta, activeDelta, focusDelta) {
  const referenceIndex = palette.closestIndexOf(reference);
  const threshold = Math.max(restDelta, hoverDelta, activeDelta, focusDelta);
  const direction = referenceIndex >= threshold ? -1 : 1;
  return {
    rest: palette.get(referenceIndex + direction * restDelta),
    hover: palette.get(referenceIndex + direction * hoverDelta),
    active: palette.get(referenceIndex + direction * activeDelta),
    focus: palette.get(referenceIndex + direction * focusDelta)
  };
}

/**
 * @internal
 */

function neutralFillInput(palette, reference, restDelta, hoverDelta, activeDelta, focusDelta) {
  const direction = directionByIsDark(reference);
  const referenceIndex = palette.closestIndexOf(reference);
  return {
    rest: palette.get(referenceIndex - direction * restDelta),
    hover: palette.get(referenceIndex - direction * hoverDelta),
    active: palette.get(referenceIndex - direction * activeDelta),
    focus: palette.get(referenceIndex - direction * focusDelta)
  };
}

/**
 * @internal
 */
function neutralFillLayer(palette, reference, delta) {
  const referenceIndex = palette.closestIndexOf(reference);
  return palette.get(referenceIndex - (referenceIndex < delta ? delta * -1 : delta));
}

/**
 * @internal
 */
function neutralFillStealth(palette, reference, restDelta, hoverDelta, activeDelta, focusDelta, fillRestDelta, fillHoverDelta, fillActiveDelta, fillFocusDelta) {
  const swapThreshold = Math.max(restDelta, hoverDelta, activeDelta, focusDelta, fillRestDelta, fillHoverDelta, fillActiveDelta, fillFocusDelta);
  const referenceIndex = palette.closestIndexOf(reference);
  const direction = referenceIndex >= swapThreshold ? -1 : 1;
  return {
    rest: palette.get(referenceIndex + direction * restDelta),
    hover: palette.get(referenceIndex + direction * hoverDelta),
    active: palette.get(referenceIndex + direction * activeDelta),
    focus: palette.get(referenceIndex + direction * focusDelta)
  };
}

/**
 * @internal
 */

function neutralFillContrast(palette, reference, restDelta, hoverDelta, activeDelta, focusDelta) {
  const direction = directionByIsDark(reference);
  const accessibleIndex = palette.closestIndexOf(palette.colorContrast(reference, 4.5));
  const accessibleIndex2 = accessibleIndex + direction * Math.abs(restDelta - hoverDelta);
  const indexOneIsRest = direction === 1 ? restDelta < hoverDelta : direction * restDelta > direction * hoverDelta;
  let restIndex;
  let hoverIndex;

  if (indexOneIsRest) {
    restIndex = accessibleIndex;
    hoverIndex = accessibleIndex2;
  } else {
    restIndex = accessibleIndex2;
    hoverIndex = accessibleIndex;
  }

  return {
    rest: palette.get(restIndex),
    hover: palette.get(hoverIndex),
    active: palette.get(restIndex + direction * activeDelta),
    focus: palette.get(restIndex + direction * focusDelta)
  };
}

/** @internal */

function focusStrokeOuter(palette, reference) {
  return palette.colorContrast(reference, 3.5);
}
/** @internal */

function focusStrokeInner(palette, reference, focusColor) {
  return palette.colorContrast(focusColor, 3.5, palette.closestIndexOf(palette.source), directionByIsDark(reference) * -1);
}

/**
 * @internal
 */
function neutralForeground(palette, reference) {
  return palette.colorContrast(reference, 14);
}

/**
 * The neutralForegroundHint color recipe
 * @param palette - The palette to operate on
 * @param reference - The reference color
 *
 * @internal
 */
function neutralForegroundHint(palette, reference) {
  return palette.colorContrast(reference, 4.5);
}

function baseLayerLuminanceSwatch(luminance) {
  return SwatchRGB.create(luminance, luminance, luminance);
}
/**
 * Recommended values for light and dark mode for {@link @microsoft/fast-components#baseLayerLuminance}.
 *
 * @public
 */

var StandardLuminance;

(function (StandardLuminance) {
  StandardLuminance[StandardLuminance["LightMode"] = 1] = "LightMode";
  StandardLuminance[StandardLuminance["DarkMode"] = 0.23] = "DarkMode";
})(StandardLuminance || (StandardLuminance = {}));

/**
 * @internal
 */

function neutralLayerCardContainer(palette, relativeLuminance, layerDelta) {
  return palette.get(palette.closestIndexOf(baseLayerLuminanceSwatch(relativeLuminance)) + layerDelta);
}

/**
 * @internal
 */

function neutralLayerFloating(palette, relativeLuminance, layerDelta) {
  const cardIndex = palette.closestIndexOf(baseLayerLuminanceSwatch(relativeLuminance)) - layerDelta;
  return palette.get(cardIndex - layerDelta);
}

function neutralLayer1(palette, baseLayerLuminance) {
  return palette.get(palette.closestIndexOf(baseLayerLuminanceSwatch(baseLayerLuminance)));
}

/**
 * @internal
 */

function neutralLayer2Index(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta) {
  return Math.max(palette.closestIndexOf(baseLayerLuminanceSwatch(luminance)) + layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta);
}
/**
 * @internal
 */

function neutralLayer2(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta) {
  return palette.get(neutralLayer2Index(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta));
}

/**
 * @internal
 */

function neutralLayer3(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta) {
  return palette.get(neutralLayer2Index(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta) + layerDelta);
}

/**
 * @internal
 */

function neutralLayer4(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta) {
  return palette.get(neutralLayer2Index(palette, luminance, layerDelta, fillRestDelta, fillHoverDelta, fillActiveDelta) + layerDelta * 2);
}

/**
 * @internal
 */

function neutralStroke(palette, reference, restDelta, hoverDelta, activeDelta, focusDelta) {
  const referenceIndex = palette.closestIndexOf(reference);
  const direction = directionByIsDark(reference);
  const restIndex = referenceIndex + direction * restDelta;
  const hoverIndex = restIndex + direction * (hoverDelta - restDelta);
  const activeIndex = restIndex + direction * (activeDelta - restDelta);
  const focusIndex = restIndex + direction * (focusDelta - restDelta);
  return {
    rest: palette.get(restIndex),
    hover: palette.get(hoverIndex),
    active: palette.get(activeIndex),
    focus: palette.get(focusIndex)
  };
}

/**
 * The neutralStrokeDivider color recipe
 * @param palette - The palette to operate on
 * @param reference - The reference color
 * @param delta - The offset from the reference
 *
 * @internal
 */

function neutralStrokeDivider(palette, reference, delta) {
  return palette.get(palette.closestIndexOf(reference) + directionByIsDark(reference) * delta);
}

const {
  create: create$1
} = DesignToken; // General tokens

/** @public */

const bodyFont = create$1("body-font").withDefault('aktiv-grotesk, "Segoe UI", Arial, Helvetica, sans-serif');
/** @public */

const baseHeightMultiplier = create$1("base-height-multiplier").withDefault(10);
/** @public */

const baseHorizontalSpacingMultiplier = create$1("base-horizontal-spacing-multiplier").withDefault(3);
/** @public */

const baseLayerLuminance = create$1("base-layer-luminance").withDefault(StandardLuminance.DarkMode);
/** @public */

const controlCornerRadius = create$1("control-corner-radius").withDefault(4);
/** @public */

const density = create$1("density").withDefault(0);
/** @public */

const designUnit = create$1("design-unit").withDefault(4);
/** @public */

const direction = create$1("direction").withDefault(Direction.ltr);
/** @public */

const disabledOpacity = create$1("disabled-opacity").withDefault(0.3);
/** @public */

const strokeWidth = create$1("stroke-width").withDefault(1);
/** @public */

const focusStrokeWidth = create$1("focus-stroke-width").withDefault(2); // Typography values

/** @public */

const typeRampBaseFontSize = create$1("type-ramp-base-font-size").withDefault("14px");
/** @public */

const typeRampBaseLineHeight = create$1("type-ramp-base-line-height").withDefault("20px");
/** @public */

const typeRampMinus1FontSize = create$1("type-ramp-minus-1-font-size").withDefault("12px");
/** @public */

const typeRampMinus1LineHeight = create$1("type-ramp-minus-1-line-height").withDefault("16px");
/** @public */

const typeRampMinus2FontSize = create$1("type-ramp-minus-2-font-size").withDefault("10px");
/** @public */

const typeRampMinus2LineHeight = create$1("type-ramp-minus-2-line-height").withDefault("16px");
/** @public */

const typeRampPlus1FontSize = create$1("type-ramp-plus-1-font-size").withDefault("16px");
/** @public */

const typeRampPlus1LineHeight = create$1("type-ramp-plus-1-line-height").withDefault("24px");
/** @public */

const typeRampPlus2FontSize = create$1("type-ramp-plus-2-font-size").withDefault("20px");
/** @public */

const typeRampPlus2LineHeight = create$1("type-ramp-plus-2-line-height").withDefault("28px");
/** @public */

const typeRampPlus3FontSize = create$1("type-ramp-plus-3-font-size").withDefault("28px");
/** @public */

const typeRampPlus3LineHeight = create$1("type-ramp-plus-3-line-height").withDefault("36px");
/** @public */

const typeRampPlus4FontSize = create$1("type-ramp-plus-4-font-size").withDefault("34px");
/** @public */

const typeRampPlus4LineHeight = create$1("type-ramp-plus-4-line-height").withDefault("44px");
/** @public */

const typeRampPlus5FontSize = create$1("type-ramp-plus-5-font-size").withDefault("46px");
/** @public */

const typeRampPlus5LineHeight = create$1("type-ramp-plus-5-line-height").withDefault("56px");
/** @public */

const typeRampPlus6FontSize = create$1("type-ramp-plus-6-font-size").withDefault("60px");
/** @public */

const typeRampPlus6LineHeight = create$1("type-ramp-plus-6-line-height").withDefault("72px"); // Color recipe values

/** @public */

const accentFillRestDelta = create$1("accent-fill-rest-delta").withDefault(0);
/** @public */

const accentFillHoverDelta = create$1("accent-fill-hover-delta").withDefault(4);
/** @public */

const accentFillActiveDelta = create$1("accent-fill-active-delta").withDefault(-5);
/** @public */

const accentFillFocusDelta = create$1("accent-fill-focus-delta").withDefault(0);
/** @public */

const accentForegroundRestDelta = create$1("accent-foreground-rest-delta").withDefault(0);
/** @public */

const accentForegroundHoverDelta = create$1("accent-foreground-hover-delta").withDefault(6);
/** @public */

const accentForegroundActiveDelta = create$1("accent-foreground-active-delta").withDefault(-4);
/** @public */

const accentForegroundFocusDelta = create$1("accent-foreground-focus-delta").withDefault(0);
/** @public */

const neutralFillRestDelta = create$1("neutral-fill-rest-delta").withDefault(7);
/** @public */

const neutralFillHoverDelta = create$1("neutral-fill-hover-delta").withDefault(10);
/** @public */

const neutralFillActiveDelta = create$1("neutral-fill-active-delta").withDefault(5);
/** @public */

const neutralFillFocusDelta = create$1("neutral-fill-focus-delta").withDefault(0);
/** @public */

const neutralFillInputRestDelta = create$1("neutral-fill-input-rest-delta").withDefault(0);
/** @public */

const neutralFillInputHoverDelta = create$1("neutral-fill-input-hover-delta").withDefault(0);
/** @public */

const neutralFillInputActiveDelta = create$1("neutral-fill-input-active-delta").withDefault(0);
/** @public */

const neutralFillInputFocusDelta = create$1("neutral-fill-input-focus-delta").withDefault(0);
/** @public */

const neutralFillStealthRestDelta = create$1("neutral-fill-stealth-rest-delta").withDefault(0);
/** @public */

const neutralFillStealthHoverDelta = create$1("neutral-fill-stealth-hover-delta").withDefault(5);
/** @public */

const neutralFillStealthActiveDelta = create$1("neutral-fill-stealth-active-delta").withDefault(3);
/** @public */

const neutralFillStealthFocusDelta = create$1("neutral-fill-stealth-focus-delta").withDefault(0);
/** @public */

const neutralFillStrongRestDelta = create$1("neutral-fill-strong-rest-delta").withDefault(0);
/** @public */

const neutralFillStrongHoverDelta = create$1("neutral-fill-strong-hover-delta").withDefault(8);
/** @public */

const neutralFillStrongActiveDelta = create$1("neutral-fill-strong-active-delta").withDefault(-5);
/** @public */

const neutralFillStrongFocusDelta = create$1("neutral-fill-strong-focus-delta").withDefault(0);
/** @public */

const neutralFillLayerRestDelta = create$1("neutral-fill-layer-rest-delta").withDefault(3);
/** @public */

const neutralStrokeRestDelta = create$1("neutral-stroke-rest-delta").withDefault(25);
/** @public */

const neutralStrokeHoverDelta = create$1("neutral-stroke-hover-delta").withDefault(40);
/** @public */

const neutralStrokeActiveDelta = create$1("neutral-stroke-active-delta").withDefault(16);
/** @public */

const neutralStrokeFocusDelta = create$1("neutral-stroke-focus-delta").withDefault(25);
/** @public */

const neutralStrokeDividerRestDelta = create$1("neutral-stroke-divider-rest-delta").withDefault(8); // Color recipes

/** @public */

const neutralPalette = create$1({
  name: "neutral-palette",
  cssCustomPropertyName: null
}).withDefault(PaletteRGB.create(middleGrey));
/** @public */

const accentPalette = create$1({
  name: "accent-palette",
  cssCustomPropertyName: null
}).withDefault(PaletteRGB.create(accentBase));
/** @public */

const fillColor = create$1("fill-color").withDefault(element => {
  const palette = neutralPalette.getValueFor(element);
  return palette.get(palette.swatches.length - 5);
});
var ContrastTarget;

(function (ContrastTarget) {
  ContrastTarget[ContrastTarget["normal"] = 4.5] = "normal";
  ContrastTarget[ContrastTarget["large"] = 7] = "large";
})(ContrastTarget || (ContrastTarget = {})); // Accent Fill

/** @public */


const accentFillRecipe = create$1({
  name: "accent-fill-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => accentFill(accentPalette.getValueFor(element), neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), accentFillHoverDelta.getValueFor(element), accentFillActiveDelta.getValueFor(element), accentFillFocusDelta.getValueFor(element), neutralFillRestDelta.getValueFor(element), neutralFillHoverDelta.getValueFor(element), neutralFillActiveDelta.getValueFor(element))
});
/** @public */

const accentFillRest = create$1("accent-fill-rest").withDefault(element => {
  return accentFillRecipe.getValueFor(element).evaluate(element).rest;
});
/** @public */

const accentFillHover = create$1("accent-fill-hover").withDefault(element => {
  return accentFillRecipe.getValueFor(element).evaluate(element).hover;
});
/** @public */

const accentFillActive = create$1("accent-fill-active").withDefault(element => {
  return accentFillRecipe.getValueFor(element).evaluate(element).active;
});
/** @public */

const accentFillFocus = create$1("accent-fill-focus").withDefault(element => {
  return accentFillRecipe.getValueFor(element).evaluate(element).focus;
}); // Foreground On Accent

const foregroundOnAccentByContrast = contrast => (element, reference) => {
  return foregroundOnAccent(reference || accentFillRest.getValueFor(element), contrast);
};
/** @public */


const foregroundOnAccentRecipe = create$1({
  name: "foreground-on-accent-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => foregroundOnAccentByContrast(ContrastTarget.normal)(element, reference)
});
/** @public */

const foregroundOnAccentRest = create$1("foreground-on-accent-rest").withDefault(element => foregroundOnAccentRecipe.getValueFor(element).evaluate(element, accentFillRest.getValueFor(element)));
/** @public */

const foregroundOnAccentHover = create$1("foreground-on-accent-hover").withDefault(element => foregroundOnAccentRecipe.getValueFor(element).evaluate(element, accentFillHover.getValueFor(element)));
/** @public */

const foregroundOnAccentActive = create$1("foreground-on-accent-active").withDefault(element => foregroundOnAccentRecipe.getValueFor(element).evaluate(element, accentFillActive.getValueFor(element)));
/** @public */

const foregroundOnAccentFocus = create$1("foreground-on-accent-focus").withDefault(element => foregroundOnAccentRecipe.getValueFor(element).evaluate(element, accentFillFocus.getValueFor(element)));
/** @public */

const foregroundOnAccentLargeRecipe = create$1({
  name: "foreground-on-accent-large-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => foregroundOnAccentByContrast(ContrastTarget.large)(element, reference)
});
/** @public */

const foregroundOnAccentRestLarge = create$1("foreground-on-accent-rest-large").withDefault(element => foregroundOnAccentLargeRecipe.getValueFor(element).evaluate(element, accentFillRest.getValueFor(element)));
/** @public */

const foregroundOnAccentHoverLarge = create$1("foreground-on-accent-hover-large").withDefault(element => foregroundOnAccentLargeRecipe.getValueFor(element).evaluate(element, accentFillHover.getValueFor(element)));
/** @public */

const foregroundOnAccentActiveLarge = create$1("foreground-on-accent-active-large").withDefault(element => foregroundOnAccentLargeRecipe.getValueFor(element).evaluate(element, accentFillActive.getValueFor(element)));
/** @public */

const foregroundOnAccentFocusLarge = create$1("foreground-on-accent-focus-large").withDefault(element => foregroundOnAccentLargeRecipe.getValueFor(element).evaluate(element, accentFillFocus.getValueFor(element))); // Accent Foreground

const accentForegroundByContrast = contrast => (element, reference) => accentForeground(accentPalette.getValueFor(element), reference || fillColor.getValueFor(element), contrast, accentForegroundRestDelta.getValueFor(element), accentForegroundHoverDelta.getValueFor(element), accentForegroundActiveDelta.getValueFor(element), accentForegroundFocusDelta.getValueFor(element));
/** @public */


const accentForegroundRecipe = create$1({
  name: "accent-foreground-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => accentForegroundByContrast(ContrastTarget.normal)(element, reference)
});
/** @public */

const accentForegroundRest = create$1("accent-foreground-rest").withDefault(element => accentForegroundRecipe.getValueFor(element).evaluate(element).rest);
/** @public */

const accentForegroundHover = create$1("accent-foreground-hover").withDefault(element => accentForegroundRecipe.getValueFor(element).evaluate(element).hover);
/** @public */

const accentForegroundActive = create$1("accent-foreground-active").withDefault(element => accentForegroundRecipe.getValueFor(element).evaluate(element).active);
/** @public */

const accentForegroundFocus = create$1("accent-foreground-focus").withDefault(element => accentForegroundRecipe.getValueFor(element).evaluate(element).focus); // Neutral Fill

/** @public */

const neutralFillRecipe = create$1({
  name: "neutral-fill-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => neutralFill(neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), neutralFillRestDelta.getValueFor(element), neutralFillHoverDelta.getValueFor(element), neutralFillActiveDelta.getValueFor(element), neutralFillFocusDelta.getValueFor(element))
});
/** @public */

const neutralFillRest = create$1("neutral-fill-rest").withDefault(element => neutralFillRecipe.getValueFor(element).evaluate(element).rest);
/** @public */

const neutralFillHover = create$1("neutral-fill-hover").withDefault(element => neutralFillRecipe.getValueFor(element).evaluate(element).hover);
/** @public */

const neutralFillActive = create$1("neutral-fill-active").withDefault(element => neutralFillRecipe.getValueFor(element).evaluate(element).active);
/** @public */

const neutralFillFocus = create$1("neutral-fill-focus").withDefault(element => neutralFillRecipe.getValueFor(element).evaluate(element).focus); // Neutral Fill Input

/** @public */

const neutralFillInputRecipe = create$1({
  name: "neutral-fill-input-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => neutralFillInput(neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), neutralFillInputRestDelta.getValueFor(element), neutralFillInputHoverDelta.getValueFor(element), neutralFillInputActiveDelta.getValueFor(element), neutralFillInputFocusDelta.getValueFor(element))
});
/** @public */

const neutralFillInputRest = create$1("neutral-fill-input-rest").withDefault(element => neutralFillInputRecipe.getValueFor(element).evaluate(element).rest);
/** @public */

const neutralFillInputHover = create$1("neutral-fill-input-hover").withDefault(element => neutralFillInputRecipe.getValueFor(element).evaluate(element).hover);
/** @public */

const neutralFillInputActive = create$1("neutral-fill-input-active").withDefault(element => neutralFillInputRecipe.getValueFor(element).evaluate(element).active);
/** @public */

const neutralFillInputFocus = create$1("neutral-fill-input-focus").withDefault(element => neutralFillInputRecipe.getValueFor(element).evaluate(element).focus); // Neutral Fill Stealth

/** @public */

const neutralFillStealthRecipe = create$1({
  name: "neutral-fill-stealth-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => neutralFillStealth(neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), neutralFillStealthRestDelta.getValueFor(element), neutralFillStealthHoverDelta.getValueFor(element), neutralFillStealthActiveDelta.getValueFor(element), neutralFillStealthFocusDelta.getValueFor(element), neutralFillRestDelta.getValueFor(element), neutralFillHoverDelta.getValueFor(element), neutralFillActiveDelta.getValueFor(element), neutralFillFocusDelta.getValueFor(element))
});
/** @public */

const neutralFillStealthRest = create$1("neutral-fill-stealth-rest").withDefault(element => neutralFillStealthRecipe.getValueFor(element).evaluate(element).rest);
/** @public */

const neutralFillStealthHover = create$1("neutral-fill-stealth-hover").withDefault(element => neutralFillStealthRecipe.getValueFor(element).evaluate(element).hover);
/** @public */

const neutralFillStealthActive = create$1("neutral-fill-stealth-active").withDefault(element => neutralFillStealthRecipe.getValueFor(element).evaluate(element).active);
/** @public */

const neutralFillStealthFocus = create$1("neutral-fill-stealth-focus").withDefault(element => neutralFillStealthRecipe.getValueFor(element).evaluate(element).focus); // Neutral Fill Strong

/** @public */

const neutralFillStrongRecipe = create$1({
  name: "neutral-fill-strong-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => neutralFillContrast(neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), neutralFillStrongRestDelta.getValueFor(element), neutralFillStrongHoverDelta.getValueFor(element), neutralFillStrongActiveDelta.getValueFor(element), neutralFillStrongFocusDelta.getValueFor(element))
});
/** @public */

const neutralFillStrongRest = create$1("neutral-fill-strong-rest").withDefault(element => neutralFillStrongRecipe.getValueFor(element).evaluate(element).rest);
/** @public */

const neutralFillStrongHover = create$1("neutral-fill-strong-hover").withDefault(element => neutralFillStrongRecipe.getValueFor(element).evaluate(element).hover);
/** @public */

const neutralFillStrongActive = create$1("neutral-fill-strong-active").withDefault(element => neutralFillStrongRecipe.getValueFor(element).evaluate(element).active);
/** @public */

const neutralFillStrongFocus = create$1("neutral-fill-strong-focus").withDefault(element => neutralFillStrongRecipe.getValueFor(element).evaluate(element).focus); // Neutral Fill Layer

/** @public */

const neutralFillLayerRecipe = create$1({
  name: "neutral-fill-layer-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => neutralFillLayer(neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), neutralFillLayerRestDelta.getValueFor(element))
});
/** @public */

const neutralFillLayerRest = create$1("neutral-fill-layer-rest").withDefault(element => neutralFillLayerRecipe.getValueFor(element).evaluate(element)); // Focus Stroke Outer

/** @public */

const focusStrokeOuterRecipe = create$1({
  name: "focus-stroke-outer-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => focusStrokeOuter(neutralPalette.getValueFor(element), fillColor.getValueFor(element))
});
/** @public */

const focusStrokeOuter$1 = create$1("focus-stroke-outer").withDefault(element => focusStrokeOuterRecipe.getValueFor(element).evaluate(element)); // Focus Stroke Inner

/** @public */

const focusStrokeInnerRecipe = create$1({
  name: "focus-stroke-inner-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => focusStrokeInner(accentPalette.getValueFor(element), fillColor.getValueFor(element), focusStrokeOuter$1.getValueFor(element))
});
/** @public */

const focusStrokeInner$1 = create$1("focus-stroke-inner").withDefault(element => focusStrokeInnerRecipe.getValueFor(element).evaluate(element)); // Neutral Foreground Hint

/** @public */

const neutralForegroundHintRecipe = create$1({
  name: "neutral-foreground-hint-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralForegroundHint(neutralPalette.getValueFor(element), fillColor.getValueFor(element))
});
/** @public */

const neutralForegroundHint$1 = create$1("neutral-foreground-hint").withDefault(element => neutralForegroundHintRecipe.getValueFor(element).evaluate(element)); // Neutral Foreground

/** @public */

const neutralForegroundRecipe = create$1({
  name: "neutral-foreground-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralForeground(neutralPalette.getValueFor(element), fillColor.getValueFor(element))
});
/** @public */

const neutralForegroundRest = create$1("neutral-foreground-rest").withDefault(element => neutralForegroundRecipe.getValueFor(element).evaluate(element)); // Neutral Stroke

/** @public */

const neutralStrokeRecipe = create$1({
  name: "neutral-stroke-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => {
    return neutralStroke(neutralPalette.getValueFor(element), fillColor.getValueFor(element), neutralStrokeRestDelta.getValueFor(element), neutralStrokeHoverDelta.getValueFor(element), neutralStrokeActiveDelta.getValueFor(element), neutralStrokeFocusDelta.getValueFor(element));
  }
});
/** @public */

const neutralStrokeRest = create$1("neutral-stroke-rest").withDefault(element => neutralStrokeRecipe.getValueFor(element).evaluate(element).rest);
/** @public */

const neutralStrokeHover = create$1("neutral-stroke-hover").withDefault(element => neutralStrokeRecipe.getValueFor(element).evaluate(element).hover);
/** @public */

const neutralStrokeActive = create$1("neutral-stroke-active").withDefault(element => neutralStrokeRecipe.getValueFor(element).evaluate(element).active);
/** @public */

const neutralStrokeFocus = create$1("neutral-stroke-focus").withDefault(element => neutralStrokeRecipe.getValueFor(element).evaluate(element).focus); // Neutral Stroke Divider

/** @public */

const neutralStrokeDividerRecipe = create$1({
  name: "neutral-stroke-divider-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: (element, reference) => neutralStrokeDivider(neutralPalette.getValueFor(element), reference || fillColor.getValueFor(element), neutralStrokeDividerRestDelta.getValueFor(element))
});
/** @public */

const neutralStrokeDividerRest = create$1("neutral-stroke-divider-rest").withDefault(element => neutralStrokeDividerRecipe.getValueFor(element).evaluate(element)); // Neutral Layer Card Container

/** @public */

const neutralLayerCardContainerRecipe = create$1({
  name: "neutral-layer-card-container-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralLayerCardContainer(neutralPalette.getValueFor(element), baseLayerLuminance.getValueFor(element), neutralFillLayerRestDelta.getValueFor(element))
});
/** @public */

const neutralLayerCardContainer$1 = create$1("neutral-layer-card-container").withDefault(element => neutralLayerCardContainerRecipe.getValueFor(element).evaluate(element)); // Neutral Layer Floating

/** @public */

const neutralLayerFloatingRecipe = create$1({
  name: "neutral-layer-floating-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralLayerFloating(neutralPalette.getValueFor(element), baseLayerLuminance.getValueFor(element), neutralFillLayerRestDelta.getValueFor(element))
});
/** @public */

const neutralLayerFloating$1 = create$1("neutral-layer-floating").withDefault(element => neutralLayerFloatingRecipe.getValueFor(element).evaluate(element)); // Neutral Layer 1

/** @public */

const neutralLayer1Recipe = create$1({
  name: "neutral-layer-1-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralLayer1(neutralPalette.getValueFor(element), baseLayerLuminance.getValueFor(element))
});
/** @public */

const neutralLayer1$1 = create$1("neutral-layer-1").withDefault(element => neutralLayer1Recipe.getValueFor(element).evaluate(element)); // Neutral Layer 2

/** @public */

const neutralLayer2Recipe = create$1({
  name: "neutral-layer-2-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralLayer2(neutralPalette.getValueFor(element), baseLayerLuminance.getValueFor(element), neutralFillLayerRestDelta.getValueFor(element), neutralFillRestDelta.getValueFor(element), neutralFillHoverDelta.getValueFor(element), neutralFillActiveDelta.getValueFor(element))
});
/** @public */

const neutralLayer2$1 = create$1("neutral-layer-2").withDefault(element => neutralLayer2Recipe.getValueFor(element).evaluate(element)); // Neutral Layer 3

/** @public */

const neutralLayer3Recipe = create$1({
  name: "neutral-layer-3-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralLayer3(neutralPalette.getValueFor(element), baseLayerLuminance.getValueFor(element), neutralFillLayerRestDelta.getValueFor(element), neutralFillRestDelta.getValueFor(element), neutralFillHoverDelta.getValueFor(element), neutralFillActiveDelta.getValueFor(element))
});
/** @public */

const neutralLayer3$1 = create$1("neutral-layer-3").withDefault(element => neutralLayer3Recipe.getValueFor(element).evaluate(element)); // Neutral Layer 4

/** @public */

const neutralLayer4Recipe = create$1({
  name: "neutral-layer-4-recipe",
  cssCustomPropertyName: null
}).withDefault({
  evaluate: element => neutralLayer4(neutralPalette.getValueFor(element), baseLayerLuminance.getValueFor(element), neutralFillLayerRestDelta.getValueFor(element), neutralFillRestDelta.getValueFor(element), neutralFillHoverDelta.getValueFor(element), neutralFillActiveDelta.getValueFor(element))
});
/** @public */

const neutralLayer4$1 = create$1("neutral-layer-4").withDefault(element => neutralLayer4Recipe.getValueFor(element).evaluate(element));

const accordionStyles = (context, definition) => css` ${display("flex")} :host{box-sizing: border-box;flex-direction: column;font-family: ${bodyFont};font-size: ${typeRampMinus1FontSize};line-height: ${typeRampMinus1LineHeight};color: ${neutralForegroundRest};border-top: calc(${strokeWidth} * 1px) solid ${neutralStrokeDividerRest}}`;

/**
 * A formula to retrieve the control height.
 * Use this as the value of any CSS property that
 * accepts a pixel size.
 */

const heightNumber = cssPartial`(${baseHeightMultiplier} + ${density}) * ${designUnit}`;

const accordionItemStyles = (context, definition) => css` ${display("flex")} :host{box-sizing: border-box;font-family: ${bodyFont};flex-direction: column;font-size: ${typeRampMinus1FontSize};line-height: ${typeRampMinus1LineHeight};border-bottom: calc(${strokeWidth} * 1px) solid ${neutralStrokeDividerRest}}.region{display: none;padding: calc((6 + (${designUnit} * 2 * ${density})) * 1px)}.heading{display: grid;position: relative;grid-template-columns: auto 1fr auto calc(${heightNumber} * 1px);z-index: 2}.button{appearance: none;border: none;background: none;grid-column: 2;grid-row: 1;outline: none;padding: 0 calc((6 + (${designUnit} * 2 * ${density})) * 1px);text-align: left;height: calc(${heightNumber} * 1px);color: ${neutralForegroundRest};cursor: pointer;font-family: inherit}.button:hover{color: ${neutralForegroundRest}}.button:active{color: ${neutralForegroundRest}}.button::before{content: "";position: absolute;top: 0;left: 0;right: 0;bottom: 0;z-index: 1;cursor: pointer}.button:${focusVisible}::before{outline: none;border: calc(${focusStrokeWidth} * 1px) solid ${focusStrokeOuter$1};border-radius: calc(${controlCornerRadius} * 1px)}:host([expanded]) .region{display: block}.icon{display: flex;align-items: center;justify-content: center;grid-column: 4;z-index: 2;pointer-events: none}slot[name="expanded-icon"], slot[name="collapsed-icon"]{fill: ${accentFillRest}}slot[name="collapsed-icon"]{display: flex}:host([expanded]) slot[name="collapsed-icon"]{display: none}slot[name="expanded-icon"]{display: none}:host([expanded]) slot[name="expanded-icon"]{display: flex}.start{display: flex;align-items: center;padding-inline-start: calc(${designUnit} * 1px);justify-content: center;grid-column: 1;z-index: 2}.end{display: flex;align-items: center;justify-content: center;grid-column: 3;z-index: 2}`.withBehaviors(forcedColorsStylesheetBehavior(css` .button:${focusVisible}::before{border-color: ${SystemColors.Highlight}}:host slot[name="collapsed-icon"], :host([expanded]) slot[name="expanded-icon"]{fill: ${SystemColors.ButtonText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#AccordionItem} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#accordionItemTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-accordion-item\>
 */

const fastAccordionItem = AccordionItem.compose({
  baseName: "accordion-item",
  template: accordionItemTemplate,
  styles: accordionItemStyles,
  collapsedIcon: `
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M16.22 3H3.78a.78.78 0 00-.78.78v12.44c0 .43.35.78.78.78h12.44c.43 0 .78-.35.78-.78V3.78a.78.78 0 00-.78-.78zM3.78 2h12.44C17.2 2 18 2.8 18 3.78v12.44c0 .98-.8 1.78-1.78 1.78H3.78C2.8 18 2 17.2 2 16.22V3.78C2 2.8 2.8 2 3.78 2zM11 9h3v2h-3v3H9v-3H6V9h3V6h2v3z"
            />
        </svg>
    `,
  expandedIcon: `
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M3.78 3h12.44c.43 0 .78.35.78.78v12.44c0 .43-.35.78-.78.78H3.78a.78.78 0 01-.78-.78V3.78c0-.43.35-.78.78-.78zm12.44-1H3.78C2.8 2 2 2.8 2 3.78v12.44C2 17.2 2.8 18 3.78 18h12.44c.98 0 1.78-.8 1.78-1.78V3.78C18 2.8 17.2 2 16.22 2zM14 9H6v2h8V9z"
            />
        </svg>
    `
});
/**
 * Styles for AccordionItem
 * @public
 */

const accordionItemStyles$1 = accordionItemStyles;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Accordion} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#accordionTemplate}
 *
 *
 * @public
 * @remarks
 * Generates the HTML Element: \<fast-accordion\>
 */

const fastAccordion = Accordion.compose({
  baseName: "accordion",
  template: accordionTemplate,
  styles: accordionStyles
});
/**
 * Styles for Accordion
 * @public
 */

const accordionStyles$1 = accordionStyles;

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
function __decorate$1(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/**
 * Define shadow algorithms.
 *
 * TODO: The --background-luminance will need to be derived from JavaScript. For now
 * this is hard-coded to a 1, the relative luminance of pure white.
 * https://github.com/microsoft/fast/issues/2778
 *
 * @internal
 */
const ambientShadow = "0 0 calc((var(--elevation) * 0.225px) + 2px) rgba(0, 0, 0, calc(.11 * (2 - var(--background-luminance, 1))))";
/**
 * @internal
 */

const directionalShadow = "0 calc(var(--elevation) * 0.4px) calc((var(--elevation) * 0.9px)) rgba(0, 0, 0, calc(.13 * (2 - var(--background-luminance, 1))))";
/**
 * Applies the box-shadow CSS rule set to the elevation formula.
 * Control this formula with the --elevation CSS Custom Property
 * by setting --elevation to a number.
 */

const elevation = `box-shadow: ${ambientShadow}, ${directionalShadow};`;

/**
 * @internal
 */

const BaseButtonStyles = css` ${display("inline-flex")} :host{font-family: ${bodyFont};outline: none;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};height: calc(${heightNumber} * 1px);min-width: calc(${heightNumber} * 1px);background-color: ${neutralFillRest};color: ${neutralForegroundRest};border-radius: calc(${controlCornerRadius} * 1px);fill: currentcolor;cursor: pointer}.control{background: transparent;height: inherit;flex-grow: 1;box-sizing: border-box;display: inline-flex;justify-content: center;align-items: center;padding: 0 calc((10 + (${designUnit} * 2 * ${density})) * 1px);white-space: nowrap;outline: none;text-decoration: none;border: calc(${strokeWidth} * 1px) solid transparent;color: inherit;border-radius: inherit;fill: inherit;cursor: inherit;font-family: inherit;font-size: inherit;line-height: inherit}:host(:hover){background-color: ${neutralFillHover}}:host(:active){background-color: ${neutralFillActive}}.control:${focusVisible}{border-color: ${focusStrokeOuter$1};box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${focusStrokeOuter$1} inset}.control::-moz-focus-inner{border: 0}.start, .end{display: flex}.control.icon-only{padding: 0;line-height: 0}::slotted(svg){${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px;pointer-events: none}.start{margin-inline-end: 11px}.end{margin-inline-start: 11px}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host .control{background-color: ${SystemColors.ButtonFace};border-color: ${SystemColors.ButtonText};color: ${SystemColors.ButtonText};fill: currentColor}:host(:hover) .control{forced-color-adjust: none;background-color: ${SystemColors.Highlight};color: ${SystemColors.HighlightText}}.control:${focusVisible}{forced-color-adjust: none;background-color: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${SystemColors.ButtonText} inset;color: ${SystemColors.HighlightText}}.control:hover, :host([appearance="outline"]) .control:hover{border-color: ${SystemColors.ButtonText}}:host([href]) .control{border-color: ${SystemColors.LinkText};color: ${SystemColors.LinkText}}:host([href]) .control:hover, :host([href]) .control:${focusVisible}{forced-color-adjust: none;background: ${SystemColors.ButtonFace};border-color: ${SystemColors.LinkText};box-shadow: 0 0 0 1px ${SystemColors.LinkText} inset;color: ${SystemColors.LinkText};fill: currentColor}`));
/**
 * @internal
 */

const AccentButtonStyles = css` :host([appearance="accent"]){background: ${accentFillRest};color: ${foregroundOnAccentRest}}:host([appearance="accent"]:hover){background: ${accentFillHover};color: ${foregroundOnAccentHover}}:host([appearance="accent"]:active) .control:active{background: ${accentFillActive};color: ${foregroundOnAccentActive}}:host([appearance="accent"]) .control:${focusVisible}{box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${focusStrokeOuter$1} inset, 0 0 0 calc((${focusStrokeWidth} + ${strokeWidth}) * 1px) ${focusStrokeInner$1} inset}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="accent"]) .control{forced-color-adjust: none;background: ${SystemColors.Highlight};color: ${SystemColors.HighlightText}}:host([appearance="accent"]) .control:hover, :host([appearance="accent"]:active) .control:active{background: ${SystemColors.HighlightText};border-color: ${SystemColors.Highlight};color: ${SystemColors.Highlight}}:host([appearance="accent"]) .control:${focusVisible}{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) ${SystemColors.HighlightText} inset}:host([appearance="accent"][href]) .control{background: ${SystemColors.LinkText};color: ${SystemColors.HighlightText}}:host([appearance="accent"][href]) .control:hover{background: ${SystemColors.ButtonFace};border-color: ${SystemColors.LinkText};box-shadow: none;color: ${SystemColors.LinkText};fill: currentColor}:host([appearance="accent"][href]) .control:${focusVisible}{border-color: ${SystemColors.LinkText};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) ${SystemColors.HighlightText} inset}`));
/**
 * @internal
 */

const HypertextStyles = css` :host([appearance="hypertext"]){font-size: inherit;line-height: inherit;height: auto;min-width: 0;background: transparent}:host([appearance="hypertext"]) .control{display: inline;padding: 0;border: none;box-shadow: none;border-radius: 0;line-height: 1}:host a.control:not(:link){background-color: transparent;cursor: default}:host([appearance="hypertext"]) .control:link, :host([appearance="hypertext"]) .control:visited{background: transparent;color: ${accentForegroundRest};border-bottom: calc(${strokeWidth} * 1px) solid ${accentForegroundRest}}:host([appearance="hypertext"]:hover), :host([appearance="hypertext"]) .control:hover{background: transparent;border-bottom-color: ${accentForegroundHover}}:host([appearance="hypertext"]:active), :host([appearance="hypertext"]) .control:active{background: transparent;border-bottom-color: ${accentForegroundActive}}:host([appearance="hypertext"]) .control:${focusVisible}{border-bottom: calc(${focusStrokeWidth} * 1px) solid ${focusStrokeOuter$1};margin-bottom: calc(calc(${strokeWidth} - ${focusStrokeWidth}) * 1px)}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="hypertext"]:hover){background-color: ${SystemColors.ButtonFace};color: ${SystemColors.ButtonText}}:host([appearance="hypertext"][href]) .control:hover, :host([appearance="hypertext"][href]) .control:active, :host([appearance="hypertext"][href]) .control:${focusVisible}{color: ${SystemColors.LinkText};border-bottom-color: ${SystemColors.LinkText};box-shadow: none}`));
/**
 * @internal
 */

const LightweightButtonStyles = css` :host([appearance="lightweight"]){background: transparent;color: ${accentForegroundRest}}:host([appearance="lightweight"]) .control{padding: 0;height: initial;border: none;box-shadow: none;border-radius: 0}:host([appearance="lightweight"]:hover){background: transparent;color: ${accentForegroundHover}}:host([appearance="lightweight"]:active){background: transparent;color: ${accentForegroundActive}}:host([appearance="lightweight"]) .content{position: relative}:host([appearance="lightweight"]) .content::before{content: "";display: block;height: calc(${strokeWidth} * 1px);position: absolute;top: calc(1em + 4px);width: 100%}:host([appearance="lightweight"]:hover) .content::before{background: ${accentForegroundHover}}:host([appearance="lightweight"]:active) .content::before{background: ${accentForegroundActive}}:host([appearance="lightweight"]) .control:${focusVisible} .content::before{background: ${neutralForegroundRest};height: calc(${focusStrokeWidth} * 1px)}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="lightweight"]) .control:hover, :host([appearance="lightweight"]) .control:${focusVisible}{forced-color-adjust: none;background: ${SystemColors.ButtonFace};color: ${SystemColors.Highlight}}:host([appearance="lightweight"]) .control:hover .content::before, :host([appearance="lightweight"]) .control:${focusVisible} .content::before{background: ${SystemColors.Highlight}}:host([appearance="lightweight"][href]) .control:hover, :host([appearance="lightweight"][href]) .control:${focusVisible}{background: ${SystemColors.ButtonFace};box-shadow: none;color: ${SystemColors.LinkText}}:host([appearance="lightweight"][href]) .control:hover .content::before, :host([appearance="lightweight"][href]) .control:${focusVisible} .content::before{background: ${SystemColors.LinkText}}`));
/**
 * @internal
 */

const OutlineButtonStyles = css` :host([appearance="outline"]){background: transparent;border-color: ${accentFillRest}}:host([appearance="outline"]:hover){border-color: ${accentFillHover}}:host([appearance="outline"]:active){border-color: ${accentFillActive}}:host([appearance="outline"]) .control{border-color: inherit}:host([appearance="outline"]) .control:${focusVisible}{box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${focusStrokeOuter$1} inset;border-color: ${focusStrokeOuter$1}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="outline"]) .control{border-color: ${SystemColors.ButtonText}}:host([appearance="outline"]) .control:${focusVisible}{forced-color-adjust: none;background-color: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${SystemColors.ButtonText} inset;color: ${SystemColors.HighlightText};fill: currentColor}:host([appearance="outline"][href]) .control{background: ${SystemColors.ButtonFace};border-color: ${SystemColors.LinkText};color: ${SystemColors.LinkText};fill: currentColor}:host([appearance="outline"][href]) .control:hover, :host([appearance="outline"][href]) .control:${focusVisible}{forced-color-adjust: none;border-color: ${SystemColors.LinkText};box-shadow: 0 0 0 1px ${SystemColors.LinkText} inset}`));
/**
 * @internal
 */

const StealthButtonStyles = css` :host([appearance="stealth"]){background: ${neutralFillStealthRest}}:host([appearance="stealth"]:hover){background: ${neutralFillStealthHover}}:host([appearance="stealth"]:active){background: ${neutralFillStealthActive}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="stealth"]), :host([appearance="stealth"]) .control{forced-color-adjust: none;background: ${SystemColors.ButtonFace};border-color: transparent;color: ${SystemColors.ButtonText};fill: currentColor}:host([appearance="stealth"]:hover) .control{background: ${SystemColors.Highlight};border-color: ${SystemColors.Highlight};color: ${SystemColors.HighlightText};fill: currentColor}:host([appearance="stealth"]:${focusVisible}) .control{background: ${SystemColors.Highlight};box-shadow: 0 0 0 1px ${SystemColors.Highlight};color: ${SystemColors.HighlightText};fill: currentColor}:host([appearance="stealth"][href]) .control{color: ${SystemColors.LinkText}}:host([appearance="stealth"][href]:hover) .control, :host([appearance="stealth"][href]:${focusVisible}) .control{background: ${SystemColors.LinkText};border-color: ${SystemColors.LinkText};color: ${SystemColors.HighlightText};fill: currentColor}:host([appearance="stealth"][href]:${focusVisible}) .control{forced-color-adjust: none;box-shadow: 0 0 0 1px ${SystemColors.LinkText}}`));

/**
 * Behavior to conditionally apply LTR and RTL stylesheets. To determine which to apply,
 * the behavior will use the nearest DesignSystemProvider's 'direction' design system value.
 *
 * @public
 * @example
 * ```ts
 * import { css } from "@microsoft/fast-element";
 * import { DirectionalStyleSheetBehavior } from "@microsoft/fast-foundation";
 *
 * css`
 *  // ...
 * `.withBehaviors(new DirectionalStyleSheetBehavior(
 *   css`:host { content: "ltr"}`),
 *   css`:host { content: "rtl"}`),
 * )
 * ```
 */

class DirectionalStyleSheetBehavior {
  constructor(ltr, rtl) {
    this.cache = new WeakMap();
    this.ltr = ltr;
    this.rtl = rtl;
  }
  /**
   * @internal
   */


  bind(source) {
    this.attach(source);
  }
  /**
   * @internal
   */


  unbind(source) {
    const cache = this.cache.get(source);

    if (cache) {
      direction.unsubscribe(cache);
    }
  }

  attach(source) {
    const subscriber = this.cache.get(source) || new DirectionalStyleSheetBehaviorSubscription(this.ltr, this.rtl, source);
    const value = direction.getValueFor(source);
    direction.subscribe(subscriber);
    subscriber.attach(value);
    this.cache.set(source, subscriber);
  }

}
/**
 * Subscription for {@link DirectionalStyleSheetBehavior}
 */

class DirectionalStyleSheetBehaviorSubscription {
  constructor(ltr, rtl, source) {
    this.ltr = ltr;
    this.rtl = rtl;
    this.source = source;
    this.attached = null;
  }

  handleChange({
    target,
    token
  }) {
    this.attach(token.getValueFor(target));
  }

  attach(direction) {
    if (this.attached !== this[direction]) {
      if (this.attached !== null) {
        this.source.$fastController.removeStyles(this.attached);
      }

      this.attached = this[direction];

      if (this.attached !== null) {
        this.source.$fastController.addStyles(this.attached);
      }
    }
  }

}

/**
 * Behavior that will conditionally apply a stylesheet based on the elements
 * appearance property
 *
 * @param value - The value of the appearance property
 * @param styles - The styles to be applied when condition matches
 *
 * @public
 */

function appearanceBehavior(value, styles) {
  return new PropertyStyleSheetBehavior("appearance", value, styles);
}

const anchorStyles = (context, definition) => css` ${BaseButtonStyles} `.withBehaviors(appearanceBehavior("accent", AccentButtonStyles), appearanceBehavior("hypertext", HypertextStyles), appearanceBehavior("lightweight", LightweightButtonStyles), appearanceBehavior("outline", OutlineButtonStyles), appearanceBehavior("stealth", StealthButtonStyles));

/**
 * Base class for Anchor
 * @public
 */

class Anchor$1 extends Anchor {
  appearanceChanged(oldValue, newValue) {
    if (oldValue !== newValue) {
      this.classList.add(newValue);
      this.classList.remove(oldValue);
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (!this.appearance) {
      this.appearance = "neutral";
    }
  }
  /**
   * Applies 'icon-only' class when there is only an SVG in the default slot
   *
   * @internal
   *
   */


  defaultSlottedContentChanged(oldValue, newValue) {
    const slottedElements = this.defaultSlottedContent.filter(x => x.nodeType === Node.ELEMENT_NODE);

    if (slottedElements.length === 1 && slottedElements[0] instanceof SVGElement) {
      this.control.classList.add("icon-only");
    } else {
      this.control.classList.remove("icon-only");
    }
  }

}

__decorate$1([attr], Anchor$1.prototype, "appearance", void 0);
/**
 * Styles for Anchor
 * @public
 */


const anchorStyles$1 = anchorStyles;
/**
 * A function that returns a {@link @microsoft/fast-foundation#Anchor} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#anchorTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-anchor\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */

const fastAnchor = Anchor$1.compose({
  baseName: "anchor",
  template: anchorTemplate,
  styles: anchorStyles,
  shadowOptions: {
    delegatesFocus: true
  }
});

const anchoredRegionStyles = (context, definition) => css` :host{contain: layout;display: block}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#AnchoredRegion} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#anchoredRegionTemplate}
 *
 *
 * @beta
 * @remarks
 * Generates HTML Element: \<fast-anchored-region\>
 */

const fastAnchoredRegion = AnchoredRegion.compose({
  baseName: "anchored-region",
  template: anchoredRegionTemplate,
  styles: anchoredRegionStyles
});
/**
 * Styles for AnchoredRegion
 * @public
 */

const anchoredRegionStyles$1 = anchoredRegionStyles;

const rtl = css` ::slotted(fast-badge){left: 0}`;
const ltr = css` ::slotted(fast-badge){right: 0}`;
const avatarStyles = (context, definition) => css` ${display("flex")} :host{position: relative;height: var(--avatar-size, var(--avatar-size-default));max-width: var(--avatar-size, var(--avatar-size-default));--avatar-size-default: calc( ( (${baseHeightMultiplier} + ${density}) * ${designUnit} + ((${designUnit} * 8) - 40) ) * 1px );--avatar-text-size: ${typeRampBaseFontSize};--avatar-text-ratio: ${designUnit}}.link{text-decoration: none;color: ${neutralForegroundRest};display: flex;flex-direction: row;justify-content: center;align-items: center;min-width: 100%}.square{border-radius: calc(${controlCornerRadius} * 1px);min-width: 100%;overflow: hidden}.circle{border-radius: 100%;min-width: 100%;overflow: hidden}.backplate{position: relative;display: flex}.media, ::slotted(img){max-width: 100%;position: absolute;display: block}.content{font-size: calc( (var(--avatar-text-size) + var(--avatar-size, var(--avatar-size-default))) / var(--avatar-text-ratio) );line-height: var(--avatar-size, var(--avatar-size-default));display: block;min-height: var(--avatar-size, var(--avatar-size-default))}::slotted(fast-badge){position: absolute;display: block}`.withBehaviors(new DirectionalStyleSheetBehavior(ltr, rtl));

/**
 * The FAST Avatar Class
 * @public
 *
 */

class Avatar$1 extends Avatar {}

__decorate$1([attr({
  attribute: "src"
})], Avatar$1.prototype, "imgSrc", void 0);

__decorate$1([attr], Avatar$1.prototype, "alt", void 0);
/**
 * The FAST Avatar Template for Images
 *  @public
 *
 */


const imgTemplate = html` ${when(x => x.imgSrc, html`<img src="${x => x.imgSrc}" alt="${x => x.alt}" slot="media" class="media" part="media" />`)} `;
/**
 * A function that returns a {@link @microsoft/fast-foundation#Avatar} registration for configuring the component with a DesignSystem.
 *  {@link @microsoft/fast-foundation#AvatarTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-avatar\>
 */

const fastAvatar = Avatar$1.compose({
  baseName: "avatar",
  template: avatarTemplate,
  styles: avatarStyles,
  media: imgTemplate,
  shadowOptions: {
    delegatesFocus: true
  }
});
/**
 * Styles for Badge
 * @public
 */

const avatarStyles$1 = avatarStyles;

const badgeStyles = (context, definition) => css` ${display("inline-block")} :host{box-sizing: border-box;font-family: ${bodyFont};font-size: ${typeRampMinus1FontSize};line-height: ${typeRampMinus1LineHeight}}.control{border-radius: calc(${controlCornerRadius} * 1px);padding: calc(${designUnit} * 0.5px) calc(${designUnit} * 1px);color: ${accentForegroundRest};font-weight: 600}.control[style]{font-weight: 400}:host([circular]) .control{border-radius: 100px;padding: 0 calc(${designUnit} * 1px);${
/* Need to work with Brian on width and height here */
""} height: calc((${heightNumber} - (${designUnit} * 3)) * 1px);min-width: calc((${heightNumber} - (${designUnit} * 3)) * 1px);display: flex;align-items: center;justify-content: center;box-sizing: border-box}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Badge} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#badgeTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-badge\>
 */

const fastBadge = Badge.compose({
  baseName: "badge",
  template: badgeTemplate,
  styles: badgeStyles
});
/**
 * Styles for Badge
 * @public
 */

const badgeStyles$1 = badgeStyles;

const breadcrumbItemStyles = (context, definition) => css` ${display("inline-flex")} :host{background: transparent;box-sizing: border-box;font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};fill: currentColor;line-height: ${typeRampBaseLineHeight};min-width: calc(${heightNumber} * 1px);outline: none}.listitem{display: flex;align-items: center;width: max-content}.separator{margin: 0 6px}.control{align-items: center;box-sizing: border-box;color: ${accentForegroundRest};cursor: pointer;display: flex;fill: inherit;outline: none;text-decoration: none;white-space: nowrap}.control:hover{color: ${accentForegroundHover}}.control:active{color: ${accentForegroundActive}}.control .content{position: relative}.control .content::before{content: "";display: block;height: calc(${strokeWidth} * 1px);left: 0;position: absolute;right: 0;top: calc(1em + 4px);width: 100%}.control:hover .content::before{background: ${accentForegroundHover}}.control:active .content::before{background: ${accentForegroundActive}}.control:${focusVisible} .content::before{background: ${neutralForegroundRest};height: calc(${focusStrokeWidth} * 1px)}.control:not([href]){color: ${neutralForegroundRest};cursor: default}.control:not([href]) .content::before{background: none}.start, .end{display: flex}::slotted(svg){${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px}.start{margin-inline-end: 6px}.end{margin-inline-start: 6px}`.withBehaviors(forcedColorsStylesheetBehavior(css` .control:hover .content::before, .control:${focusVisible} .content::before{background: ${SystemColors.LinkText}}.start, .end{fill: ${SystemColors.ButtonText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#BreadcrumbItem} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#breadcrumbItemTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-breadcrumb-item\>
 */

const fastBreadcrumbItem = BreadcrumbItem.compose({
  baseName: "breadcrumb-item",
  template: breadcrumbItemTemplate,
  styles: breadcrumbItemStyles,
  separator: "/",
  shadowOptions: {
    delegatesFocus: true
  }
});

const breadcrumbStyles = (context, definition) => css` ${display("inline-block")} :host{box-sizing: border-box;font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight}}.list{display: flex}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Breadcrumb} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#breadcrumbTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-breadcrumb\>
 */

const fastBreadcrumb = Breadcrumb.compose({
  baseName: "breadcrumb",
  template: breadcrumbTemplate,
  styles: breadcrumbStyles
});

const buttonStyles = (context, definition) => css` :host([disabled]), :host([disabled]:hover), :host([disabled]:active){opacity: ${disabledOpacity};background-color: ${neutralFillRest};cursor: ${disabledCursor}}${BaseButtonStyles} `.withBehaviors(forcedColorsStylesheetBehavior(css` :host([disabled]), :host([disabled]) .control, :host([disabled]:hover), :host([disabled]:active){forced-color-adjust: none;background-color: ${SystemColors.ButtonFace};border-color: ${SystemColors.GrayText};color: ${SystemColors.GrayText};cursor: ${disabledCursor};opacity: 1}`), appearanceBehavior("accent", css` :host([appearance="accent"][disabled]), :host([appearance="accent"][disabled]:hover), :host([appearance="accent"][disabled]:active){background: ${accentFillRest}}${AccentButtonStyles} `.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="accent"][disabled]) .control, :host([appearance="accent"][disabled]) .control:hover{background: ${SystemColors.ButtonFace};border-color: ${SystemColors.GrayText};color: ${SystemColors.GrayText}}`))), appearanceBehavior("lightweight", css` :host([appearance="lightweight"][disabled]:hover), :host([appearance="lightweight"][disabled]:active){background-color: transparent;color: ${accentForegroundRest}}:host([appearance="lightweight"][disabled]) .content::before, :host([appearance="lightweight"][disabled]:hover) .content::before, :host([appearance="lightweight"][disabled]:active) .content::before{background: transparent}${LightweightButtonStyles} `.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="lightweight"].disabled) .control{forced-color-adjust: none;color: ${SystemColors.GrayText}}:host([appearance="lightweight"].disabled) .control:hover .content::before{background: none}`))), appearanceBehavior("outline", css` :host([appearance="outline"][disabled]), :host([appearance="outline"][disabled]:hover), :host([appearance="outline"][disabled]:active){background: transparent;border-color: ${accentFillRest}}${OutlineButtonStyles} `.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="outline"][disabled]) .control{border-color: ${SystemColors.GrayText}}`))), appearanceBehavior("stealth", css` :host([appearance="stealth"][disabled]), :host([appearance="stealth"][disabled]:hover), :host([appearance="stealth"][disabled]:active){background: ${neutralFillStealthRest}}${StealthButtonStyles} `.withBehaviors(forcedColorsStylesheetBehavior(css` :host([appearance="stealth"][disabled]){background: ${SystemColors.ButtonFace}}:host([appearance="stealth"][disabled]) .control{background: ${SystemColors.ButtonFace};border-color: transparent;color: ${SystemColors.GrayText}}`))));

/**
 * @internal
 */

class Button$1 extends Button {
  connectedCallback() {
    super.connectedCallback();

    if (!this.appearance) {
      this.appearance = "neutral";
    }
  }
  /**
   * Applies 'icon-only' class when there is only an SVG in the default slot
   *
   * @public
   * @remarks
   */


  defaultSlottedContentChanged(oldValue, newValue) {
    const slottedElements = this.defaultSlottedContent.filter(x => x.nodeType === Node.ELEMENT_NODE);

    /*
    debugger;
    if (slottedElements.length === 1 && slottedElements[0] instanceof SVGElement) {
      this.control.classList.add("icon-only");
    } else {
      this.control.classList.remove("icon-only");
    }
    */
  }

}

__decorate$1([attr], Button$1.prototype, "appearance", void 0);
/**
 * A function that returns a {@link @microsoft/fast-foundation#Button} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#buttonTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-button\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */


const fastButton = Button$1.compose({
  baseName: "button",
  template: buttonTemplate,
  styles: buttonStyles,
  shadowOptions: {
    delegatesFocus: true
  }
});
/**
 * Styles for Button
 * @public
 */

const buttonStyles$1 = buttonStyles;

const cardStyles = (context, definition) => css` ${display("block")} :host{--elevation: 4;display: block;contain: content;height: var(--card-height, 100%);width: var(--card-width, 100%);box-sizing: border-box;background: ${fillColor};border-radius: calc(${controlCornerRadius} * 1px);${elevation}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{forced-color-adjust: none;background: ${SystemColors.Canvas};box-shadow: 0 0 0 1px ${SystemColors.CanvasText}}`));

/**
 * @internal
 */

class Card$1 extends Card {
  connectedCallback() {
    super.connectedCallback();
    const parent = composedParent(this);

    if (parent) {
      fillColor.setValueFor(this, target => neutralFillLayerRecipe.getValueFor(target).evaluate(target, fillColor.getValueFor(parent)));
    }
  }

}
/**
 * A function that returns a {@link @microsoft/fast-foundation#Card} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#CardTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-card\>
 */

const fastCard = Card$1.compose({
  baseName: "card",
  template: cardTemplate,
  styles: cardStyles
});
/**
 * Styles for Card
 * @public
 */

const cardStyles$1 = cardStyles;

const checkboxStyles = (context, definition) => css` ${display("inline-flex")} :host{align-items: center;outline: none;margin: calc(${designUnit} * 1px) 0;${
/*
 * Chromium likes to select label text or the default slot when
 * the checkbox is clicked. Maybe there is a better solution here?
 */
""} user-select: none}.control{position: relative;width: calc((${heightNumber} / 2 + ${designUnit}) * 1px);height: calc((${heightNumber} / 2 + ${designUnit}) * 1px);box-sizing: border-box;border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${neutralStrokeRest};background: ${neutralFillInputRest};outline: none;cursor: pointer}.label{font-family: ${bodyFont};color: ${neutralForegroundRest};${
/* Need to discuss with Brian how HorizontalSpacingNumber can work. https://github.com/microsoft/fast/issues/2766 */
""} padding-inline-start: calc(${designUnit} * 2px + 2px);margin-inline-end: calc(${designUnit} * 2px + 2px);cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight}}.label__hidden{display: none;visibility: hidden}.checked-indicator{width: 100%;height: 100%;display: block;fill: ${foregroundOnAccentRest};opacity: 0;pointer-events: none}.indeterminate-indicator{border-radius: calc(${controlCornerRadius} * 1px);background: ${foregroundOnAccentRest};position: absolute;top: 50%;left: 50%;width: 50%;height: 50%;transform: translate(-50%, -50%);opacity: 0}:host(:not([disabled])) .control:hover{background: ${neutralFillInputHover};border-color: ${neutralStrokeHover}}:host(:not([disabled])) .control:active{background: ${neutralFillInputActive};border-color: ${neutralStrokeActive}}:host(:${focusVisible}) .control{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}:host([aria-checked="true"]) .control{background: ${accentFillRest};border: calc(${strokeWidth} * 1px) solid ${accentFillRest}}:host([aria-checked="true"]:not([disabled])) .control:hover{background: ${accentFillHover};border: calc(${strokeWidth} * 1px) solid ${accentFillHover}}:host([aria-checked="true"]:not([disabled])) .control:hover .checked-indicator{fill: ${foregroundOnAccentHover}}:host([aria-checked="true"]:not([disabled])) .control:hover .indeterminate-indicator{background: ${foregroundOnAccentHover}}:host([aria-checked="true"]:not([disabled])) .control:active{background: ${accentFillActive};border: calc(${strokeWidth} * 1px) solid ${accentFillActive}}:host([aria-checked="true"]:not([disabled])) .control:active .checked-indicator{fill: ${foregroundOnAccentActive}}:host([aria-checked="true"]:not([disabled])) .control:active .indeterminate-indicator{background: ${foregroundOnAccentActive}}:host([aria-checked="true"]:${focusVisible}:not([disabled])) .control{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}:host([disabled]) .label, :host([readonly]) .label, :host([readonly]) .control, :host([disabled]) .control{cursor: ${disabledCursor}}:host([aria-checked="true"]:not(.indeterminate)) .checked-indicator, :host(.indeterminate) .indeterminate-indicator{opacity: 1}:host([disabled]){opacity: ${disabledOpacity}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .control{forced-color-adjust: none;border-color: ${SystemColors.FieldText};background: ${SystemColors.Field}}.checked-indicator{fill: ${SystemColors.FieldText}}.indeterminate-indicator{background: ${SystemColors.FieldText}}:host(:not([disabled])) .control:hover, .control:active{border-color: ${SystemColors.Highlight};background: ${SystemColors.Field}}:host(:${focusVisible}) .control{box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}:host([aria-checked="true"]:${focusVisible}:not([disabled])) .control{box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}:host([aria-checked="true"]) .control{background: ${SystemColors.Highlight};border-color: ${SystemColors.Highlight}}:host([aria-checked="true"]:not([disabled])) .control:hover, .control:active{border-color: ${SystemColors.Highlight};background: ${SystemColors.HighlightText}}:host([aria-checked="true"]) .checked-indicator{fill: ${SystemColors.HighlightText}}:host([aria-checked="true"]:not([disabled])) .control:hover .checked-indicator{fill: ${SystemColors.Highlight}}:host([aria-checked="true"]) .indeterminate-indicator{background: ${SystemColors.HighlightText}}:host([aria-checked="true"]) .control:hover .indeterminate-indicator{background: ${SystemColors.Highlight}}:host([disabled]){opacity: 1}:host([disabled]) .control{forced-color-adjust: none;border-color: ${SystemColors.GrayText};background: ${SystemColors.Field}}:host([disabled]) .indeterminate-indicator, :host([aria-checked="true"][disabled]) .control:hover .indeterminate-indicator{forced-color-adjust: none;background: ${SystemColors.GrayText}}:host([disabled]) .checked-indicator, :host([aria-checked="true"][disabled]) .control:hover .checked-indicator{forced-color-adjust: none;fill: ${SystemColors.GrayText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Checkbox} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#checkboxTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-checkbox\>
 */

const fastCheckbox = Checkbox.compose({
  baseName: "checkbox",
  template: checkboxTemplate,
  styles: checkboxStyles,
  checkedIndicator: `
        <svg
            aria-hidden="true"
            part="checked-indicator"
            class="checked-indicator"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M8.143 12.6697L15.235 4.5L16.8 5.90363L8.23812 15.7667L3.80005 11.2556L5.27591 9.7555L8.143 12.6697Z"
            />
        </svg>
    `,
  indeterminateIndicator: `
        <div part="indeterminate-indicator" class="indeterminate-indicator"></div>
    `
});
/**
 * Styles for Checkbox
 * @public
 */

const checkboxStyles$1 = checkboxStyles;

const selectStyles = (context, definition) => css` ${display("inline-flex")} :host{--elevation: 14;background: ${neutralFillInputRest};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${accentFillRest};box-sizing: border-box;color: ${neutralForegroundRest};font-family: ${bodyFont};height: calc(${heightNumber} * 1px);position: relative;user-select: none;min-width: 250px;outline: none;vertical-align: top}.listbox{${elevation} background: ${neutralLayerFloating$1};border: calc(${strokeWidth} * 1px) solid ${neutralStrokeRest};border-radius: calc(${controlCornerRadius} * 1px);box-sizing: border-box;display: inline-flex;flex-direction: column;left: 0;max-height: calc(var(--max-height) - (${heightNumber} * 1px));padding: calc(${designUnit} * 1px) 0;overflow-y: auto;position: absolute;width: 100%;z-index: 1}.listbox[hidden]{display: none}.control{align-items: center;box-sizing: border-box;cursor: pointer;display: flex;font-size: ${typeRampBaseFontSize};font-family: inherit;line-height: ${typeRampBaseLineHeight};min-height: 100%;padding: 0 calc(${designUnit} * 2.25px);width: 100%}:host(:not([disabled]):hover){background: ${neutralFillInputHover};border-color: ${accentFillHover}}:host(:${focusVisible}){border-color: ${focusStrokeOuter$1};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) ${focusStrokeOuter$1}}:host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]:not([disabled])){box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) inset ${focusStrokeInner$1};border-color: ${focusStrokeOuter$1};background: ${accentFillFocus};color: ${foregroundOnAccentFocus}}:host([disabled]){cursor: ${disabledCursor};opacity: ${disabledOpacity}}:host([disabled]) .control{cursor: ${disabledCursor};user-select: none}:host([disabled]:hover){background: ${neutralFillStealthRest};color: ${neutralForegroundRest};fill: currentcolor}:host(:not([disabled])) .control:active{background: ${neutralFillInputActive};border-color: ${accentFillActive}}:host([open][position="above"]) .listbox, :host([open][position="below"]) .control{border-bottom-left-radius: 0;border-bottom-right-radius: 0}:host([open][position="above"]) .control, :host([open][position="below"]) .listbox{border-top-left-radius: 0;border-top-right-radius: 0}:host([open][position="above"]) .listbox{border-bottom: 0;bottom: calc(${heightNumber} * 1px)}:host([open][position="below"]) .listbox{border-top: 0;top: calc(${heightNumber} * 1px)}.selected-value{flex: 1 1 auto;font-family: inherit;text-align: start;white-space: nowrap;text-overflow: ellipsis;overflow: hidden}.indicator{flex: 0 0 auto;margin-inline-start: 1em}slot[name="listbox"]{display: none;width: 100%}:host([open]) slot[name="listbox"]{display: flex;position: absolute;${elevation}}.end{margin-inline-start: auto}.start, .end, .indicator, .select-indicator, ::slotted(svg){${``
/* Glyph size is temporary - replace when glyph-size var is added */
} fill: currentcolor;height: 1em;min-height: calc(${designUnit} * 4px);min-width: calc(${designUnit} * 4px);width: 1em}::slotted([role="option"]), ::slotted(option){flex: 0 0 auto}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host(:not([disabled]):hover), :host(:not([disabled]):active){border-color: ${SystemColors.Highlight}}:host(:not([disabled]):${focusVisible}){background-color: ${SystemColors.ButtonFace};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) ${SystemColors.Highlight};color: ${SystemColors.ButtonText};fill: currentcolor;forced-color-adjust: none}:host(:not([disabled]):${focusVisible}) .listbox{background: ${SystemColors.ButtonFace}}:host([disabled]){border-color: ${SystemColors.GrayText};background-color: ${SystemColors.ButtonFace};color: ${SystemColors.GrayText};fill: currentcolor;opacity: 1;forced-color-adjust: none}:host([disabled]:hover){background: ${SystemColors.ButtonFace}}:host([disabled]) .control{color: ${SystemColors.GrayText};border-color: ${SystemColors.GrayText}}:host([disabled]) .control .select-indicator{fill: ${SystemColors.GrayText}}:host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]), :host(:${focusVisible}) ::slotted(option[aria-selected="true"]), :host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]:not([disabled])){background: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) inset ${SystemColors.HighlightText};color: ${SystemColors.HighlightText};fill: currentcolor}.start, .end, .indicator, .select-indicator, ::slotted(svg){color: ${SystemColors.ButtonText};fill: currentcolor}`));

const comboboxStyles = (context, definition) => css` ${selectStyles()} :host(:empty) .listbox{display: none}:host([disabled]) *, :host([disabled]){cursor: ${disabledCursor};user-select: none}.selected-value{-webkit-appearance: none;background: transparent;border: none;color: inherit;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};height: calc(100% - (${strokeWidth} * 1px));margin: auto 0;width: 100%}.selected-value:hover, .selected-value:${focusVisible}, .selected-value:disabled, .selected-value:active{outline: none}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Combobox} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#comboboxTemplate}
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-combobox\>
 *
 */

const fastCombobox = Combobox.compose({
  baseName: "combobox",
  template: comboboxTemplate,
  styles: comboboxStyles,
  shadowOptions: {
    delegatesFocus: true
  },
  indicator: `
        <svg
            class="select-indicator"
            part="select-indicator"
            viewBox="0 0 12 7"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M11.85.65c.2.2.2.5 0 .7L6.4 6.84a.55.55 0 01-.78 0L.14 1.35a.5.5 0 11.71-.7L6 5.8 11.15.65c.2-.2.5-.2.7 0z"
            />
        </svg>
    `
});
/**
 * Styles for combobox
 * @public
 */

const comboboxStyles$1 = comboboxStyles;

const dataGridStyles = (context, definition) => css` :host{display: flex;position: relative;flex-direction: column}`;

const dataGridRowStyles = (context, definition) => css` :host{display: grid;padding: 1px 0;box-sizing: border-box;width: 100%;border-bottom: calc(${strokeWidth} * 1px) solid ${neutralStrokeDividerRest}}:host(.header){}:host(.sticky-header){background: ${neutralFillRest};position: sticky;top: 0}`;

const dataGridCellStyles = (context, definition) => css` :host{padding: calc(${designUnit} * 1px) calc(${designUnit} * 3px);color: ${neutralForegroundRest};box-sizing: border-box;font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};font-weight: 400;border: transparent calc(${strokeWidth} * 1px) solid;overflow: hidden;white-space: nowrap;border-radius: calc(${controlCornerRadius} * 1px)}:host(.column-header){font-weight: 600}:host(:${focusVisible}){border: ${focusStrokeOuter$1} calc(${strokeWidth} * 1px) solid;color: ${neutralForegroundRest}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{forced-color-adjust: none;border-color: transparent;background: ${SystemColors.Field};color: ${SystemColors.FieldText}}:host(:${focusVisible}){border-color: ${SystemColors.FieldText};box-shadow: 0 0 0 2px inset ${SystemColors.Field};color: ${SystemColors.FieldText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#DataGridCell} registration for configuring the component with a DesignSystem.
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-data-grid-cell\>
 */

const fastDataGridCell = DataGridCell.compose({
  baseName: "data-grid-cell",
  template: dataGridCellTemplate,
  styles: dataGridCellStyles
});
/**
 * Styles for DataGrid cell
 * @public
 */

const dataGridCellStyles$1 = dataGridCellStyles;
/**
 * A function that returns a {@link @microsoft/fast-foundation#DataGridRow} registration for configuring the component with a DesignSystem.
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-data-grid-row\>
 */

const fastDataGridRow = DataGridRow.compose({
  baseName: "data-grid-row",
  template: dataGridRowTemplate,
  styles: dataGridRowStyles
});
/**
 * Styles for DataGrid row
 * @public
 */

const dataGridRowStyles$1 = dataGridRowStyles;
/**
 * A function that returns a {@link @microsoft/fast-foundation#DataGrid} registration for configuring the component with a DesignSystem.
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-data-grid\>
 */

const fastDataGrid = DataGrid.compose({
  baseName: "data-grid",
  template: dataGridTemplate,
  styles: dataGridStyles
});
/**
 * Styles for DataGrid
 * @public
 */

const dataGridStyles$1 = dataGridStyles;

const dialogStyles = (context, definition) => css` :host([hidden]){display: none}:host{--elevation: 14;--dialog-height: 480px;--dialog-width: 640px;display: block}.overlay{position: fixed;top: 0;left: 0;right: 0;bottom: 0;background: rgba(0, 0, 0, 0.3);touch-action: none}.positioning-region{display: flex;justify-content: center;position: fixed;top: 0;bottom: 0;left: 0;right: 0;overflow: auto}.control{${elevation} margin-top: auto;margin-bottom: auto;width: var(--dialog-width);height: var(--dialog-height);background-color: ${fillColor};z-index: 1;border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid transparent}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Dialog} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#dialogTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-dialog\>
 */

const fastDialog = Dialog.compose({
  baseName: "dialog",
  template: dialogTemplate,
  styles: dialogStyles
});
/**
 * Styles for Dialog
 * @public
 */

const dialogStyles$1 = dialogStyles;

const disclosureStyles = (context, definition) => css` .disclosure{transition: height 0.35s}.disclosure .invoker::-webkit-details-marker{display: none}.disclosure .invoker{list-style-type: none}:host([appearance="accent"]) .invoker{background: ${accentFillRest};color: ${foregroundOnAccentRest};font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};border-radius: calc(${controlCornerRadius} * 1px);outline: none;cursor: pointer;margin: 16px 0;padding: 12px;max-width: max-content}:host([appearance="accent"]) .invoker:active{background: ${accentFillActive};color: ${foregroundOnAccentActive}}:host([appearance="accent"]) .invoker:hover{background: ${accentFillHover};color: ${foregroundOnAccentHover}}:host([appearance="lightweight"]) .invoker{background: transparent;color: ${accentForegroundRest};border-bottom: calc(${strokeWidth} * 1px) solid ${accentForegroundRest};cursor: pointer;width: max-content;margin: 16px 0}:host([appearance="lightweight"]) .invoker:active{border-bottom-color: ${accentForegroundActive}}:host([appearance="lightweight"]) .invoker:hover{border-bottom-color: ${accentForegroundHover}}.disclosure[open] .invoker ~ *{animation: fadeIn 0.5s ease-in-out}@keyframes fadeIn{0%{opacity: 0}100%{opacity: 1}}`;

/**
 * @internal
 */

class Disclosure$1 extends Disclosure {
  appearanceChanged(oldValue, newValue) {
    if (oldValue !== newValue) {
      this.classList.add(newValue);
      this.classList.remove(oldValue);
    }
  }
  /**
   * Set disclosure height while transitioning
   * @override
   */


  onToggle() {
    super.onToggle();
    this.details.style.setProperty("height", `${this.disclosureHeight}px`);
  }
  /**
   * Calculate disclosure height before and after expanded
   * @override
   */


  setup() {
    super.setup();

    if (!this.appearance) {
      this.appearance = "accent";
    }

    const getCurrentHeight = () => this.details.getBoundingClientRect().height;

    this.show();
    this.totalHeight = getCurrentHeight();
    this.hide();
    this.height = getCurrentHeight();

    if (this.expanded) {
      this.show();
    }
  }

  get disclosureHeight() {
    return this.expanded ? this.totalHeight : this.height;
  }

}

__decorate$1([attr], Disclosure$1.prototype, "appearance", void 0);
/**
 * Styles for Disclosure
 * @public
 */


const disclosureStyles$1 = disclosureStyles;
/**
 * A function that returns a {@link @microsoft/fast-foundation#Disclosure} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#disclosureTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-Disclosure\>
 *
 */

const fastDisclosure = Disclosure$1.compose({
  baseName: "disclosure",
  template: disclosureTemplate,
  styles: disclosureStyles
});

const dividerStyles = (context, definition) => css` ${display("block")} :host{box-sizing: content-box;height: 0;margin: calc(${designUnit} * 1px) 0;border: none;border-top: calc(${strokeWidth} * 1px) solid ${neutralStrokeDividerRest}}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Divider} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#dividerTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-divider\>
 */

const fastDivider = Divider.compose({
  baseName: "divider",
  template: dividerTemplate,
  styles: dividerStyles
});
/**
 * Styles for Divider
 * @public
 */

const dividerStyles$1 = dividerStyles;

const flipperStyles = (context, definition) => css` ${display("inline-flex")} :host{width: calc(${heightNumber} * 1px);height: calc(${heightNumber} * 1px);justify-content: center;align-items: center;margin: 0;position: relative;fill: currentcolor;color: ${foregroundOnAccentRest};background: transparent;outline: none;border: none;padding: 0}:host::before{content: "";background: ${accentFillRest};border: calc(${strokeWidth} * 1px) solid ${accentFillRest};border-radius: 50%;position: absolute;top: 0;right: 0;left: 0;bottom: 0;transition: all 0.1s ease-in-out}.next, .previous{position: relative;${
/* Glyph size and display: grid are temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px;display: grid}:host([disabled]){opacity: ${disabledOpacity};cursor: ${disabledCursor};fill: currentcolor;color: ${neutralForegroundRest}}:host([disabled])::before, :host([disabled]:hover)::before, :host([disabled]:active)::before{background: ${neutralFillStealthRest};border-color: ${neutralStrokeRest}}:host(:hover){color: ${foregroundOnAccentHover}}:host(:hover)::before{background: ${accentFillHover};border-color: ${accentFillHover}}:host(:active){color: ${foregroundOnAccentActive}}:host(:active)::before{background: ${accentFillActive};border-color: ${accentFillActive}}:host(:${focusVisible}){outline: none}:host(:${focusVisible})::before{box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${focusStrokeOuter$1} inset, 0 0 0 calc((${focusStrokeWidth} + ${strokeWidth}) * 1px) ${focusStrokeInner$1} inset;border-color: ${focusStrokeOuter$1}}:host::-moz-focus-inner{border: 0}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{background: ${SystemColors.Canvas}}:host .next, :host .previous{color: ${SystemColors.ButtonText};fill: currentcolor}:host::before{background: ${SystemColors.Canvas};border-color: ${SystemColors.ButtonText}}:host(:hover)::before{forced-color-adjust: none;background: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};opacity: 1}:host(:hover) .next, :host(:hover) .previous{forced-color-adjust: none;color: ${SystemColors.HighlightText};fill: currentcolor}:host([disabled]){opacity: 1}:host([disabled])::before, :host([disabled]:hover)::before, :host([disabled]) .next, :host([disabled]) .previous{forced-color-adjust: none;background: ${SystemColors.Canvas};border-color: ${SystemColors.GrayText};color: ${SystemColors.GrayText};fill: ${SystemColors.GrayText}}:host(:${focusVisible})::before{forced-color-adjust: none;border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${SystemColors.Highlight} inset}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Flipper} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#flipperTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-flipper\>
 */

const fastFlipper = Flipper.compose({
  baseName: "flipper",
  template: flipperTemplate,
  styles: flipperStyles,
  next: `
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M4.023 15.273L11.29 8 4.023.727l.704-.704L12.71 8l-7.984 7.977-.704-.704z"
            />
        </svg>
    `,
  previous: `
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M11.273 15.977L3.29 8 11.273.023l.704.704L4.71 8l7.266 7.273-.704.704z"
            />
        </svg>
    `
});
/**
 * Styles for Flipper
 * @public
 */

const flipperStyles$1 = flipperStyles;

const ltrActionsStyles = css` .scroll-prev{right: auto;left: 0}.scroll.scroll-next::before, .scroll-next .scroll-action{left: auto;right: 0}.scroll.scroll-next::before{background: linear-gradient(to right, transparent, var(--scroll-fade-next))}.scroll-next .scroll-action{transform: translate(50%, -50%)}`;
const rtlActionsStyles = css` .scroll.scroll-next{right: auto;left: 0}.scroll.scroll-next::before{background: linear-gradient(to right, var(--scroll-fade-next), transparent);left: auto;right: 0}.scroll.scroll-prev::before{background: linear-gradient(to right, transparent, var(--scroll-fade-previous))}.scroll-prev .scroll-action{left: auto;right: 0;transform: translate(50%, -50%)}`;
/**
 * Styles used for the flipper container and gradient fade
 * @public
 */

const ActionsStyles = css` .scroll-area{position: relative}div.scroll-view{overflow-x: hidden}.scroll{bottom: 0;pointer-events: none;position: absolute;right: 0;top: 0;user-select: none;width: 100px}.scroll.disabled{display: none}.scroll::before, .scroll-action{left: 0;position: absolute}.scroll::before{background: linear-gradient(to right, var(--scroll-fade-previous), transparent);content: "";display: block;height: 100%;width: 100%}.scroll-action{pointer-events: auto;right: auto;top: 50%;transform: translate(-50%, -50%)}`.withBehaviors(new DirectionalStyleSheetBehavior(ltrActionsStyles, rtlActionsStyles));
/**
 * Styles handling the scroll container and content
 * @public
 */

const horizontalScrollStyles = (context, definition) => css` ${display("block")} :host{--scroll-align: center;--scroll-item-spacing: 5px;contain: layout;position: relative}.scroll-view{overflow-x: auto;scrollbar-width: none}::-webkit-scrollbar{display: none}.content-container{align-items: var(--scroll-align);display: inline-flex;flex-wrap: nowrap;position: relative}.content-container ::slotted(*){margin-right: var(--scroll-item-spacing)}.content-container ::slotted(*:last-child){margin-right: 0}`;

/**
 * @internal
 */

class HorizontalScroll$1 extends HorizontalScroll {
  /**
   * @public
   */
  connectedCallback() {
    super.connectedCallback();

    if (this.view !== "mobile") {
      this.$fastController.addStyles(ActionsStyles);
    }
  }

}
/**
 * A function that returns a {@link @microsoft/fast-foundation#HorizontalScroll} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#horizontalScrollTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-horizontal-scroll\>
 */

const fastHorizontalScroll = HorizontalScroll$1.compose({
  baseName: "horizontal-scroll",
  template: horizontalScrollTemplate,
  styles: horizontalScrollStyles,
  nextFlipper: html`<fast-flipper @click="${x => x.scrollToNext()}" aria-hidden="${x => x.flippersHiddenFromAT}"></fast-flipper>`,
  previousFlipper: html`<fast-flipper @click="${x => x.scrollToPrevious()}" direction="previous" aria-hidden="${x => x.flippersHiddenFromAT}"></fast-flipper>`
});

const optionStyles = (context, definition) => css` ${display("inline-flex")} :host{align-items: center;font-family: ${bodyFont};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${focusStrokeWidth} * 1px) solid transparent;box-sizing: border-box;color: ${neutralForegroundRest};cursor: pointer;fill: currentcolor;font-size: ${typeRampBaseFontSize};height: calc(${heightNumber} * 1px);line-height: ${typeRampBaseLineHeight};margin: 0 calc(${designUnit} * 1px);outline: none;overflow: hidden;padding: 0 calc(${designUnit} * 2.25px);user-select: none;white-space: nowrap}:host(:${focusVisible}){box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) inset ${focusStrokeInner$1};border-color: ${focusStrokeOuter$1};background: ${accentFillFocus};color: ${foregroundOnAccentFocus}}:host([aria-selected="true"]){background: ${accentFillRest};color: ${foregroundOnAccentRest}}:host(:hover){background: ${accentFillHover};color: ${foregroundOnAccentHover}}:host(:active){background: ${accentFillActive};color: ${foregroundOnAccentActive}}:host(:not([aria-selected="true"]):hover){background: ${neutralFillHover};color: ${neutralForegroundRest}}:host(:not([aria-selected="true"]):active){background: ${neutralFillHover};color: ${neutralForegroundRest}}:host([disabled]){cursor: ${disabledCursor};opacity: ${disabledOpacity}}:host([disabled]:hover){background-color: inherit}.content{grid-column-start: 2;justify-self: start;overflow: hidden;text-overflow: ellipsis}.start, .end, ::slotted(svg){display: flex}::slotted(svg){${
/* Glyph size and margin-left is temporary - replace when adaptive typography is figured out */
""} height: calc(${designUnit} * 4px);width: calc(${designUnit} * 4px)}::slotted([slot="end"]){margin-inline-start: 1ch}::slotted([slot="start"]){margin-inline-end: 1ch}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{border-color: transparent;forced-color-adjust: none;color: ${SystemColors.ButtonText};fill: currentcolor}:host(:not([aria-selected="true"]):hover), :host([aria-selected="true"]){background: ${SystemColors.Highlight};color: ${SystemColors.HighlightText}}:host([disabled]), :host([disabled]:not([aria-selected="true"]):hover){background: ${SystemColors.Canvas};color: ${SystemColors.GrayText};fill: currentcolor;opacity: 1}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#ListboxOption} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#listboxOptionTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-option\>
 *
 */

const fastOption = ListboxOption.compose({
  baseName: "option",
  template: listboxOptionTemplate,
  styles: optionStyles
});
/**
 * Styles for Option
 * @public
 */

const optionStyles$1 = optionStyles;

const listboxStyles = (context, definition) => css` ${display("inline-flex")} :host{background: ${neutralLayerFloating$1};border: calc(${strokeWidth} * 1px) solid ${neutralStrokeRest};border-radius: calc(${controlCornerRadius} * 1px);box-sizing: border-box;flex-direction: column;padding: calc(${designUnit} * 1px) 0}:host(:focus-within:not([disabled])){border-color: ${focusStrokeOuter$1};box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${focusStrokeOuter$1} inset}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]){background: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) inset ${SystemColors.HighlightText};color: ${SystemColors.HighlightText};fill: currentcolor}:host(:${focusVisible}) ::slotted([aria-selected="true"][role="option"]){background: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) inset ${SystemColors.HighlightText};color: ${SystemColors.HighlightText};fill: currentcolor}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Listbox} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#listboxTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-listbox\>
 *
 */

const fastListbox = Listbox.compose({
  baseName: "listbox",
  template: listboxTemplate,
  styles: listboxStyles
});
/**
 * Styles for Listbox
 * @public
 */

const listboxStyles$1 = listboxStyles;

const menuItemStyles = (context, definition) => css` ${display("grid")} :host{contain: layout;overflow: visible;font-family: ${bodyFont};outline: none;box-sizing: border-box;height: calc(${heightNumber} * 1px);grid-template-columns: minmax(42px, auto) 1fr minmax(42px, auto);grid-template-rows: auto;justify-items: center;align-items: center;padding: 0;margin: 0 calc(${designUnit} * 1px);white-space: nowrap;color: ${neutralForegroundRest};fill: currentcolor;cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${focusStrokeWidth} * 1px) solid transparent}:host(.indent-0){grid-template-columns: auto 1fr minmax(42px, auto)}:host(.indent-0) .content{grid-column: 1;grid-row: 1;margin-inline-start: 10px}:host(.indent-2){grid-template-columns: minmax(42px, auto) minmax(42px, auto) 1fr minmax(42px, auto) minmax(42px, auto)}:host(.indent-2) .content{grid-column: 3;grid-row: 1;margin-inline-start: 10px}:host(.indent-2) .expand-collapse-glyph-container{grid-column: 5;grid-row: 1}:host(.indent-2) .start{grid-column: 2}:host(.indent-2) .end{grid-column: 4}:host(:${focusVisible}){border-color: ${focusStrokeOuter$1};background: ${neutralLayer3$1};color: ${neutralForegroundRest}}:host(:hover){background: ${neutralLayer3$1};color: ${neutralForegroundRest}}:host([aria-checked="true"]), :host(:active), :host(.expanded){background: ${neutralLayer2$1};color: ${neutralForegroundRest}}:host([disabled]){cursor: ${disabledCursor};opacity: ${disabledOpacity}}:host([disabled]:hover){color: ${neutralForegroundRest};fill: currentcolor;background: ${neutralFillStealthRest}}:host([disabled]:hover) .start, :host([disabled]:hover) .end, :host([disabled]:hover)::slotted(svg){fill: ${neutralForegroundRest}}.expand-collapse-glyph{${
/* Glyph size is temporary -
replace when glyph-size var is added */
""} width: 16px;height: 16px;fill: currentcolor}.content{grid-column-start: 2;justify-self: start;overflow: hidden;text-overflow: ellipsis}.start, .end{display: flex;justify-content: center}::slotted(svg){${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px}:host(:hover) .start, :host(:hover) .end, :host(:hover)::slotted(svg), :host(:active) .start, :host(:active) .end, :host(:active)::slotted(svg){fill: ${neutralForegroundRest}}:host(.indent-1[aria-haspopup="menu"]), :host(.indent-1[role="menuitemcheckbox"]), :host(.indent-1[role="menuitemradio"]){display: grid;grid-template-columns: minmax(42px, auto) auto 1fr minmax(42px, auto) minmax(42px, auto);align-items: center;min-height: 32px}:host(.indent-2:not([aria-haspopup="menu"])) .end{grid-column: 5}:host .input-container, :host .expand-collapse-glyph-container{display: none}:host([aria-haspopup="menu"]) .expand-collapse-glyph-container, :host([role="menuitemcheckbox"]) .input-container, :host([role="menuitemradio"]) .input-container{display: grid;margin-inline-end: 10px}:host([aria-haspopup="menu"]) .content, :host([role="menuitemcheckbox"]) .content, :host([role="menuitemradio"]) .content{grid-column-start: 3}:host([aria-haspopup="menu"]) .end, :host([role="menuitemcheckbox"]) .end, :host([role="menuitemradio"]) .end{grid-column-start: 4}:host .expand-collapse, :host .checkbox, :host .radio{display: flex;align-items: center;justify-content: center;position: relative;width: 20px;height: 20px;box-sizing: border-box;outline: none;margin-inline-start: 10px}:host .checkbox, :host .radio{border: calc(${strokeWidth} * 1px) solid ${neutralForegroundRest}}:host([aria-checked="true"]) .checkbox, :host([aria-checked="true"]) .radio{background: ${accentFillRest};border-color: ${accentFillRest}}:host .checkbox{border-radius: calc(${controlCornerRadius} * 1px)}:host .radio{border-radius: 999px}:host .checkbox-indicator, :host .radio-indicator, :host .expand-collapse-indicator, ::slotted([slot="checkbox-indicator"]), ::slotted([slot="radio-indicator"]), ::slotted([slot="expand-collapse-indicator"]){display: none}::slotted([slot="end"]:not(svg)){margin-inline-end: 10px;color: ${neutralForegroundHint$1}}:host([aria-checked="true"]) .checkbox-indicator, :host([aria-checked="true"]) ::slotted([slot="checkbox-indicator"]){width: 100%;height: 100%;display: block;fill: ${neutralForegroundRest};pointer-events: none}:host([aria-checked="true"]) .radio-indicator{position: absolute;top: 4px;left: 4px;right: 4px;bottom: 4px;border-radius: 999px;display: block;background: ${neutralForegroundRest};pointer-events: none}:host([aria-checked="true"]) ::slotted([slot="radio-indicator"]){display: block;pointer-events: none}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{border-color: transparent;color: ${SystemColors.ButtonText};forced-color-adjust: none}:host(:hover){background: ${SystemColors.Highlight};color: ${SystemColors.HighlightText}}:host(:hover) .start, :host(:hover) .end, :host(:hover)::slotted(svg), :host(:active) .start, :host(:active) .end, :host(:active)::slotted(svg){fill: ${SystemColors.HighlightText}}:host(.expanded){background: ${SystemColors.Highlight};border-color: ${SystemColors.Highlight};color: ${SystemColors.HighlightText}}:host(:${focusVisible}){background: ${SystemColors.Highlight};border-color: ${SystemColors.ButtonText};box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) inset ${SystemColors.HighlightText};color: ${SystemColors.HighlightText};fill: currentcolor}:host([disabled]), :host([disabled]:hover), :host([disabled]:hover) .start, :host([disabled]:hover) .end, :host([disabled]:hover)::slotted(svg){background: ${SystemColors.Canvas};color: ${SystemColors.GrayText};fill: currentcolor;opacity: 1}:host .expanded-toggle, :host .checkbox, :host .radio{border-color: ${SystemColors.ButtonText};background: ${SystemColors.HighlightText}}:host([checked="true"]) .checkbox, :host([checked="true"]) .radio{background: ${SystemColors.HighlightText};border-color: ${SystemColors.HighlightText}}:host(:hover) .expanded-toggle, :host(:hover) .checkbox, :host(:hover) .radio, :host(:${focusVisible}) .expanded-toggle, :host(:${focusVisible}) .checkbox, :host(:${focusVisible}) .radio, :host([checked="true"]:hover) .checkbox, :host([checked="true"]:hover) .radio, :host([checked="true"]:${focusVisible}) .checkbox, :host([checked="true"]:${focusVisible}) .radio{border-color: ${SystemColors.HighlightText}}:host([aria-checked="true"]){background: ${SystemColors.Highlight};color: ${SystemColors.HighlightText}}:host([aria-checked="true"]) .checkbox-indicator, :host([aria-checked="true"]) ::slotted([slot="checkbox-indicator"]), :host([aria-checked="true"]) ::slotted([slot="radio-indicator"]){fill: ${SystemColors.Highlight}}:host([aria-checked="true"]) .radio-indicator{background: ${SystemColors.Highlight}}::slotted([slot="end"]:not(svg)){color: ${SystemColors.ButtonText}}:host(:hover) ::slotted([slot="end"]:not(svg)), :host(:${focusVisible}) ::slotted([slot="end"]:not(svg)){color: ${SystemColors.HighlightText}}`), new DirectionalStyleSheetBehavior(css` .expand-collapse-glyph{transform: rotate(0deg)}`, css` .expand-collapse-glyph{transform: rotate(180deg)}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#MenuItem} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#menuItemTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-menu-item\>
 */

const fastMenuItem = MenuItem.compose({
  baseName: "menu-item",
  template: menuItemTemplate,
  styles: menuItemStyles,
  checkboxIndicator: `
        <svg
            aria-hidden="true"
            part="checkbox-indicator"
            class="checkbox-indicator"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M8.143 12.6697L15.235 4.5L16.8 5.90363L8.23812 15.7667L3.80005 11.2556L5.27591 9.7555L8.143 12.6697Z"
            />
        </svg>
    `,
  expandCollapseGlyph: `
        <svg
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            class="expand-collapse-glyph"
            part="expand-collapse-glyph"
        >
            <path
                d="M5.00001 12.3263C5.00124 12.5147 5.05566 12.699 5.15699 12.8578C5.25831 13.0167 5.40243 13.1437 5.57273 13.2242C5.74304 13.3047 5.9326 13.3354 6.11959 13.3128C6.30659 13.2902 6.4834 13.2152 6.62967 13.0965L10.8988 8.83532C11.0739 8.69473 11.2153 8.51658 11.3124 8.31402C11.4096 8.11146 11.46 7.88966 11.46 7.66499C11.46 7.44033 11.4096 7.21853 11.3124 7.01597C11.2153 6.81341 11.0739 6.63526 10.8988 6.49467L6.62967 2.22347C6.48274 2.10422 6.30501 2.02912 6.11712 2.00691C5.92923 1.9847 5.73889 2.01628 5.56823 2.09799C5.39757 2.17969 5.25358 2.30817 5.153 2.46849C5.05241 2.62882 4.99936 2.8144 5.00001 3.00369V12.3263Z"
            />
        </svg>
    `,
  radioIndicator: `
        <span part="radio-indicator" class="radio-indicator"></span>
    `
});
/**
 * Styles for MenuItem
 * @public
 */

const menuItemStyles$1 = menuItemStyles;

const menuStyles = (context, definition) => css` ${display("block")} :host{--elevation: 11;background: ${neutralLayerFloating$1};border: calc(${strokeWidth} * 1px) solid transparent;${elevation} margin: 0;border-radius: calc(${controlCornerRadius} * 1px);padding: calc(${designUnit} * 1px) 0;max-width: 368px;min-width: 64px}:host([slot="submenu"]){width: max-content;margin: 0 calc(${designUnit} * 1px)}::slotted(hr){box-sizing: content-box;height: 0;margin: 0;border: none;border-top: calc(${strokeWidth} * 1px) solid ${neutralStrokeDividerRest}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{background: ${SystemColors.Canvas};border-color: ${SystemColors.CanvasText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Menu} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#menuTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-menu\>
 */

const fastMenu = Menu.compose({
  baseName: "menu",
  template: menuTemplate,
  styles: menuStyles
});
/**
 * Styles for Menu
 * @public
 */

const menuStyles$1 = menuStyles;

const numberFieldStyles = (context, definition) => css` ${display("inline-block")} :host{font-family: ${bodyFont};outline: none;user-select: none}.root{box-sizing: border-box;position: relative;display: flex;flex-direction: row;color: ${neutralForegroundRest};background: ${neutralFillInputRest};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${accentFillRest};height: calc(${heightNumber} * 1px)}.control{-webkit-appearance: none;font: inherit;background: transparent;border: 0;color: inherit;height: calc(100% - 4px);width: 100%;margin-top: auto;margin-bottom: auto;border: none;padding: 0 calc(${designUnit} * 2px + 1px);font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight}}.control:hover, .control:${focusVisible}, .control:disabled, .control:active{outline: none}.controls{opacity: 0}.label{display: block;color: ${neutralForegroundRest};cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};margin-bottom: 4px}.label__hidden{display: none;visibility: hidden}.start, .end{margin: auto;fill: currentcolor}.step-up-glyph, .step-down-glyph{display: block;padding: 4px 10px;cursor: pointer}.step-up-glyph:before, .step-down-glyph:before{content: '';display: block;border: solid transparent 6px}.step-up-glyph:before{border-bottom-color: ${neutralForegroundRest}}.step-down-glyph:before{border-top-color: ${neutralForegroundRest}}::slotted(svg){${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px}.start{margin-inline-start: 11px}.end{margin-inline-end: 11px}:host(:hover:not([disabled])) .root{background: ${neutralFillInputHover};border-color: ${accentFillHover}}:host(:active:not([disabled])) .root{background: ${neutralFillInputHover};border-color: ${accentFillActive}}:host(:focus-within:not([disabled])) .root{border-color: ${focusStrokeOuter$1};box-shadow: 0 0 0 1px ${focusStrokeOuter$1} inset}:host(:hover:not([disabled])) .controls, :host(:focus-within:not([disabled])) .controls{opacity: 1}:host([appearance="filled"]) .root{background: ${neutralFillRest}}:host([appearance="filled"]:hover:not([disabled])) .root{background: ${neutralFillHover}}:host([disabled]) .label, :host([readonly]) .label, :host([readonly]) .control, :host([disabled]) .control{cursor: ${disabledCursor}}:host([disabled]){opacity: ${disabledOpacity}}:host([disabled]) .control{border-color: ${neutralStrokeRest}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .root, :host([appearance="filled"]) .root{forced-color-adjust: none;background: ${SystemColors.Field};border-color: ${SystemColors.FieldText}}:host(:hover:not([disabled])) .root, :host([appearance="filled"]:hover:not([disabled])) .root, :host([appearance="filled"]:hover) .root{background: ${SystemColors.Field};border-color: ${SystemColors.Highlight}}.start, .end{fill: currentcolor}:host([disabled]){opacity: 1}:host([disabled]) .root, :host([appearance="filled"]:hover[disabled]) .root{border-color: ${SystemColors.GrayText};background: ${SystemColors.Field}}:host(:focus-within:enabled) .root{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 1px ${SystemColors.Highlight} inset}input::placeholder{color: ${SystemColors.GrayText}}`));

/**
 * @internal
 */

class NumberField$1 extends NumberField {
  /**
   * @internal
   */
  connectedCallback() {
    super.connectedCallback();

    if (!this.appearance) {
      this.appearance = "outline";
    }
  }

}

__decorate$1([attr], NumberField$1.prototype, "appearance", void 0);
/**
 * Styles for NumberField
 * @public
 */


const numberFieldStyles$1 = numberFieldStyles;
/**
 * A function that returns a {@link @microsoft/fast-foundation#NumberField} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#numberFieldTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-number-field\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */

const fastNumberField = NumberField$1.compose({
  baseName: "number-field",
  styles: numberFieldStyles,
  template: numberFieldTemplate,
  shadowOptions: {
    delegatesFocus: true
  },
  stepDownGlyph: `
        <span class="step-down-glyph" part="step-down-glyph"></span>
    `,
  stepUpGlyph: `
        <span class="step-up-glyph" part="step-up-glyph"></span>
    `
});

const progressRingStyles = (context, definition) => css` ${display("flex")} :host{align-items: center;outline: none;height: calc(${heightNumber} * 1px);width: calc(${heightNumber} * 1px);margin: calc(${heightNumber} * 1px) 0}.progress{height: 100%;width: 100%}.background{stroke: ${neutralFillRest};fill: none;stroke-width: 2px}.determinate{stroke: ${accentForegroundRest};fill: none;stroke-width: 2px;stroke-linecap: round;transform-origin: 50% 50%;transform: rotate(-90deg);transition: all 0.2s ease-in-out}.indeterminate-indicator-1{stroke: ${accentForegroundRest};fill: none;stroke-width: 2px;stroke-linecap: round;transform-origin: 50% 50%;transform: rotate(-90deg);transition: all 0.2s ease-in-out;animation: spin-infinite 2s linear infinite}:host([paused]) .indeterminate-indicator-1{animation-play-state: paused;stroke: ${neutralFillRest}}:host([paused]) .determinate{stroke: ${neutralForegroundHint$1}}@keyframes spin-infinite{0%{stroke-dasharray: 0.01px 43.97px;transform: rotate(0deg)}50%{stroke-dasharray: 21.99px 21.99px;transform: rotate(450deg)}100%{stroke-dasharray: 0.01px 43.97px;transform: rotate(1080deg)}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .indeterminate-indicator-1, .determinate{stroke: ${SystemColors.FieldText}}.background{stroke: ${SystemColors.Field}}:host([paused]) .indeterminate-indicator-1{stroke: ${SystemColors.Field}}:host([paused]) .determinate{stroke: ${SystemColors.GrayText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#BaseProgress} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#progressRingTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-progress-ring\>
 */

const fastProgressRing = BaseProgress.compose({
  baseName: "progress-ring",
  template: progressRingTemplate,
  styles: progressRingStyles,
  indeterminateIndicator: `
        <svg class="progress" part="progress" viewBox="0 0 16 16">
            <circle
                class="background"
                part="background"
                cx="8px"
                cy="8px"
                r="7px"
            ></circle>
            <circle
                class="indeterminate-indicator-1"
                part="indeterminate-indicator-1"
                cx="8px"
                cy="8px"
                r="7px"
            ></circle>
        </svg>
    `
});
/**
 * Styles for ProgressRing
 * @public
 */

const progressRingStyles$1 = progressRingStyles;

const progressStyles = (context, definition) => css` ${display("flex")} :host{align-items: center;outline: none;height: calc(${designUnit} * 1px);margin: calc(${designUnit} * 1px) 0}.progress{background-color: ${neutralFillRest};border-radius: calc(${designUnit} * 1px);width: 100%;height: 100%;display: flex;align-items: center;position: relative}.determinate{background-color: ${accentForegroundRest};border-radius: calc(${designUnit} * 1px);height: 100%;transition: all 0.2s ease-in-out;display: flex}.indeterminate{height: 100%;border-radius: calc(${designUnit} * 1px);display: flex;width: 100%;position: relative;overflow: hidden}.indeterminate-indicator-1{position: absolute;opacity: 0;height: 100%;background-color: ${accentForegroundRest};border-radius: calc(${designUnit} * 1px);animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);width: 40%;animation: indeterminate-1 2s infinite}.indeterminate-indicator-2{position: absolute;opacity: 0;height: 100%;background-color: ${accentForegroundRest};border-radius: calc(${designUnit} * 1px);animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);width: 60%;animation: indeterminate-2 2s infinite}:host([paused]) .indeterminate-indicator-1, :host([paused]) .indeterminate-indicator-2{animation-play-state: paused;background-color: ${neutralFillRest}}:host([paused]) .determinate{background-color: ${neutralForegroundHint$1}}@keyframes indeterminate-1{0%{opacity: 1;transform: translateX(-100%)}70%{opacity: 1;transform: translateX(300%)}70.01%{opacity: 0}100%{opacity: 0;transform: translateX(300%)}}@keyframes indeterminate-2{0%{opacity: 0;transform: translateX(-150%)}29.99%{opacity: 0}30%{opacity: 1;transform: translateX(-150%)}100%{transform: translateX(166.66%);opacity: 1}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .progress{forced-color-adjust: none;background-color: ${SystemColors.Field};box-shadow: 0 0 0 1px inset ${SystemColors.FieldText}}.determinate, .indeterminate-indicator-1, .indeterminate-indicator-2{forced-color-adjust: none;background-color: ${SystemColors.FieldText}}:host([paused]) .determinate, :host([paused]) .indeterminate-indicator-1, :host([paused]) .indeterminate-indicator-2{background-color: ${SystemColors.GrayText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#BaseProgress} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#progressTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-progress\>
 */

const fastProgress = BaseProgress.compose({
  baseName: "progress",
  template: progressTemplate,
  styles: progressStyles,
  indeterminateIndicator1: `
        <span class="indeterminate-indicator-1" part="indeterminate-indicator-1"></span>
    `,
  indeterminateIndicator2: `
        <span class="indeterminate-indicator-1" part="indeterminate-indicator-1"></span>
    `
});
/**
 * Styles for Progress
 * @public
 */

const progressStyles$1 = progressStyles;

const radioGroupStyles = (context, definition) => css` ${display("flex")} :host{align-items: flex-start;margin: calc(${designUnit} * 1px) 0;flex-direction: column}.positioning-region{display: flex;flex-wrap: wrap}:host([orientation="vertical"]) .positioning-region{flex-direction: column}:host([orientation="horizontal"]) .positioning-region{flex-direction: row}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#RadioGroup} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#radioGroupTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-radio-group\>
 */

const fastRadioGroup = RadioGroup.compose({
  baseName: "radio-group",
  template: radioGroupTemplate,
  styles: radioGroupStyles
});
/**
 * Styles for RadioGroup
 * @public
 */

const radioGroupStyles$1 = radioGroupStyles;

const radioStyles = (context, definition) => css` ${display("inline-flex")} :host{--input-size: calc((${heightNumber} / 2) + ${designUnit});align-items: center;outline: none;margin: calc(${designUnit} * 1px) 0;${
/*
 * Chromium likes to select label text or the default slot when
 * the radio button is clicked. Maybe there is a better solution here?
 */
""} user-select: none;position: relative;flex-direction: row;transition: all 0.2s ease-in-out}.control{position: relative;width: calc((${heightNumber} / 2 + ${designUnit}) * 1px);height: calc((${heightNumber} / 2 + ${designUnit}) * 1px);box-sizing: border-box;border-radius: 999px;border: calc(${strokeWidth} * 1px) solid ${neutralStrokeRest};background: ${neutralFillInputRest};outline: none;cursor: pointer}.label{font-family: ${bodyFont};color: ${neutralForegroundRest};${
/* Need to discuss with Brian how HorizontalSpacingNumber can work. https://github.com/microsoft/fast/issues/2766 */
""} padding-inline-start: calc(${designUnit} * 2px + 2px);margin-inline-end: calc(${designUnit} * 2px + 2px);cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight}}.label__hidden{display: none;visibility: hidden}.control, .checked-indicator{flex-shrink: 0}.checked-indicator{position: absolute;top: 5px;left: 5px;right: 5px;bottom: 5px;border-radius: 999px;display: inline-block;background: ${foregroundOnAccentRest};fill: ${foregroundOnAccentRest};opacity: 0;pointer-events: none}:host(:not([disabled])) .control:hover{background: ${neutralFillInputHover};border-color: ${neutralStrokeHover}}:host(:not([disabled])) .control:active{background: ${neutralFillInputActive};border-color: ${neutralStrokeActive}}:host(:${focusVisible}) .control{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}:host([aria-checked="true"]) .control{background: ${accentFillRest};border: calc(${strokeWidth} * 1px) solid ${accentFillRest}}:host([aria-checked="true"]:not([disabled])) .control:hover{background: ${accentFillHover};border: calc(${strokeWidth} * 1px) solid ${accentFillHover}}:host([aria-checked="true"]:not([disabled])) .control:hover .checked-indicator{background: ${foregroundOnAccentHover};fill: ${foregroundOnAccentHover}}:host([aria-checked="true"]:not([disabled])) .control:active{background: ${accentFillActive};border: calc(${strokeWidth} * 1px) solid ${accentFillActive}}:host([aria-checked="true"]:not([disabled])) .control:active .checked-indicator{background: ${foregroundOnAccentActive};fill: ${foregroundOnAccentActive}}:host([aria-checked="true"]:${focusVisible}:not([disabled])) .control{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}:host([disabled]) .label, :host([readonly]) .label, :host([readonly]) .control, :host([disabled]) .control{cursor: ${disabledCursor}}:host([aria-checked="true"]) .checked-indicator{opacity: 1}:host([disabled]){opacity: ${disabledOpacity}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .control, :host([aria-checked="true"]:not([disabled])) .control{forced-color-adjust: none;border-color: ${SystemColors.FieldText};background: ${SystemColors.Field}}:host(:not([disabled])) .control:hover{border-color: ${SystemColors.Highlight};background: ${SystemColors.Field}}:host([aria-checked="true"]:not([disabled])) .control:hover, :host([aria-checked="true"]:not([disabled])) .control:active{border-color: ${SystemColors.Highlight};background: ${SystemColors.Highlight}}:host([aria-checked="true"]) .checked-indicator{background: ${SystemColors.Highlight};fill: ${SystemColors.Highlight}}:host([aria-checked="true"]:not([disabled])) .control:hover .checked-indicator, :host([aria-checked="true"]:not([disabled])) .control:active .checked-indicator{background: ${SystemColors.HighlightText};fill: ${SystemColors.HighlightText}}:host(:${focusVisible}) .control{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}:host([aria-checked="true"]:${focusVisible}:not([disabled])) .control{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}:host([disabled]){forced-color-adjust: none;opacity: 1}:host([disabled]) .label{color: ${SystemColors.GrayText}}:host([disabled]) .control, :host([aria-checked="true"][disabled]) .control:hover, .control:active{background: ${SystemColors.Field};border-color: ${SystemColors.GrayText}}:host([disabled]) .checked-indicator, :host([aria-checked="true"][disabled]) .control:hover .checked-indicator{fill: ${SystemColors.GrayText};background: ${SystemColors.GrayText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Radio} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#radioTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-radio\>
 */

const fastRadio = Radio.compose({
  baseName: "radio",
  template: radioTemplate,
  styles: radioStyles,
  checkedIndicator: `
        <div part="checked-indicator" class="checked-indicator"></div>
    `
});
/**
 * Styles for Radio
 * @public
 */

const radioStyles$1 = radioStyles;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Select} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#selectTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-select\>
 *
 */

const fastSelect = Select.compose({
  baseName: "select",
  template: selectTemplate,
  styles: selectStyles,
  indicator: `
        <svg
            class="select-indicator"
            part="select-indicator"
            viewBox="0 0 12 7"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M11.85.65c.2.2.2.5 0 .7L6.4 6.84a.55.55 0 01-.78 0L.14 1.35a.5.5 0 11.71-.7L6 5.8 11.15.65c.2-.2.5-.2.7 0z"
            />
        </svg>
    `
});
/**
 * Styles for Select
 * @public
 */

const selectStyles$1 = selectStyles;

const skeletonStyles = (context, definition) => css` ${display("block")} :host{--skeleton-fill-default: #e1dfdd;overflow: hidden;width: 100%;position: relative;background-color: var(--skeleton-fill, var(--skeleton-fill-default));--skeleton-animation-gradient-default: linear-gradient( 270deg, var(--skeleton-fill, var(--skeleton-fill-default)) 0%, #f3f2f1 51.13%, var(--skeleton-fill, var(--skeleton-fill-default)) 100% );--skeleton-animation-timing-default: ease-in-out}:host([shape="rect"]){border-radius: calc(${controlCornerRadius} * 1px)}:host([shape="circle"]){border-radius: 100%;overflow: hidden}object{position: absolute;width: 100%;height: auto;z-index: 2}object img{width: 100%;height: auto}${display("block")} span.shimmer{position: absolute;width: 100%;height: 100%;background-image: var( --skeleton-animation-gradient, var(--skeleton-animation-gradient-default) );background-size: 0px 0px / 90% 100%;background-repeat: no-repeat;background-color: var(--skeleton-animation-fill, ${neutralFillRest});animation: shimmer 2s infinite;animation-timing-function: var( --skeleton-animation-timing, var(--skeleton-timing-default) );animation-direction: normal;z-index: 1}::slotted(svg){z-index: 2}::slotted(.pattern){width: 100%;height: 100%}@keyframes shimmer{0%{transform: translateX(-100%)}100%{transform: translateX(100%)}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{forced-color-adjust: none;background-color: ${SystemColors.ButtonFace};box-shadow: 0 0 0 1px ${SystemColors.ButtonText}}${display("block")} span.shimmer{display: none}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Skeleton} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#skeletonTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-skeleton\>
 */

const fastSkeleton = Skeleton.compose({
  baseName: "skeleton",
  template: skeletonTemplate,
  styles: skeletonStyles
});
/**
 * Styles for Skeleton
 * @public
 */

const skeletonStyles$1 = skeletonStyles;

const horizontalSliderStyles = css` :host{align-self: start;grid-row: 2;margin-top: -2px;height: calc((${heightNumber} / 2 + ${designUnit}) * 1px);width: auto}.container{grid-template-rows: auto auto;grid-template-columns: 0}.label{margin: 2px 0}`;
const verticalSliderStyles = css` :host{justify-self: start;grid-column: 2;margin-left: 2px;height: auto;width: calc((${heightNumber} / 2 + ${designUnit}) * 1px)}.container{grid-template-columns: auto auto;grid-template-rows: 0;min-width: calc(var(--thumb-size) * 1px);height: calc(var(--thumb-size) * 1px)}.mark{transform: rotate(90deg);align-self: center}.label{margin-left: calc((${designUnit} / 2) * 3px);align-self: center}`;
const sliderLabelStyles = (context, definition) => css` ${display("block")} :host{font-family: ${bodyFont};color: ${neutralForegroundRest};fill: currentcolor}.root{position: absolute;display: grid}.container{display: grid;justify-self: center}.label{justify-self: center;align-self: center;white-space: nowrap;max-width: 30px}.mark{width: calc((${designUnit} / 4) * 1px);height: calc(${heightNumber} * 0.25 * 1px);background: ${neutralStrokeRest};justify-self: center}:host(.disabled){opacity: ${disabledOpacity}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .mark{forced-color-adjust: none;background: ${SystemColors.FieldText}}:host(.disabled){forced-color-adjust: none;opacity: 1}:host(.disabled) .label{color: ${SystemColors.GrayText}}:host(.disabled) .mark{background: ${SystemColors.GrayText}}`));

/**
 * @internal
 */

class SliderLabel$1 extends SliderLabel {
  sliderOrientationChanged() {
    if (this.sliderOrientation === Orientation.horizontal) {
      this.$fastController.addStyles(horizontalSliderStyles);
      this.$fastController.removeStyles(verticalSliderStyles);
    } else {
      this.$fastController.addStyles(verticalSliderStyles);
      this.$fastController.removeStyles(horizontalSliderStyles);
    }
  }

}
/**
 * A function that returns a {@link @microsoft/fast-foundation#SliderLabel} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#sliderLabelTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-slider-label\>
 */

const fastSliderLabel = SliderLabel$1.compose({
  baseName: "slider-label",
  template: sliderLabelTemplate,
  styles: sliderLabelStyles
});
/**
 * Styles for SliderLabel
 * @public
 */

const sliderLabelStyles$1 = sliderLabelStyles;

const sliderStyles = (context, definition) => css` :host([hidden]){display: none}${display("inline-grid")} :host{--thumb-size: calc(${heightNumber} * 0.5 - ${designUnit});--thumb-translate: calc(var(--thumb-size) * 0.5);--track-overhang: calc((${designUnit} / 2) * -1);--track-width: ${designUnit};--fast-slider-height: calc(var(--thumb-size) * 10);align-items: center;width: 100%;margin: calc(${designUnit} * 1px) 0;user-select: none;box-sizing: border-box;border-radius: calc(${controlCornerRadius} * 1px);outline: none;cursor: pointer}:host([orientation="horizontal"]) .positioning-region{position: relative;margin: 0 8px;display: grid;grid-template-rows: calc(var(--thumb-size) * 1px) 1fr}:host([orientation="vertical"]) .positioning-region{position: relative;margin: 0 8px;display: grid;height: 100%;grid-template-columns: calc(var(--thumb-size) * 1px) 1fr}:host(:${focusVisible}) .thumb-cursor{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}.thumb-container{position: absolute;height: calc(var(--thumb-size) * 1px);width: calc(var(--thumb-size) * 1px);transition: all 0.2s ease;color: ${neutralForegroundRest};fill: currentcolor}.thumb-cursor{border: none;width: calc(var(--thumb-size) * 1px);height: calc(var(--thumb-size) * 1px);background: ${neutralForegroundRest};border-radius: calc(${controlCornerRadius} * 1px)}.thumb-cursor:hover{background: ${neutralForegroundRest};border-color: ${neutralStrokeHover}}.thumb-cursor:active{background: ${neutralForegroundRest}}:host([orientation="horizontal"]) .thumb-container{transform: translateX(calc(var(--thumb-translate) * 1px))}:host([orientation="vertical"]) .thumb-container{transform: translateY(calc(var(--thumb-translate) * 1px))}:host([orientation="horizontal"]){min-width: calc(var(--thumb-size) * 1px)}:host([orientation="horizontal"]) .track{right: calc(var(--track-overhang) * 1px);left: calc(var(--track-overhang) * 1px);align-self: start;margin-top: calc((${designUnit} + calc(${density} + 2)) * 1px);height: calc(var(--track-width) * 1px)}:host([orientation="vertical"]) .track{top: calc(var(--track-overhang) * 1px);bottom: calc(var(--track-overhang) * 1px);width: calc(var(--track-width) * 1px);margin-inline-start: calc((${designUnit} + calc(${density} + 2)) * 1px);height: 100%}.track{background: ${neutralStrokeRest};position: absolute;border-radius: calc(${controlCornerRadius} * 1px)}:host([orientation="vertical"]){height: calc(var(--fast-slider-height) * 1px);min-height: calc(var(--thumb-size) * 1px);min-width: calc(${designUnit} * 20px)}:host([disabled]), :host([readonly]){cursor: ${disabledCursor}}:host([disabled]){opacity: ${disabledOpacity}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .thumb-cursor{forced-color-adjust: none;border-color: ${SystemColors.FieldText};background: ${SystemColors.FieldText}}.thumb-cursor:hover, .thumb-cursor:active{background: ${SystemColors.Highlight}}.track{forced-color-adjust: none;background: ${SystemColors.FieldText}}:host(:${focusVisible}) .thumb-cursor{border-color: ${SystemColors.Highlight}}:host([disabled]){opacity: 1}:host([disabled]) .track, :host([disabled]) .thumb-cursor{forced-color-adjust: none;background: ${SystemColors.GrayText}}:host(:${focusVisible}) .thumb-cursor{background: ${SystemColors.Highlight};border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Slider} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#sliderTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-slider\>
 */

const fastSlider = Slider.compose({
  baseName: "slider",
  template: sliderTemplate,
  styles: sliderStyles,
  thumb: `
        <div class="thumb-cursor"></div>
    `
});
/**
 * Styles for Slider
 * @public
 */

const sliderStyles$1 = sliderStyles;

const switchStyles = (context, definition) => css` :host([hidden]){display: none}${display("inline-flex")} :host{align-items: center;outline: none;font-family: ${bodyFont};margin: calc(${designUnit} * 1px) 0;${
/*
 * Chromium likes to select label text or the default slot when
 * the checkbox is clicked. Maybe there is a better solution here?
 */
""} user-select: none}:host([disabled]){opacity: ${disabledOpacity}}:host([disabled]) .label, :host([readonly]) .label, :host([readonly]) .switch, :host([disabled]) .switch{cursor: ${disabledCursor}}.switch{position: relative;outline: none;box-sizing: border-box;width: calc(${heightNumber} * 1px);height: calc((${heightNumber} / 2 + ${designUnit}) * 1px);background: ${neutralFillInputRest};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${neutralStrokeRest}}.switch:hover{background: ${neutralFillInputHover};border-color: ${neutralStrokeHover};cursor: pointer}host([disabled]) .switch:hover, host([readonly]) .switch:hover{background: ${neutralFillInputHover};border-color: ${neutralStrokeHover};cursor: ${disabledCursor}}:host(:not([disabled])) .switch:active{background: ${neutralFillInputActive};border-color: ${neutralStrokeActive}}:host(:${focusVisible}) .switch{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}.checked-indicator{position: absolute;top: 5px;bottom: 5px;background: ${neutralForegroundRest};border-radius: calc(${controlCornerRadius} * 1px);transition: all 0.2s ease-in-out}.status-message{color: ${neutralForegroundRest};cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight}}:host([disabled]) .status-message, :host([readonly]) .status-message{cursor: ${disabledCursor}}.label{color: ${neutralForegroundRest};${
/* Need to discuss with Brian how HorizontalSpacingNumber can work. https://github.com/microsoft/fast/issues/2766 */
""} margin-inline-end: calc(${designUnit} * 2px + 2px);font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};cursor: pointer}.label__hidden{display: none;visibility: hidden}::slotted(*){${
/* Need to discuss with Brian how HorizontalSpacingNumber can work. https://github.com/microsoft/fast/issues/2766 */
""} margin-inline-start: calc(${designUnit} * 2px + 2px)}:host([aria-checked="true"]) .checked-indicator{background: ${foregroundOnAccentRest}}:host([aria-checked="true"]) .switch{background: ${accentFillRest};border-color: ${accentFillRest}}:host([aria-checked="true"]:not([disabled])) .switch:hover{background: ${accentFillHover};border-color: ${accentFillHover}}:host([aria-checked="true"]:not([disabled])) .switch:hover .checked-indicator{background: ${foregroundOnAccentHover}}:host([aria-checked="true"]:not([disabled])) .switch:active{background: ${accentFillActive};border-color: ${accentFillActive}}:host([aria-checked="true"]:not([disabled])) .switch:active .checked-indicator{background: ${foregroundOnAccentActive}}:host([aria-checked="true"]:${focusVisible}:not([disabled])) .switch{box-shadow: 0 0 0 2px ${fillColor}, 0 0 0 4px ${focusStrokeOuter$1}}.unchecked-message{display: block}.checked-message{display: none}:host([aria-checked="true"]) .unchecked-message{display: none}:host([aria-checked="true"]) .checked-message{display: block}`.withBehaviors(forcedColorsStylesheetBehavior(css` .checked-indicator, :host(:not([disabled])) .switch:active .checked-indicator{forced-color-adjust: none;background: ${SystemColors.FieldText}}.switch{forced-color-adjust: none;background: ${SystemColors.Field};border-color: ${SystemColors.FieldText}}:host(:not([disabled])) .switch:hover{background: ${SystemColors.HighlightText};border-color: ${SystemColors.Highlight}}:host([aria-checked="true"]) .switch{background: ${SystemColors.Highlight};border-color: ${SystemColors.Highlight}}:host([aria-checked="true"]:not([disabled])) .switch:hover, :host(:not([disabled])) .switch:active{background: ${SystemColors.HighlightText};border-color: ${SystemColors.Highlight}}:host([aria-checked="true"]) .checked-indicator{background: ${SystemColors.HighlightText}}:host([aria-checked="true"]:not([disabled])) .switch:hover .checked-indicator{background: ${SystemColors.Highlight}}:host([disabled]){opacity: 1}:host(:${focusVisible}) .switch{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}:host([aria-checked="true"]:${focusVisible}:not([disabled])) .switch{box-shadow: 0 0 0 2px ${SystemColors.Field}, 0 0 0 4px ${SystemColors.FieldText}}:host([disabled]) .checked-indicator{background: ${SystemColors.GrayText}}:host([disabled]) .switch{background: ${SystemColors.Field};border-color: ${SystemColors.GrayText}}`), new DirectionalStyleSheetBehavior(css` .checked-indicator{left: 5px;right: calc(((${heightNumber} / 2) + 1) * 1px)}:host([aria-checked="true"]) .checked-indicator{left: calc(((${heightNumber} / 2) + 1) * 1px);right: 5px}`, css` .checked-indicator{right: 5px;left: calc(((${heightNumber} / 2) + 1) * 1px)}:host([aria-checked="true"]) .checked-indicator{right: calc(((${heightNumber} / 2) + 1) * 1px);left: 5px}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Switch} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#switchTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-switch\>
 */

const fastSwitch = Switch.compose({
  baseName: "switch",
  template: switchTemplate,
  styles: switchStyles,
  switch: `
        <span class="checked-indicator" part="checked-indicator"></span>
    `
});
/**
 * Styles for Switch
 * @public
 */

const switchStyles$1 = switchStyles;

const tabsStyles = (context, definition) => css` ${display("grid")} :host{box-sizing: border-box;font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};color: ${neutralForegroundRest};grid-template-columns: auto 1fr auto;grid-template-rows: auto 1fr}.tablist{display: grid;grid-template-rows: auto auto;grid-template-columns: auto;position: relative;width: max-content;align-self: end;padding: calc(${designUnit} * 4px) calc(${designUnit} * 4px) 0;box-sizing: border-box}.start, .end{align-self: center}.activeIndicator{grid-row: 2;grid-column: 1;width: 100%;height: 5px;justify-self: center;background: ${accentFillRest};margin-top: 10px;border-radius: calc(${controlCornerRadius} * 1px) calc(${controlCornerRadius} * 1px) 0 0}.activeIndicatorTransition{transition: transform 0.2s ease-in-out}.tabpanel{grid-row: 2;grid-column-start: 1;grid-column-end: 4;position: relative}:host([orientation="vertical"]){grid-template-rows: auto 1fr auto;grid-template-columns: auto 1fr}:host([orientation="vertical"]) .tablist{grid-row-start: 2;grid-row-end: 2;display: grid;grid-template-rows: auto;grid-template-columns: auto 1fr;position: relative;width: max-content;justify-self: end;width: 100%;padding: calc((${heightNumber} - ${designUnit}) * 1px) calc(${designUnit} * 4px) calc((${heightNumber} - ${designUnit}) * 1px) 0}:host([orientation="vertical"]) .tabpanel{grid-column: 2;grid-row-start: 1;grid-row-end: 4}:host([orientation="vertical"]) .end{grid-row: 3}:host([orientation="vertical"]) .activeIndicator{grid-column: 1;grid-row: 1;width: 5px;height: 100%;margin-inline-end: 10px;align-self: center;background: ${accentFillRest};margin-top: 0;border-radius: 0 calc(${controlCornerRadius} * 1px) calc(${controlCornerRadius} * 1px) 0}:host([orientation="vertical"]) .activeIndicatorTransition{transition: transform 0.2s linear}`.withBehaviors(forcedColorsStylesheetBehavior(css` .activeIndicator, :host([orientation="vertical"]) .activeIndicator{forced-color-adjust: none;background: ${SystemColors.Highlight}}`));

const tabStyles = (context, definition) => css` ${display("inline-flex")} :host{box-sizing: border-box;font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};height: calc(${heightNumber} * 1px);padding: calc(${designUnit} * 5px) calc(${designUnit} * 4px);color: ${neutralForegroundHint$1};fill: currentcolor;border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid transparent;align-items: center;justify-content: center;grid-row: 1;cursor: pointer}:host(:hover){color: ${neutralForegroundRest};fill: currentcolor}:host(:active){color: ${neutralForegroundRest};fill: currentcolor}:host([disabled]){cursor: ${disabledCursor};opacity: ${disabledOpacity}}:host([disabled]:hover){color: ${neutralForegroundHint$1};background: ${neutralFillStealthRest}}:host([aria-selected="true"]){background: ${neutralFillRest};color: ${accentForegroundRest};fill: currentcolor}:host([aria-selected="true"]:hover){background: ${neutralFillHover};color: ${accentForegroundHover};fill: currentcolor}:host([aria-selected="true"]:active){background: ${neutralFillActive};color: ${accentForegroundActive};fill: currentcolor}:host(:${focusVisible}){outline: none;border: calc(${strokeWidth} * 1px) solid ${focusStrokeOuter$1};box-shadow: 0 0 0 calc((${focusStrokeWidth} - ${strokeWidth}) * 1px) ${focusStrokeOuter$1}}:host(:focus){outline: none}:host(.vertical){justify-content: end;grid-column: 2}:host(.vertical[aria-selected="true"]){z-index: 2}:host(.vertical:hover){color: ${neutralForegroundRest}}:host(.vertical:active){color: ${neutralForegroundRest}}:host(.vertical:hover[aria-selected="true"]){}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{forced-color-adjust: none;border-color: transparent;color: ${SystemColors.ButtonText};fill: currentcolor}:host(:hover), :host(.vertical:hover), :host([aria-selected="true"]:hover){background: ${SystemColors.Highlight};color: ${SystemColors.HighlightText};fill: currentcolor}:host([aria-selected="true"]){background: ${SystemColors.HighlightText};color: ${SystemColors.Highlight};fill: currentcolor}:host(:${focusVisible}){border-color: ${SystemColors.ButtonText};box-shadow: none}:host([disabled]), :host([disabled]:hover){opacity: 1;color: ${SystemColors.GrayText};background: ${SystemColors.ButtonFace}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Tab} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#tabTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-tab\>
 */

const fastTab = Tab.compose({
  baseName: "tab",
  template: tabTemplate,
  styles: tabStyles
});
/**
 * Styles for Tab
 * @public
 */

const tabStyles$1 = tabStyles;

const tabPanelStyles = (context, definition) => css` ${display("flex")} :host{box-sizing: border-box;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};padding: 0 calc((6 + (${designUnit} * 2 * ${density})) * 1px)}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#TabPanel} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#tabPanelTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-tab-panel\>
 */

const fastTabPanel = TabPanel.compose({
  baseName: "tab-panel",
  template: tabPanelTemplate,
  styles: tabPanelStyles
});
/**
 * Styles for TabPanel
 * @public
 */

const tabPanelStyles$1 = tabPanelStyles;

/**
 * A function that returns a {@link @microsoft/fast-foundation#Tabs} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#tabsTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-tabs\>
 */

const fastTabs = Tabs.compose({
  baseName: "tabs",
  template: tabsTemplate,
  styles: tabsStyles
});
/**
 * Styles for Tabs
 * @public
 */

const tabsStyles$1 = tabsStyles;

const textAreaStyles = (context, definition) => css` ${display("inline-block")} :host{font-family: ${bodyFont};outline: none;user-select: none}.control{box-sizing: border-box;position: relative;color: ${neutralForegroundRest};background: ${neutralFillInputRest};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${accentFillRest};height: calc(${heightNumber} * 2px);font: inherit;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};padding: calc(${designUnit} * 2px + 1px);width: 100%;resize: none}.control:hover:enabled{background: ${neutralFillInputHover};border-color: ${accentFillHover}}.control:active:enabled{background: ${neutralFillInputActive};border-color: ${accentFillActive}}.control:hover, .control:${focusVisible}, .control:disabled, .control:active{outline: none}:host(:focus-within) .control{border-color: ${focusStrokeOuter$1};box-shadow: 0 0 0 1px ${focusStrokeOuter$1} inset}:host([appearance="filled"]) .control{background: ${neutralFillRest}}:host([appearance="filled"]:hover:not([disabled])) .control{background: ${neutralFillHover}}:host([resize="both"]) .control{resize: both}:host([resize="horizontal"]) .control{resize: horizontal}:host([resize="vertical"]) .control{resize: vertical}.label{display: block;color: ${neutralForegroundRest};cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};margin-bottom: 4px}.label__hidden{display: none;visibility: hidden}:host([disabled]) .label, :host([readonly]) .label, :host([readonly]) .control, :host([disabled]) .control{cursor: ${disabledCursor}}:host([disabled]){opacity: ${disabledOpacity}}:host([disabled]) .control{border-color: ${neutralStrokeRest}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([disabled]){opacity: 1}`));

/**
 * @internal
 */

class TextArea$1 extends TextArea {
  /**
   * @internal
   */
  connectedCallback() {
    super.connectedCallback();

    if (!this.appearance) {
      this.appearance = "outline";
    }
  }

}

__decorate$1([attr], TextArea$1.prototype, "appearance", void 0);
/**
 * A function that returns a {@link @microsoft/fast-foundation#TextArea} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#textAreaTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-text-area\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */


const fastTextArea = TextArea$1.compose({
  baseName: "text-area",
  template: textAreaTemplate,
  styles: textAreaStyles,
  shadowOptions: {
    delegatesFocus: true
  }
});
/**
 * Styles for TextArea
 * @public
 */

const textAreaStyles$1 = textAreaStyles;

const textFieldStyles = (context, definition) => css` ${display("inline-block")} :host{font-family: ${bodyFont};outline: none;user-select: none}.root{box-sizing: border-box;position: relative;display: flex;flex-direction: row;color: ${neutralForegroundRest};background: ${neutralFillInputRest};border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${accentFillRest};height: calc(${heightNumber} * 1px)}.control{-webkit-appearance: none;font: inherit;background: transparent;border: 0;color: inherit;height: calc(100% - 4px);width: 100%;margin-top: auto;margin-bottom: auto;border: none;padding: 0 calc(${designUnit} * 2px + 1px);font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight}}.control:hover, .control:${focusVisible}, .control:disabled, .control:active{outline: none}.label{display: block;color: ${neutralForegroundRest};cursor: pointer;font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};margin-bottom: 4px}.label__hidden{display: none;visibility: hidden}.start, .end{margin: auto;fill: currentcolor}::slotted(svg){${
/* Glyph size and margin-left is temporary -
replace when adaptive typography is figured out */
""} width: 16px;height: 16px}.start{margin-inline-start: 11px}.end{margin-inline-end: 11px}:host(:hover:not([disabled])) .root{background: ${neutralFillInputHover};border-color: ${accentFillHover}}:host(:active:not([disabled])) .root{background: ${neutralFillInputHover};border-color: ${accentFillActive}}:host(:focus-within:not([disabled])) .root{border-color: ${focusStrokeOuter$1};box-shadow: 0 0 0 1px ${focusStrokeOuter$1} inset}:host([appearance="filled"]) .root{background: ${neutralFillRest}}:host([appearance="filled"]:hover:not([disabled])) .root{background: ${neutralFillHover}}:host([disabled]) .label, :host([readonly]) .label, :host([readonly]) .control, :host([disabled]) .control{cursor: ${disabledCursor}}:host([disabled]){opacity: ${disabledOpacity}}:host([disabled]) .control{border-color: ${neutralStrokeRest}}`.withBehaviors(forcedColorsStylesheetBehavior(css` .root, :host([appearance="filled"]) .root{forced-color-adjust: none;background: ${SystemColors.Field};border-color: ${SystemColors.FieldText}}:host(:hover:not([disabled])) .root, :host([appearance="filled"]:hover:not([disabled])) .root, :host([appearance="filled"]:hover) .root{background: ${SystemColors.Field};border-color: ${SystemColors.Highlight}}.start, .end{fill: currentcolor}:host([disabled]){opacity: 1}:host([disabled]) .root, :host([appearance="filled"]:hover[disabled]) .root{border-color: ${SystemColors.GrayText};background: ${SystemColors.Field}}:host(:focus-within:enabled) .root{border-color: ${SystemColors.Highlight};box-shadow: 0 0 0 1px ${SystemColors.Highlight} inset}input::placeholder{color: ${SystemColors.GrayText}}`));

/**
 * @internal
 */

class TextField$1 extends TextField {
  /**
   * @internal
   */
  connectedCallback() {
    super.connectedCallback();

    if (!this.appearance) {
      this.appearance = "outline";
    }
  }

}

__decorate$1([attr], TextField$1.prototype, "appearance", void 0);
/**
 * A function that returns a {@link @microsoft/fast-foundation#TextField} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#textFieldTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-text-field\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */


const fastTextField = TextField$1.compose({
  baseName: "text-field",
  template: textFieldTemplate,
  styles: textFieldStyles,
  shadowOptions: {
    delegatesFocus: true
  }
});
/**
 * Styles for TextField
 * @public
 */

const textFieldStyles$1 = textFieldStyles;

/**
 * Styles for the {@link (FASTToolbar:class)|FASTToolbar component}.
 *
 * @public
 */

const toolbarStyles = (context, definition) => css` ${display("inline-flex")} :host{--toolbar-item-gap: calc( (var(--design-unit) + calc(var(--density) + 2)) * 1px );background-color: ${fillColor};border-radius: calc(${controlCornerRadius} * 1px);fill: currentcolor;padding: var(--toolbar-item-gap)}:host(${focusVisible}){outline: calc(${strokeWidth} * 1px) solid ${neutralStrokeFocus}}.positioning-region{align-items: flex-start;display: inline-flex;flex-flow: row wrap;justify-content: flex-start}:host([orientation="vertical"]) .positioning-region{flex-direction: column}::slotted(:not([slot])){flex: 0 0 auto;margin: 0 var(--toolbar-item-gap)}:host([orientation="vertical"]) ::slotted(:not([slot])){margin: var(--toolbar-item-gap) 0}.start, .end{display: flex;margin: auto;margin-inline: 0}::slotted(svg){${
/* Glyph size is temporary - replace when adaptive typography is figured out */
""} width: 16px;height: 16px}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host(:${focusVisible}){box-shadow: 0 0 0 calc(${focusStrokeWidth} * 1px) ${SystemColors.Highlight};color: ${SystemColors.ButtonText};forced-color-adjust: none}`));

/**
 * @internal
 */

class Toolbar$1 extends Toolbar {
  connectedCallback() {
    super.connectedCallback();
    const parent = composedParent(this);

    if (parent) {
      fillColor.setValueFor(this, target => neutralFillLayerRecipe.getValueFor(target).evaluate(target, fillColor.getValueFor(parent)));
    }
  }

}
/**
 * A function that returns a {@link @microsoft/fast-foundation#Toolbar} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#ToolbarTemplate}
 *
 * @public
 * @remarks
 *
 * Generates HTML Element: \<fast-toolbar\>
 *
 */

const fastToolbar = Toolbar$1.compose({
  baseName: "toolbar",
  template: toolbarTemplate,
  styles: toolbarStyles,
  shadowOptions: {
    delegatesFocus: true
  }
});
/**
 * Styles for Toolbar.
 * @public
 */

const toolbarStyles$1 = toolbarStyles;

const tooltipStyles = (context, definition) => css` :host{contain: layout;overflow: visible;height: 0;width: 0}.tooltip{box-sizing: border-box;border-radius: calc(${controlCornerRadius} * 1px);border: calc(${strokeWidth} * 1px) solid ${focusStrokeOuter$1};box-shadow: 0 0 0 1px ${focusStrokeOuter$1} inset;background: ${neutralFillRest};color: ${neutralForegroundRest};padding: 4px;height: fit-content;width: fit-content;font-family: ${bodyFont};font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};white-space: nowrap;${
/* TODO: a mechanism to manage z-index across components
https://github.com/microsoft/fast/issues/3813 */
""} z-index: 10000}fast-anchored-region{display: flex;justify-content: center;align-items: center;overflow: visible;flex-direction: row}fast-anchored-region.right, fast-anchored-region.left{flex-direction: column}fast-anchored-region.top .tooltip{margin-bottom: 4px}fast-anchored-region.bottom .tooltip{margin-top: 4px}fast-anchored-region.left .tooltip{margin-right: 4px}fast-anchored-region.right .tooltip{margin-left: 4px}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host([disabled]){opacity: 1}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#Tooltip} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#tooltipTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-tooltip\>
 */

const fastTooltip = Tooltip.compose({
  baseName: "tooltip",
  template: tooltipTemplate,
  styles: tooltipStyles
});

const ltr$1 = css` .expand-collapse-glyph{transform: rotate(0deg)}:host(.nested) .expand-collapse-button{left: var(--expand-collapse-button-nested-width, calc(${heightNumber} * -1px))}:host([selected])::after{left: calc(${focusStrokeWidth} * 1px)}:host([expanded]) > .positioning-region .expand-collapse-glyph{transform: rotate(45deg)}`;
const rtl$1 = css` .expand-collapse-glyph{transform: rotate(180deg)}:host(.nested) .expand-collapse-button{right: var(--expand-collapse-button-nested-width, calc(${heightNumber} * -1px))}:host([selected])::after{right: calc(${focusStrokeWidth} * 1px)}:host([expanded]) > .positioning-region .expand-collapse-glyph{transform: rotate(135deg)}`;
const expandCollapseButtonSize = cssPartial`((${baseHeightMultiplier} / 2) * ${designUnit}) + ((${designUnit} * ${density}) / 2)`;
const expandCollapseHoverBehavior = DesignToken.create("tree-item-expand-collapse-hover").withDefault(target => {
  const recipe = neutralFillStealthRecipe.getValueFor(target);
  return recipe.evaluate(target, recipe.evaluate(target).hover).hover;
});
const selectedExpandCollapseHoverBehavior = DesignToken.create("tree-item-expand-collapse-selected-hover").withDefault(target => {
  const baseRecipe = neutralFillRecipe.getValueFor(target);
  const buttonRecipe = neutralFillStealthRecipe.getValueFor(target);
  return buttonRecipe.evaluate(target, baseRecipe.evaluate(target).rest).hover;
});
const treeItemStyles = (context, definition) => css` ${display("block")} :host{contain: content;position: relative;outline: none;color: ${neutralForegroundRest};background: ${neutralFillStealthRest};cursor: pointer;font-family: ${bodyFont};--expand-collapse-button-size: calc(${heightNumber} * 1px);--tree-item-nested-width: 0}:host(:focus) > .positioning-region{outline: none}:host(:focus) .content-region{outline: none}:host(:${focusVisible}) .positioning-region{border: ${focusStrokeOuter$1} calc(${strokeWidth} * 1px) solid;border-radius: calc(${controlCornerRadius} * 1px);color: ${neutralForegroundRest}}.positioning-region{display: flex;position: relative;box-sizing: border-box;border: transparent calc(${strokeWidth} * 1px) solid;height: calc((${heightNumber} + 1) * 1px)}.positioning-region::before{content: "";display: block;width: var(--tree-item-nested-width);flex-shrink: 0}.positioning-region:hover{background: ${neutralFillStealthHover}}.positioning-region:active{background: ${neutralFillStealthActive}}.content-region{display: inline-flex;align-items: center;white-space: nowrap;width: 100%;height: calc(${heightNumber} * 1px);margin-inline-start: calc(${designUnit} * 2px + 8px);font-size: ${typeRampBaseFontSize};line-height: ${typeRampBaseLineHeight};font-weight: 400}.items{display: none;${
/* Font size should be based off calc(1em + (design-unit + glyph-size-number) * 1px) -
update when density story is figured out */
""} font-size: calc(1em + (${designUnit} + 16) * 1px)}.expand-collapse-button{background: none;border: none;outline: none;${
/* Width and Height should be based off calc(glyph-size-number + (design-unit * 4) * 1px) -
update when density story is figured out */
""} width: calc((${expandCollapseButtonSize} + (${designUnit} * 2)) * 1px);height: calc((${expandCollapseButtonSize} + (${designUnit} * 2)) * 1px);padding: 0;display: flex;justify-content: center;align-items: center;cursor: pointer;margin-left: 6px;margin-right: 6px}.expand-collapse-glyph{${
/* Glyph size is temporary -
replace when glyph-size var is added */
""} width: 16px;height: 16px;transition: transform 0.1s linear;pointer-events: none;fill: currentcolor}.start, .end{display: flex;fill: currentcolor}::slotted(svg){${
/* Glyph size is temporary -
replace when glyph-size var is added */
""} width: 16px;height: 16px}.start{${
/* need to swap out once we understand how horizontalSpacing will work */
""} margin-inline-end: calc(${designUnit} * 2px + 2px)}.end{${
/* need to swap out once we understand how horizontalSpacing will work */
""} margin-inline-start: calc(${designUnit} * 2px + 2px)}:host([expanded]) > .items{display: block}:host([disabled]) .content-region{opacity: ${disabledOpacity};cursor: ${disabledCursor}}:host(.nested) .content-region{position: relative;margin-inline-start: var(--expand-collapse-button-size)}:host(.nested) .expand-collapse-button{position: absolute}:host(.nested) .expand-collapse-button:hover{background: ${expandCollapseHoverBehavior}}:host([selected]) .positioning-region{background: ${neutralFillRest}}:host([selected]) .expand-collapse-button:hover{background: ${selectedExpandCollapseHoverBehavior}}:host([selected])::after{content: "";display: block;position: absolute;top: calc((${heightNumber} / 4) * 1px);width: 3px;height: calc((${heightNumber} / 2) * 1px);${
/* The french fry background needs to be calculated based on the selected background state for this control.
We currently have no way of changing that, so setting to accent-foreground-rest for the time being */
""} background: ${accentForegroundRest};border-radius: calc(${controlCornerRadius} * 1px)}::slotted(fast-tree-item){--tree-item-nested-width: 1em;--expand-collapse-button-nested-width: calc(${heightNumber} * -1px)}`.withBehaviors(new DirectionalStyleSheetBehavior(ltr$1, rtl$1), forcedColorsStylesheetBehavior(css` :host{forced-color-adjust: none;border-color: transparent;background: ${SystemColors.Field};color: ${SystemColors.FieldText}}:host .content-region .expand-collapse-glyph{fill: ${SystemColors.FieldText}}:host .positioning-region:hover, :host([selected]) .positioning-region{background: ${SystemColors.Highlight}}:host .positioning-region:hover .content-region, :host([selected]) .positioning-region .content-region{color: ${SystemColors.HighlightText}}:host .positioning-region:hover .content-region .expand-collapse-glyph, :host .positioning-region:hover .content-region .start, :host .positioning-region:hover .content-region .end, :host([selected]) .content-region .expand-collapse-glyph, :host([selected]) .content-region .start, :host([selected]) .content-region .end{fill: ${SystemColors.HighlightText}}:host([selected])::after{background: ${SystemColors.Field}}:host(:${focusVisible}) .positioning-region{border-color: ${SystemColors.FieldText};box-shadow: 0 0 0 2px inset ${SystemColors.Field};color: ${SystemColors.FieldText}}:host([disabled]) .content-region, :host([disabled]) .positioning-region:hover .content-region{opacity: 1;color: ${SystemColors.GrayText}}:host([disabled]) .content-region .expand-collapse-glyph, :host([disabled]) .content-region .start, :host([disabled]) .content-region .end, :host([disabled]) .positioning-region:hover .content-region .expand-collapse-glyph, :host([disabled]) .positioning-region:hover .content-region .start, :host([disabled]) .positioning-region:hover .content-region .end{fill: ${SystemColors.GrayText}}:host([disabled]) .positioning-region:hover{background: ${SystemColors.Field}}.expand-collapse-glyph, .start, .end{fill: ${SystemColors.FieldText}}:host(.nested) .expand-collapse-button:hover{background: ${SystemColors.Field}}:host(.nested) .expand-collapse-button:hover .expand-collapse-glyph{fill: ${SystemColors.FieldText}}`));

/**
 * A function that returns a {@link @microsoft/fast-foundation#TreeItem} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#treeItemTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-tree-item\>
 *
 */

const fastTreeItem = TreeItem.compose({
  baseName: "tree-item",
  template: treeItemTemplate,
  styles: treeItemStyles,
  expandCollapseGlyph: `
        <svg
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            class="expand-collapse-glyph"
        >
            <path
                d="M5.00001 12.3263C5.00124 12.5147 5.05566 12.699 5.15699 12.8578C5.25831 13.0167 5.40243 13.1437 5.57273 13.2242C5.74304 13.3047 5.9326 13.3354 6.11959 13.3128C6.30659 13.2902 6.4834 13.2152 6.62967 13.0965L10.8988 8.83532C11.0739 8.69473 11.2153 8.51658 11.3124 8.31402C11.4096 8.11146 11.46 7.88966 11.46 7.66499C11.46 7.44033 11.4096 7.21853 11.3124 7.01597C11.2153 6.81341 11.0739 6.63526 10.8988 6.49467L6.62967 2.22347C6.48274 2.10422 6.30501 2.02912 6.11712 2.00691C5.92923 1.9847 5.73889 2.01628 5.56823 2.09799C5.39757 2.17969 5.25358 2.30817 5.153 2.46849C5.05241 2.62882 4.99936 2.8144 5.00001 3.00369V12.3263Z"
            />
        </svg>
    `
});
/**
 * Styles for TreeItem
 * @public
 */

const treeItemStyles$1 = treeItemStyles;

const treeViewStyles = (context, definition) => css` :host([hidden]){display: none}${display("flex")} :host{flex-direction: column;align-items: stretch;min-width: fit-content;font-size: 0}:host:focus-visible{outline: none}`;

/**
 * A function that returns a {@link @microsoft/fast-foundation#TreeView} registration for configuring the component with a DesignSystem.
 * Implements {@link @microsoft/fast-foundation#treeViewTemplate}
 *
 *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-tree-view\>
 *
 */

const fastTreeView = TreeView.compose({
  baseName: "tree-view",
  template: treeViewTemplate,
  styles: treeViewStyles
});
/**
 * Styles for TreeView
 * @public
 */

const treeViewStyles$1 = treeViewStyles;

/**
 * Export all custom element definitions
 */
/**
 * All Web Components
 * @public
 */

const allComponents = {
  fastAccordion,
  fastAccordionItem,
  fastAnchor,
  fastAnchoredRegion,
  fastAvatar,
  fastBadge,
  fastBreadcrumb,
  fastBreadcrumbItem,
  fastButton,
  fastCard,
  fastCheckbox,
  fastCombobox,
  fastDataGrid,
  fastDataGridCell,
  fastDataGridRow,
  fastDialog,
  fastDisclosure,
  fastDivider,
  fastFlipper,
  fastHorizontalScroll,
  fastListbox,
  fastOption,
  fastMenu,
  fastMenuItem,
  fastNumberField,
  fastProgress,
  fastProgressRing,
  fastRadio,
  fastRadioGroup,
  fastSelect,
  fastSkeleton,
  fastSlider,
  fastSliderLabel,
  fastSwitch,
  fastTabs,
  fastTab,
  fastTabPanel,
  fastTextArea,
  fastTextField,
  fastTooltip,
  fastToolbar,
  fastTreeView,
  fastTreeItem
};

/**
 * A {@link ValueConverter} that converts to and from `Swatch` values.
 * @remarks
 * This converter allows for colors represented as string hex values, returning `null` if the
 * input was `null` or `undefined`.
 * @internal
 */

const swatchConverter = {
  toView(value) {
    var _a;

    if (value === null || value === undefined) {
      return null;
    }

    return (_a = value) === null || _a === void 0 ? void 0 : _a.toColorString();
  },

  fromView(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const color = parseColorHexRGB(value);
    return color ? SwatchRGB.create(color.r, color.g, color.b) : null;
  }

};
const backgroundStyles = css` :host{background-color: ${fillColor};color: ${neutralForegroundRest}}`.withBehaviors(forcedColorsStylesheetBehavior(css` :host{background-color: ${SystemColors.ButtonFace};box-shadow: 0 0 0 1px ${SystemColors.CanvasText};color: ${SystemColors.ButtonText}}`));

function designToken(token) {
  return (source, key) => {
    source[key + "Changed"] = function (prev, next) {
      if (next !== undefined && next !== null) {
        token.setValueFor(this, next);
      } else {
        token.deleteValueFor(this);
      }
    };
  };
}
/**
 * The FAST DesignSystemProvider Element.
 * @public
 */


class DesignSystemProvider extends FoundationElement {
  constructor() {
    super();
    /**
     * Used to instruct the FASTDesignSystemProvider
     * that it should not set the CSS
     * background-color and color properties
     *
     * @remarks
     * HTML boolean attribute: no-paint
     */

    this.noPaint = false; // If fillColor changes or is removed, we need to
    // re-evaluate whether we should have paint styles applied

    Observable.getNotifier(this).subscribe({
      handleChange: this.noPaintChanged.bind(this)
    }, "fillColor");
  }

  noPaintChanged() {
    if (!this.noPaint && this.fillColor !== void 0) {
      this.$fastController.addStyles(backgroundStyles);
    } else {
      this.$fastController.removeStyles(backgroundStyles);
    }
  }

}

__decorate$1([attr({
  attribute: "no-paint",
  mode: "boolean"
})], DesignSystemProvider.prototype, "noPaint", void 0);

__decorate$1([attr({
  attribute: "fill-color",
  converter: swatchConverter
}), designToken(fillColor)], DesignSystemProvider.prototype, "fillColor", void 0);

__decorate$1([observable, designToken(neutralPalette)], DesignSystemProvider.prototype, "neutralPalette", void 0);

__decorate$1([observable, designToken(accentPalette)], DesignSystemProvider.prototype, "accentPalette", void 0);

__decorate$1([attr({
  converter: nullableNumberConverter
}), designToken(density)], DesignSystemProvider.prototype, "density", void 0);

__decorate$1([attr({
  attribute: "design-unit",
  converter: nullableNumberConverter
}), designToken(designUnit)], DesignSystemProvider.prototype, "designUnit", void 0);

__decorate$1([attr({
  attribute: "direction"
}), designToken(direction)], DesignSystemProvider.prototype, "direction", void 0);

__decorate$1([attr({
  attribute: "base-height-multiplier",
  converter: nullableNumberConverter
}), designToken(baseHeightMultiplier)], DesignSystemProvider.prototype, "baseHeightMultiplier", void 0);

__decorate$1([attr({
  attribute: "base-horizontal-spacing-multiplier",
  converter: nullableNumberConverter
}), designToken(baseHorizontalSpacingMultiplier)], DesignSystemProvider.prototype, "baseHorizontalSpacingMultiplier", void 0);

__decorate$1([attr({
  attribute: "control-corner-radius",
  converter: nullableNumberConverter
}), designToken(controlCornerRadius)], DesignSystemProvider.prototype, "controlCornerRadius", void 0);

__decorate$1([attr({
  attribute: "stroke-width",
  converter: nullableNumberConverter
}), designToken(strokeWidth)], DesignSystemProvider.prototype, "strokeWidth", void 0);

__decorate$1([attr({
  attribute: "focus-stroke-width",
  converter: nullableNumberConverter
}), designToken(focusStrokeWidth)], DesignSystemProvider.prototype, "focusStrokeWidth", void 0);

__decorate$1([attr({
  attribute: "disabled-opacity",
  converter: nullableNumberConverter
}), designToken(disabledOpacity)], DesignSystemProvider.prototype, "disabledOpacity", void 0);

__decorate$1([attr({
  attribute: "type-ramp-minus-2-font-size"
}), designToken(typeRampMinus2FontSize)], DesignSystemProvider.prototype, "typeRampMinus2FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-minus-2-line-height"
}), designToken(typeRampMinus2LineHeight)], DesignSystemProvider.prototype, "typeRampMinus2LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-minus-1-font-size"
}), designToken(typeRampMinus1FontSize)], DesignSystemProvider.prototype, "typeRampMinus1FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-minus-1-line-height"
}), designToken(typeRampMinus1LineHeight)], DesignSystemProvider.prototype, "typeRampMinus1LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-base-font-size"
}), designToken(typeRampBaseFontSize)], DesignSystemProvider.prototype, "typeRampBaseFontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-base-line-height"
}), designToken(typeRampBaseLineHeight)], DesignSystemProvider.prototype, "typeRampBaseLineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-1-font-size"
}), designToken(typeRampPlus1FontSize)], DesignSystemProvider.prototype, "typeRampPlus1FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-1-line-height"
}), designToken(typeRampPlus1LineHeight)], DesignSystemProvider.prototype, "typeRampPlus1LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-2-font-size"
}), designToken(typeRampPlus2FontSize)], DesignSystemProvider.prototype, "typeRampPlus2FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-2-line-height"
}), designToken(typeRampPlus2LineHeight)], DesignSystemProvider.prototype, "typeRampPlus2LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-3-font-size"
}), designToken(typeRampPlus3FontSize)], DesignSystemProvider.prototype, "typeRampPlus3FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-3-line-height"
}), designToken(typeRampPlus3LineHeight)], DesignSystemProvider.prototype, "typeRampPlus3LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-4-font-size"
}), designToken(typeRampPlus4FontSize)], DesignSystemProvider.prototype, "typeRampPlus4FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-4-line-height"
}), designToken(typeRampPlus4LineHeight)], DesignSystemProvider.prototype, "typeRampPlus4LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-5-font-size"
}), designToken(typeRampPlus5FontSize)], DesignSystemProvider.prototype, "typeRampPlus5FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-5-line-height"
}), designToken(typeRampPlus5LineHeight)], DesignSystemProvider.prototype, "typeRampPlus5LineHeight", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-6-font-size"
}), designToken(typeRampPlus6FontSize)], DesignSystemProvider.prototype, "typeRampPlus6FontSize", void 0);

__decorate$1([attr({
  attribute: "type-ramp-plus-6-line-height"
}), designToken(typeRampPlus6LineHeight)], DesignSystemProvider.prototype, "typeRampPlus6LineHeight", void 0);

__decorate$1([attr({
  attribute: "accent-fill-rest-delta",
  converter: nullableNumberConverter
}), designToken(accentFillRestDelta)], DesignSystemProvider.prototype, "accentFillRestDelta", void 0);

__decorate$1([attr({
  attribute: "accent-fill-hover-delta",
  converter: nullableNumberConverter
}), designToken(accentFillHoverDelta)], DesignSystemProvider.prototype, "accentFillHoverDelta", void 0);

__decorate$1([attr({
  attribute: "accent-fill-active-delta",
  converter: nullableNumberConverter
}), designToken(accentFillActiveDelta)], DesignSystemProvider.prototype, "accentFillActiveDelta", void 0);

__decorate$1([attr({
  attribute: "accent-fill-focus-delta",
  converter: nullableNumberConverter
}), designToken(accentFillFocusDelta)], DesignSystemProvider.prototype, "accentFillFocusDelta", void 0);

__decorate$1([attr({
  attribute: "accent-foreground-rest-delta",
  converter: nullableNumberConverter
}), designToken(accentForegroundRestDelta)], DesignSystemProvider.prototype, "accentForegroundRestDelta", void 0);

__decorate$1([attr({
  attribute: "accent-foreground-hover-delta",
  converter: nullableNumberConverter
}), designToken(accentForegroundHoverDelta)], DesignSystemProvider.prototype, "accentForegroundHoverDelta", void 0);

__decorate$1([attr({
  attribute: "accent-foreground-active-delta",
  converter: nullableNumberConverter
}), designToken(accentForegroundActiveDelta)], DesignSystemProvider.prototype, "accentForegroundActiveDelta", void 0);

__decorate$1([attr({
  attribute: "accent-foreground-focus-delta",
  converter: nullableNumberConverter
}), designToken(accentForegroundFocusDelta)], DesignSystemProvider.prototype, "accentForegroundFocusDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-rest-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillRestDelta)], DesignSystemProvider.prototype, "neutralFillRestDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-hover-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillHoverDelta)], DesignSystemProvider.prototype, "neutralFillHoverDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-active-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillActiveDelta)], DesignSystemProvider.prototype, "neutralFillActiveDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-focus-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillFocusDelta)], DesignSystemProvider.prototype, "neutralFillFocusDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-input-rest-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillInputRestDelta)], DesignSystemProvider.prototype, "neutralFillInputRestDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-input-hover-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillInputHoverDelta)], DesignSystemProvider.prototype, "neutralFillInputHoverDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-input-active-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillInputActiveDelta)], DesignSystemProvider.prototype, "neutralFillInputActiveDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-input-focus-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillInputFocusDelta)], DesignSystemProvider.prototype, "neutralFillInputFocusDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-stealth-rest-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStealthRestDelta)], DesignSystemProvider.prototype, "neutralFillStealthRestDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-stealth-hover-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStealthHoverDelta)], DesignSystemProvider.prototype, "neutralFillStealthHoverDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-stealth-active-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStealthActiveDelta)], DesignSystemProvider.prototype, "neutralFillStealthActiveDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-stealth-focus-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStealthFocusDelta)], DesignSystemProvider.prototype, "neutralFillStealthFocusDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-strong-hover-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStrongHoverDelta)], DesignSystemProvider.prototype, "neutralFillStrongHoverDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-strong-active-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStrongActiveDelta)], DesignSystemProvider.prototype, "neutralFillStrongActiveDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-strong-focus-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillStrongFocusDelta)], DesignSystemProvider.prototype, "neutralFillStrongFocusDelta", void 0);

__decorate$1([attr({
  attribute: "base-layer-luminance",
  converter: nullableNumberConverter
}), designToken(baseLayerLuminance)], DesignSystemProvider.prototype, "baseLayerLuminance", void 0);

__decorate$1([attr({
  attribute: "neutral-fill-layer-rest-delta",
  converter: nullableNumberConverter
}), designToken(neutralFillLayerRestDelta)], DesignSystemProvider.prototype, "neutralFillLayerRestDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-stroke-divider-rest-delta",
  converter: nullableNumberConverter
}), designToken(neutralStrokeDividerRestDelta)], DesignSystemProvider.prototype, "neutralStrokeDividerRestDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-stroke-rest-delta",
  converter: nullableNumberConverter
}), designToken(neutralStrokeRestDelta)], DesignSystemProvider.prototype, "neutralStrokeRestDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-stroke-hover-delta",
  converter: nullableNumberConverter
}), designToken(neutralStrokeHoverDelta)], DesignSystemProvider.prototype, "neutralStrokeHoverDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-stroke-active-delta",
  converter: nullableNumberConverter
}), designToken(neutralStrokeActiveDelta)], DesignSystemProvider.prototype, "neutralStrokeActiveDelta", void 0);

__decorate$1([attr({
  attribute: "neutral-stroke-focus-delta",
  converter: nullableNumberConverter
}), designToken(neutralStrokeFocusDelta)], DesignSystemProvider.prototype, "neutralStrokeFocusDelta", void 0);
/**
A function that returns a {@link @microsoft/fast-foundation#DesignSystemProvider} registration for configuring the component with a DesignSystem. *
 * @public
 * @remarks
 * Generates HTML Element: \<fast-design-system-provider\>
 */


const fastDesignSystemProvider = DesignSystemProvider.compose({
  baseName: "design-system-provider",
  template: html`<slot></slot>`,
  styles: css` ${display("block")} `
});

// TODO: Is exporting Foundation still necessary with the updated API's?
/**
 * TODO rename this to FASTDesignSystem when {@link @FASTDesignSystem} interface is removed.
 */

const fastDesignSystem = DesignSystem.getOrCreate().register(...Object.values(allComponents).map(definition => definition()));

export { Accordion, AccordionItem, Anchor$1 as Anchor, AnchoredRegion, Avatar$1 as Avatar, Badge, Breadcrumb, BreadcrumbItem, Button$1 as Button, Card$1 as Card, Checkbox, Combobox, DataGrid, DataGridCell, DataGridRow, DesignSystemProvider, Dialog, DirectionalStyleSheetBehavior, Disclosure$1 as Disclosure, Divider, Flipper, HorizontalScroll$1 as HorizontalScroll, Listbox, ListboxOption, Menu, MenuItem, NumberField$1 as NumberField, PaletteRGB, BaseProgress as Progress, BaseProgress as ProgressRing, Radio, RadioGroup, Select, Skeleton, Slider, SliderLabel$1 as SliderLabel, StandardLuminance, SwatchRGB, Switch, Tab, TabPanel, Tabs, TextArea$1 as TextArea, TextField$1 as TextField, Toolbar$1 as Toolbar, Tooltip, TreeItem, TreeView, accentFillActive, accentFillActiveDelta, accentFillFocus, accentFillFocusDelta, accentFillHover, accentFillHoverDelta, accentFillRecipe, accentFillRest, accentFillRestDelta, accentForegroundActive, accentForegroundActiveDelta, accentForegroundFocus, accentForegroundFocusDelta, accentForegroundHover, accentForegroundHoverDelta, accentForegroundRecipe, accentForegroundRest, accentForegroundRestDelta, accentPalette, accordionItemStyles$1 as accordionItemStyles, accordionStyles$1 as accordionStyles, allComponents, anchorStyles$1 as anchorStyles, anchoredRegionStyles$1 as anchoredRegionStyles, avatarStyles$1 as avatarStyles, badgeStyles$1 as badgeStyles, baseHeightMultiplier, baseHorizontalSpacingMultiplier, baseLayerLuminance, bodyFont, buttonStyles$1 as buttonStyles, cardStyles$1 as cardStyles, checkboxStyles$1 as checkboxStyles, comboboxStyles$1 as comboboxStyles, controlCornerRadius, dataGridCellStyles$1 as dataGridCellStyles, dataGridRowStyles$1 as dataGridRowStyles, dataGridStyles$1 as dataGridStyles, density, designUnit, dialogStyles$1 as dialogStyles, direction, disabledOpacity, disclosureStyles$1 as disclosureStyles, dividerStyles$1 as dividerStyles, fastAccordion, fastAccordionItem, fastAnchor, fastAnchoredRegion, fastAvatar, fastBadge, fastBreadcrumb, fastBreadcrumbItem, fastButton, fastCard, fastCheckbox, fastCombobox, fastDataGrid, fastDataGridCell, fastDataGridRow, fastDesignSystem, fastDesignSystemProvider, fastDialog, fastDisclosure, fastDivider, fastFlipper, fastHorizontalScroll, fastListbox, fastMenu, fastMenuItem, fastNumberField, fastOption, fastProgress, fastProgressRing, fastRadio, fastRadioGroup, fastSelect, fastSkeleton, fastSlider, fastSliderLabel, fastSwitch, fastTab, fastTabPanel, fastTabs, fastTextArea, fastTextField, fastToolbar, fastTooltip, fastTreeItem, fastTreeView, fillColor, flipperStyles$1 as flipperStyles, focusStrokeInner$1 as focusStrokeInner, focusStrokeInnerRecipe, focusStrokeOuter$1 as focusStrokeOuter, focusStrokeOuterRecipe, focusStrokeWidth, foregroundOnAccentActive, foregroundOnAccentActiveLarge, foregroundOnAccentFocus, foregroundOnAccentFocusLarge, foregroundOnAccentHover, foregroundOnAccentHoverLarge, foregroundOnAccentLargeRecipe, foregroundOnAccentRecipe, foregroundOnAccentRest, foregroundOnAccentRestLarge, imgTemplate, isDark, listboxStyles$1 as listboxStyles, menuItemStyles$1 as menuItemStyles, menuStyles$1 as menuStyles, neutralFillActive, neutralFillActiveDelta, neutralFillFocus, neutralFillFocusDelta, neutralFillHover, neutralFillHoverDelta, neutralFillInputActive, neutralFillInputActiveDelta, neutralFillInputFocus, neutralFillInputFocusDelta, neutralFillInputHover, neutralFillInputHoverDelta, neutralFillInputRecipe, neutralFillInputRest, neutralFillInputRestDelta, neutralFillLayerRecipe, neutralFillLayerRest, neutralFillLayerRestDelta, neutralFillRecipe, neutralFillRest, neutralFillRestDelta, neutralFillStealthActive, neutralFillStealthActiveDelta, neutralFillStealthFocus, neutralFillStealthFocusDelta, neutralFillStealthHover, neutralFillStealthHoverDelta, neutralFillStealthRecipe, neutralFillStealthRest, neutralFillStealthRestDelta, neutralFillStrongActive, neutralFillStrongActiveDelta, neutralFillStrongFocus, neutralFillStrongFocusDelta, neutralFillStrongHover, neutralFillStrongHoverDelta, neutralFillStrongRecipe, neutralFillStrongRest, neutralFillStrongRestDelta, neutralForegroundHint$1 as neutralForegroundHint, neutralForegroundHintRecipe, neutralForegroundRecipe, neutralForegroundRest, neutralLayer1$1 as neutralLayer1, neutralLayer1Recipe, neutralLayer2$1 as neutralLayer2, neutralLayer2Recipe, neutralLayer3$1 as neutralLayer3, neutralLayer3Recipe, neutralLayer4$1 as neutralLayer4, neutralLayer4Recipe, neutralLayerCardContainer$1 as neutralLayerCardContainer, neutralLayerCardContainerRecipe, neutralLayerFloating$1 as neutralLayerFloating, neutralLayerFloatingRecipe, neutralPalette, neutralStrokeActive, neutralStrokeActiveDelta, neutralStrokeDividerRecipe, neutralStrokeDividerRest, neutralStrokeDividerRestDelta, neutralStrokeFocus, neutralStrokeFocusDelta, neutralStrokeHover, neutralStrokeHoverDelta, neutralStrokeRecipe, neutralStrokeRest, neutralStrokeRestDelta, numberFieldStyles$1 as numberFieldStyles, optionStyles$1 as optionStyles, progressRingStyles$1 as progressRingStyles, progressStyles$1 as progressStyles, radioGroupStyles$1 as radioGroupStyles, radioStyles$1 as radioStyles, selectStyles$1 as selectStyles, skeletonStyles$1 as skeletonStyles, sliderLabelStyles$1 as sliderLabelStyles, sliderStyles$1 as sliderStyles, strokeWidth, switchStyles$1 as switchStyles, tabPanelStyles$1 as tabPanelStyles, tabStyles$1 as tabStyles, tabsStyles$1 as tabsStyles, textAreaStyles$1 as textAreaStyles, textFieldStyles$1 as textFieldStyles, toolbarStyles$1 as toolbarStyles, treeItemStyles$1 as treeItemStyles, treeViewStyles$1 as treeViewStyles, typeRampBaseFontSize, typeRampBaseLineHeight, typeRampMinus1FontSize, typeRampMinus1LineHeight, typeRampMinus2FontSize, typeRampMinus2LineHeight, typeRampPlus1FontSize, typeRampPlus1LineHeight, typeRampPlus2FontSize, typeRampPlus2LineHeight, typeRampPlus3FontSize, typeRampPlus3LineHeight, typeRampPlus4FontSize, typeRampPlus4LineHeight, typeRampPlus5FontSize, typeRampPlus5LineHeight, typeRampPlus6FontSize, typeRampPlus6LineHeight };
