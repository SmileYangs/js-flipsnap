/**
 * flipsnap.js
 *
 * @version  0.6.2
 * @url http://pxgrid.github.com/js-flipsnap/
 *
 * Copyright 2011 PixelGrid, Inc.
 * Licensed under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 */

(function(window, document, undefined) {

var div = document.createElement('div');
var prefix = ['webkit', 'moz', 'o', 'ms'];
var saveProp = {};
var support = Flipsnap.support = {};
var gestureStart = false;

// 滑动距离和角度的阀值
var DISTANCE_THRESHOLD = 5;
var ANGLE_THREHOLD = 55;

support.transform3d = hasProp([
  'perspectiveProperty',
  'WebkitPerspective',
  'MozPerspective',
  'OPerspective',
  'msPerspective'
]);

support.transform = hasProp([
  'transformProperty',
  'WebkitTransform',
  'MozTransform',
  'OTransform',
  'msTransform'
]);

support.transition = hasProp([
  'transitionProperty',
  'WebkitTransitionProperty',
  'MozTransitionProperty',
  'OTransitionProperty',
  'msTransitionProperty'
]);

support.addEventListener = 'addEventListener' in window;
support.mspointer = window.navigator.msPointerEnabled;

support.cssAnimation = (support.transform3d || support.transform) && support.transition;

// 定义支持的事件列表
var eventTypes = ['touch', 'mouse'];

var events = {
  start: {
    touch: 'touchstart',
    mouse: 'mousedown'
  },
  move: {
    touch: 'touchmove',
    mouse: 'mousemove'
  },
  end: {
    touch: 'touchend',
    mouse: 'mouseup'
  }
};

// 监听手势事件，设置一个标志
if (support.addEventListener) {
  document.addEventListener('gesturestart', function() {
    gestureStart = true;
  });

  document.addEventListener('gestureend', function() {
    gestureStart = false;
  });
}

// 定义主对象
function Flipsnap(element, opts) {
  return (this instanceof Flipsnap)
    ? this.init(element, opts)
    : new Flipsnap(element, opts);
}

// 对象初始化
Flipsnap.prototype.init = function(element, opts) {
  var self = this;

  // set element
  self.element = element;
  if (typeof element === 'string') {
    self.element = document.querySelector(element);
  }
  if (!self.element) {
    throw new Error('element not found');
  }

  if (support.mspointer) {
    // 允许垂直轴触摸驱动的平移
    self.element.style.msTouchAction = 'pan-y';
  }

  // set opts
  opts = opts || {};
  self.distance = opts.distance;
  self.maxPoint = opts.maxPoint;
  self.disableTouch = (opts.disableTouch === undefined) ? false : opts.disableTouch;

  // 允许循环滚动
  self.marquee = (opts.marquee === undefined) ? false : opts.marquee;

  self.disable3d = (opts.disable3d === undefined) ? false : opts.disable3d;
  self.transitionDuration = (opts.transitionDuration === undefined) ? '350ms' : opts.transitionDuration + 'ms';

  // set property
  self.currentPoint = 0;
  self.currentX = 0;
  self.animation = false;
  self.use3d = support.transform3d;
  if (self.disable3d === true) {
    self.use3d = false;
  }

  // set default style
  if (support.cssAnimation) {
    self._setStyle({
      transitionProperty: getCSSVal('transform'),
      transitionTimingFunction: 'cubic-bezier(0,0,0.25,1)',
      transitionDuration: '0ms',
      transform: self._getTranslate(0)
    });
  }
  else {
    self._setStyle({
      position: 'relative',
      left: '0px'
    });
  }

  // initilize
  self.refresh();

  // 绑定touchstart和mousedown事件
  eventTypes.forEach(function(type) {
    self.element.addEventListener(events.start[type], self, false);
  });

  return self;
};

Flipsnap.prototype.handleEvent = function(event) {
  var self = this;

  switch (event.type) {
    // start
    case events.start.touch: self._touchStart(event, 'touch'); break;
    case events.start.mouse: self._touchStart(event, 'mouse'); break;

    // move
    case events.move.touch: self._touchMove(event, 'touch'); break;
    case events.move.mouse: self._touchMove(event, 'mouse'); break;

    // end
    case events.end.touch: self._touchEnd(event, 'touch'); break;
    case events.end.mouse: self._touchEnd(event, 'mouse'); break;

    // click
    case 'click': self._click(event); break;
  }
};

Flipsnap.prototype.refresh = function() {
  var self = this;

  // setting max point
  self._maxPoint = (self.maxPoint === undefined) ? (function() {
    var childNodes = self.element.childNodes,
      itemLength = -1,
      i = 0,
      len = childNodes.length,
      node;
    for(; i < len; i++) {
      node = childNodes[i];
      if (node.nodeType === 1) {
        itemLength++;
      }
    }

    return itemLength;
  })() : self.maxPoint;

  // setting distance
  if (self.distance === undefined) {
    if (self._maxPoint < 0) {
      self._distance = 0;
    }
    else {
      self._distance = self.element.scrollWidth / (self._maxPoint + 1);
    }
  }
  else {
    self._distance = self.distance;
  }

  // 跑马灯效果下，初始化，往首尾添加新节点
  if(self.marquee){
    // 判断是否在动画中
    self.isAnimate = false;
    // 缓存所有的节点
    self.items = (function(){
      var childNodes = self.element.childNodes,
        items = [],
        i = 0,
        len = childNodes.length,
        node;
      for(; i < len; i++) {
        node = childNodes[i];
        if (node.nodeType === 1) {
          items.push(node);
        }
      }
      return items;
    })();

    
    // 获取视口的宽度
    self.viewWidth = (function(){
      var viewport = self.element.parentNode;
      return viewport.offsetWidth;
    })();

    // 缓存每一个滑块的宽度
    self.sliderWidth = outerWidth(self.items[0]);

    // 每次需要往首尾添加的节点数目
    self.addtionNum = (function(){
      return Math.ceil(self.viewWidth/self.sliderWidth);
    })();
    
    // 往节点队列首尾部添加对应数目的节点
    (function(){
      // 改变容器的宽度
      self.element.style.width = self.element.offsetWidth + 2 * self.addtionNum * self.sliderWidth + "px";

      function getFirstChild(){
        var childNodes = self.element.childNodes,
          i=0,
          len = childNodes.length,
          node;
        for(; i < len; i++) {
          node = childNodes[i];
          if (node.nodeType === 1) {
            break;
          }
        }
        return node;
      }
      // 添加
      for(var i=0,l=self.items.length; i < self.addtionNum; i++){
        var index = i%l,
            indexBefore = l-1-index,
            addNodeLast = self.items[index].cloneNode(true),
            addNodeBefore = self.items[indexBefore].cloneNode(true),
            firstChild = getFirstChild();
        self.element.insertBefore(addNodeBefore,firstChild);
        self.element.appendChild(addNodeLast);
      }
    })();

    // 首部添加之后，应该计算初次加载的位置
    (function(){
      var x = - self.addtionNum * self.sliderWidth;
      self.element.style.left =  x + 'px';
      self.element.style.position = "relative";
      self.currentX = 0;
    })()

    // 向左移动的最大次数
    self.moveLeft = (function(){
      var l = self.items.length * self.sliderWidth;
      return l/self._distance;
    })();

    // 向右移动的最大次数
    self.moveRight = (function(){
      return Math.floor(self.viewWidth/self._distance);
    })();

    // 添加事件绑定
    self.element.addEventListener('webkitTransitionEnd',function(){
      if(self.beforePoint === self.moveLeft-1 && self.directionX > 0){
        self.moveToPoint(0,0);
      }
      if(self.beforePoint === -self.moveRight+1 && self.directionX < 0){
        self.moveToPoint(self._maxPoint,0);
      }
    },false);
    // console.log("need slider %d to init ",self.canMoveNum);
    // console.log( "slider num is " + self.items.length);
    // console.log("slider width is " + self.sliderWidth);
    // console.log("need to add is " + self.addtionNum);
  }
  else {
    self._maxX = -self._distance * self._maxPoint;
    self.moveToPoint();
  }
};

// 使用按钮点击的情况
Flipsnap.prototype.hasNext = function() {
  var self = this;
  return self.currentPoint < self._maxPoint;
};

Flipsnap.prototype.hasPrev = function(prev) {
  var self = this;
  return self.currentPoint > 0;
};

Flipsnap.prototype.toNext = function(transitionDuration) {
  var self = this;

  self.directionX = 1;
  // 跑马灯模式下
  if (!self.hasNext() && !marquee) {
    return;
  }
  self.moveToPoint(self.currentPoint + 1, transitionDuration);

};

Flipsnap.prototype.toPrev = function(transitionDuration) {
  var self = this;

  self.directionX = -1;
  if (!self.hasPrev() && !marquee) {
    return;
  }

  self.moveToPoint(self.currentPoint - 1, transitionDuration);
};

Flipsnap.prototype.moveToPoint = function(point, transitionDuration) {
  var self = this;
  // 滑动延迟时间
  transitionDuration = transitionDuration === undefined
    ? self.transitionDuration : transitionDuration + 'ms';

  self.beforePoint = self.currentPoint;

  // called from `refresh()`
  if (point === undefined) {
    point = self.currentPoint;
  }


  if(!self.marquee){
    if (point < 0) {
      self.currentPoint = 0;
    }
    else if (point > self._maxPoint) {
      self.currentPoint = self._maxPoint; 
    } 
    else {
      self.currentPoint = parseInt(point, 10);
    }
  } else {
    self.currentPoint = point;
  }

  if (support.cssAnimation) {
    self._setStyle({ transitionDuration: transitionDuration });
  }
  else {
    self.animation = true;
  }

  self._setX(- self.currentPoint * self._distance, transitionDuration,self.currentPoint);
  if (self.beforePoint !== self.currentPoint) { // is move?
    // `fsmoveend` is deprecated
    // `fspointmove` is recommend.
    self._triggerEvent('fsmoveend', true, false);
    self._triggerEvent('fspointmove', true, false);
  }
};

Flipsnap.prototype._setX = function(x, transitionDuration,newPoint) {
  var self = this;
  self.currentX = x;
  if (support.cssAnimation) {
    self.element.style[ saveProp.transform ] = self._getTranslate(x);
  }
  else {
    if (self.animation) {
      self._animate(x, transitionDuration || self.transitionDuration);
    }
    else {
      self.element.style.left = x + 'px';
    }
  }
  // 当动画完全停止后，将滑块移动到起始位置,判断滑动到初始位置时
  if(self.marquee && newPoint === self.moveLeft && self.directionX > 0){
    // 计算currentX
    self.currentPoint = 0;
    self.currentX = 0;
  }
  if(self.marquee && newPoint === -self.moveRight && self.directionX < 0){
    // 计算currentX
    var x = - self._maxPoint*self._distance;
    self.currentPoint = self._maxPoint;
    self.currentX = x;
  }
};

Flipsnap.prototype._touchStart = function(event, type) {
  var self = this;

  //禁用滑动，或正在滚动，或处于手势事件中时，不执行start
  if (self.disableTouch || self.scrolling || gestureStart) {
    return;
  }

  // 绑定touchmove，touchend和mousemove，mouseup事件
  self.element.addEventListener(events.move[type], self, false);
  document.addEventListener(events.end[type], self, false);

  var tagName = event.target.tagName;
  if (type === 'mouse' && tagName !== 'SELECT' && tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'BUTTON') {
    event.preventDefault();
  }

  // 判断是否支持css3动画
  if (support.cssAnimation) {
    self._setStyle({ transitionDuration: '0ms' });
  }
  else {
    self.animation = false;
  }
  self.scrolling = true;
  self.moveReady = false;

  // 记录手指开始滑动时的坐标
  self.startPageX = getPage(event, 'pageX');
  self.startPageY = getPage(event, 'pageY');
  self.basePageX = self.startPageX;
  self.directionX = 0;
  self.startTime = event.timeStamp;
  self._triggerEvent('fstouchstart', true, false);
};

Flipsnap.prototype._touchMove = function(event, type) {
  var self = this;

  if (!self.scrolling || gestureStart) {
    return;
  }

  // 获取坐标
  var pageX = getPage(event, 'pageX');
  var pageY = getPage(event, 'pageY');
  var distX;
  var newX;

  if (self.moveReady) {
    event.preventDefault();

    distX = pageX - self.basePageX;
    newX = self.currentX + distX;
    if (newX >= 0 || newX < self._maxX) {
      newX = Math.round(self.currentX + distX / 3);
    }

    // When distX is 0, use one previous value.
    // For android firefox. When touchend fired, touchmove also
    // fired and distX is certainly set to 0. 
    self.directionX =
      distX === 0 ? self.directionX :
      distX > 0 ? -1 : 1;

    // if they prevent us then stop it
    var isPrevent = !self._triggerEvent('fstouchmove', true, true, {
      delta: distX,
      direction: self.directionX
    });

    if (isPrevent) {
      self._touchAfter({
        moved: false,
        originalPoint: self.currentPoint,
        newPoint: self.currentPoint,
        cancelled: true
      });
    } else {
      self._setX(newX);
    }
  }
  else {
    // https://github.com/pxgrid/js-flipsnap/pull/36
    var triangle = getTriangleSide(self.startPageX, self.startPageY, pageX, pageY);
    if (triangle.z > DISTANCE_THRESHOLD) {
      if (getAngle(triangle) > ANGLE_THREHOLD) {
        event.preventDefault();
        self.moveReady = true;
        self.element.addEventListener('click', self, true);
      }
      else {
        self.scrolling = false;
      }
    }
  }

  self.basePageX = pageX;
};

Flipsnap.prototype._touchEnd = function(event, type) {
  var self = this;
  self.element.removeEventListener(events.move[type], self, false);
  document.removeEventListener(events.end[type], self, false);

  if (!self.scrolling) {
    return;
  }

  var newPoint = -self.currentX / self._distance;
  newPoint =
    (self.directionX > 0) ? Math.ceil(newPoint) :
    (self.directionX < 0) ? Math.floor(newPoint) :
    Math.round(newPoint);

  if(!self.marquee){
    if (newPoint > self._maxPoint) {
      newPoint = self._maxPoint;
    }
    else if (newPoint < 0) {
      newPoint = 0;
    }
  } 
 
  self._touchAfter({
    moved: newPoint !== self.currentPoint,
    originalPoint: self.currentPoint,
    newPoint: newPoint,
    cancelled: false
  });

  // 在跑马灯情况下，防止抖动
  if(self.marquee){
    if(self.directionX !== 0){
      self.moveToPoint(newPoint);
    }     
  } else {
    self.moveToPoint(newPoint);
  }

};

Flipsnap.prototype._click = function(event) {
  var self = this;

  event.stopPropagation();
  event.preventDefault();
};

Flipsnap.prototype._touchAfter = function(params) {
  var self = this;

  self.scrolling = false;
  self.moveReady = false;

  setTimeout(function() {
    self.element.removeEventListener('click', self, true);
  }, 200);

  self._triggerEvent('fstouchend', true, false, params);
};

Flipsnap.prototype._setStyle = function(styles) {
  var self = this;
  var style = self.element.style;

  for (var prop in styles) {
    setStyle(style, prop, styles[prop]);
  }
};

Flipsnap.prototype._animate = function(x, transitionDuration) {
  var self = this;

  var elem = self.element;
  var begin = +new Date();
  var from = parseInt(elem.style.left, 10);
  var to = x;
  var duration = parseInt(transitionDuration, 10);
  var easing = function(time, duration) {
    return -(time /= duration) * (time - 2);
  };
  var timer = setInterval(function() {
    var time = new Date() - begin;
    var pos, now;
    if (time > duration) {
      clearInterval(timer);
      now = to;
    }
    else {
      pos = easing(time, duration);
      now = pos * (to - from) + from;
    }
    elem.style.left = now + "px";
  }, 10);

};

Flipsnap.prototype.destroy = function() {
  var self = this;

  eventTypes.forEach(function(type) {
    self.element.removeEventListener(events.start[type], self, false);
  });
};

Flipsnap.prototype._getTranslate = function(x) {
  var self = this;

  return self.use3d
    ? 'translate3d(' + x + 'px, 0, 0)'
    : 'translate(' + x + 'px, 0)';
};

// 触发自定义事件
Flipsnap.prototype._triggerEvent = function(type, bubbles, cancelable, data) {
  var self = this;

  var ev = document.createEvent('Event');
  ev.initEvent(type, bubbles, cancelable);

  if (data) {
    for (var d in data) {
      if (data.hasOwnProperty(d)) {
        ev[d] = data[d];
      }
    }
  }

  return self.element.dispatchEvent(ev);
};

function getPage(event, page) {
  return event.changedTouches ? event.changedTouches[0][page] : event[page];
}

function hasProp(props) {
  return some(props, function(prop) {
    return div.style[ prop ] !== undefined;
  });
}

function setStyle(style, prop, val) {
  var _saveProp = saveProp[ prop ];
  if (_saveProp) {
    style[ _saveProp ] = val;
  }
  else if (style[ prop ] !== undefined) {
    saveProp[ prop ] = prop;
    style[ prop ] = val;
  }
  else {
    some(prefix, function(_prefix) {
      var _prop = ucFirst(_prefix) + ucFirst(prop);
      if (style[ _prop ] !== undefined) {
        saveProp[ prop ] = _prop;
        style[ _prop ] = val;
        return true;
      }
    });
  }
}

// 获取css值
function GetCurrentStyle(obj,prop){
  if(obj.currentStyle)
    return obj.currentStyle[prop];
  else if(window.getComputedStyle){
    return document.defaultView.getComputedStyle(obj,null)[prop];
  }
  return null;
}
// 获取元素的outerWidth = margin + padding + width
function outerWidth(obj){
  var offsetWidth = obj.offsetWidth,
      marginL = parseInt(GetCurrentStyle(obj,"marginLeft")),
      marginR = parseInt(GetCurrentStyle(obj,"marginRight"));
  return offsetWidth + marginL + marginR;
}

function getCSSVal(prop) {
  if (div.style[ prop ] !== undefined) {
    return prop;
  }
  else {
    var ret;
    some(prefix, function(_prefix) {
      var _prop = ucFirst(_prefix) + ucFirst(prop);
      if (div.style[ _prop ] !== undefined) {
        ret = '-' + _prefix + '-' + prop;
        return true;
      }
    });
    return ret;
  }
}

function ucFirst(str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
}

function some(ary, callback) {
  for (var i = 0, len = ary.length; i < len; i++) {
    if (callback(ary[i], i)) {
      return true;
    }
  }
  return false;
}

function getTriangleSide(x1, y1, x2, y2) {
  var x = Math.abs(x1 - x2);
  var y = Math.abs(y1 - y2);
  var z = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));

  return {
    x: x,
    y: y,
    z: z
  };
}

function getAngle(triangle) {
  var cos = triangle.y / triangle.z;
  var radina = Math.acos(cos);

  return 180 / (Math.PI / radina);
}

if (typeof exports == 'object') {
  module.exports = Flipsnap;
}
else if (typeof define == 'function' && define.amd) {
  define(function() {
    return Flipsnap;
  });
}
else {
  window.Flipsnap = Flipsnap;
}

})(window, window.document);
