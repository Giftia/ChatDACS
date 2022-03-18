(function () {
  var LIVE2DCUBISMFRAMEWORK;
  (function (LIVE2DCUBISMFRAMEWORK) {
    var AnimationPoint = (function () {
      function AnimationPoint (time, value) {
        this.time = time
        this.value = value
      }
      return AnimationPoint
    }())
    LIVE2DCUBISMFRAMEWORK.AnimationPoint = AnimationPoint
    var AnimationUserDataBody = (function () {
      function AnimationUserDataBody (time, value) {
        this.time = time
        this.value = value
      }
      ;
      return AnimationUserDataBody
    }())
    LIVE2DCUBISMFRAMEWORK.AnimationUserDataBody = AnimationUserDataBody
    var BuiltinAnimationSegmentEvaluators = (function () {
      function BuiltinAnimationSegmentEvaluators () {
      }
      BuiltinAnimationSegmentEvaluators.lerp = function (a, b, t) {
        return new AnimationPoint((a.time + ((b.time - a.time) * t)), (a.value + ((b.value - a.value) * t)))
      }
      BuiltinAnimationSegmentEvaluators.LINEAR = function (points, offset, time) {
        var p0 = points[offset + 0]
        var p1 = points[offset + 1]
        var t = (time - p0.time) / (p1.time - p0.time)
        return (p0.value + ((p1.value - p0.value) * t))
      }
      BuiltinAnimationSegmentEvaluators.BEZIER = function (points, offset, time) {
        var t = (time - points[offset + 0].time) / (points[offset + 3].time - points[offset].time)
        var p01 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 0], points[offset + 1], t)
        var p12 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 1], points[offset + 2], t)
        var p23 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 2], points[offset + 3], t)
        var p012 = BuiltinAnimationSegmentEvaluators.lerp(p01, p12, t)
        var p123 = BuiltinAnimationSegmentEvaluators.lerp(p12, p23, t)
        return BuiltinAnimationSegmentEvaluators.lerp(p012, p123, t).value
      }
      BuiltinAnimationSegmentEvaluators.STEPPED = function (points, offset, time) {
        return points[offset + 0].value
      }
      BuiltinAnimationSegmentEvaluators.INVERSE_STEPPED = function (points, offset, time) {
        return points[offset + 1].value
      }
      return BuiltinAnimationSegmentEvaluators
    }())
    LIVE2DCUBISMFRAMEWORK.BuiltinAnimationSegmentEvaluators = BuiltinAnimationSegmentEvaluators
    var AnimationSegment = (function () {
      function AnimationSegment (offset, evaluate) {
        this.offset = offset
        this.evaluate = evaluate
      }
      return AnimationSegment
    }())
    LIVE2DCUBISMFRAMEWORK.AnimationSegment = AnimationSegment
    var AnimationTrack = (function () {
      function AnimationTrack (targetId, points, segments) {
        this.targetId = targetId
        this.points = points
        this.segments = segments
      }
      AnimationTrack.prototype.evaluate = function (time) {
        var s = 0
        var lastS = this.segments.length - 1
        for (; s < lastS; ++s) {
          if (this.points[this.segments[s + 1].offset].time < time) {
            continue
          }
          break
        }
        return this.segments[s].evaluate(this.points, this.segments[s].offset, time)
      }
      return AnimationTrack
    }())
    LIVE2DCUBISMFRAMEWORK.AnimationTrack = AnimationTrack
    var Animation = (function () {
      function Animation (motion3Json) {
        var _this = this
        this.modelTracks = []
        this.parameterTracks = []
        this.partOpacityTracks = []
        this.userDataBodys = []
        this.duration = motion3Json.Meta.Duration
        this.fps = motion3Json.Meta.Fps
        this.loop = motion3Json.Meta.Loop
        this.userDataCount = motion3Json.Meta.UserDataCount
        this.totalUserDataSize = motion3Json.Meta.TotalUserDataSize
        if (motion3Json.UserData != null) {
          motion3Json.UserData.forEach(function (u) {
            _this.userDataBodys.push(new AnimationUserDataBody(u.Time, u.Value))
          })
          console.assert(this.userDataBodys.length === this.userDataCount)
        }
        motion3Json.Curves.forEach(function (c) {
          var s = c.Segments
          var points = []
          var segments = []
          points.push(new AnimationPoint(s[0], s[1]))
          for (var t = 2; t < s.length; t += 3) {
            var offset = points.length - 1
            var evaluate = BuiltinAnimationSegmentEvaluators.LINEAR
            var type = s[t]
            if (type === 1) {
              evaluate = BuiltinAnimationSegmentEvaluators.BEZIER
              points.push(new AnimationPoint(s[t + 1], s[t + 2]))
              points.push(new AnimationPoint(s[t + 3], s[t + 4]))
              t += 4
            } else if (type === 2) {
              evaluate = BuiltinAnimationSegmentEvaluators.STEPPED
            } else if (type === 3) {
              evaluate = BuiltinAnimationSegmentEvaluators.INVERSE_STEPPED
            } else if (type !== 0) {
            }
            points.push(new AnimationPoint(s[t + 1], s[t + 2]))
            segments.push(new AnimationSegment(offset, evaluate))
          }
          var track = new AnimationTrack(c.Id, points, segments)
          if (c.Target === 'Model') {
            _this.modelTracks.push(track)
          } else if (c.Target === 'Parameter') {
            _this.parameterTracks.push(track)
          } else if (c.Target === 'PartOpacity') {
            _this.partOpacityTracks.push(track)
          } else {
          }
        })
      }
      Animation.fromMotion3Json = function (motion3Json) {
        if (motion3Json == null) {
          return null
        }
        var animation = new Animation(motion3Json)
        return (animation.isValid)
          ? animation
          : null
      }
      Animation.prototype.addAnimationCallback = function (callbackFunc) {
        if (this._callbackFunctions == null) { this._callbackFunctions = [] }
        this._callbackFunctions.push(callbackFunc)
      }
      Animation.prototype.removeAnimationCallback = function (callbackFunc) {
        if (this._callbackFunctions != null) {
          var _target = -1
          for (var _index = 0; _index < this._callbackFunctions.length; _index++) {
            if (this._callbackFunctions[_index] === callbackFunc) {
              _target = _index
              break
            }
          }
          if (_target >= 0) { this._callbackFunctions.splice(_target, 1) }
        }
      }
      Animation.prototype.clearAnimationCallback = function () {
        this._callbackFunctions = []
      }
      Animation.prototype.callAnimationCallback = function (value) {
        if (this._callbackFunctions.length > 0) { this._callbackFunctions.forEach(function (func) { func(value) }) }
      }
      Animation.prototype.evaluate = function (time, weight, blend, target, stackFlags, groups) {
        if (groups === undefined) { groups = null }
        if (weight <= 0.01) {
          return
        }
        if (this.loop) {
          while (time > this.duration) {
            time -= this.duration
          }
        }
        this.parameterTracks.forEach(function (t) {
          var p = target.parameters.ids.indexOf(t.targetId)
          if (p >= 0) {
            var sample = t.evaluate(time)
            if (stackFlags[0][p] !== true) {
              target.parameters.values[p] = target.parameters.defaultValues[p]
              stackFlags[0][p] = true
            }
            target.parameters.values[p] = blend(target.parameters.values[p], sample, t.evaluate(0), weight)
          }
        })
        this.partOpacityTracks.forEach(function (t) {
          var p = target.parts.ids.indexOf(t.targetId)
          if (p >= 0) {
            var sample = t.evaluate(time)
            if (stackFlags[1][p] !== true) {
              target.parts.opacities[p] = 1
              stackFlags[1][p] = true
            }
            target.parts.opacities[p] = blend(target.parts.opacities[p], sample, t.evaluate(0), weight)
          }
        })
        this.modelTracks.forEach(function (t) {
          if (groups != null) {
            var g = groups.getGroupById(t.targetId)
            if (g != null && g.target === 'Parameter') {
              for (var _i = 0, _a = g.ids; _i < _a.length; _i++) {
                var tid = _a[_i]
                var p = target.parameters.ids.indexOf(tid)
                if (p >= 0) {
                  var sample = t.evaluate(time)
                  if (stackFlags[0][p] !== true) {
                    target.parameters.values[p] = target.parameters.defaultValues[p]
                    stackFlags[0][p] = true
                  }
                  target.parameters.values[p] = blend(target.parameters.values[p], sample, t.evaluate(0), weight)
                }
              }
            }
          }
        })
        if (this._callbackFunctions != null) {
          for (var _i = 0, _a = this.userDataBodys; _i < _a.length; _i++) {
            var ud = _a[_i]
            if (this.isEventTriggered(ud.time, time, this._lastTime, this.duration)) { this.callAnimationCallback(ud.value) }
          }
        }
        this._lastTime = time
      }
      Animation.prototype.isEventTriggered = function (timeEvaluate, timeForward, timeBack, duration) {
        if (timeForward > timeBack) {
          if (timeEvaluate > timeBack && timeEvaluate < timeForward) { return true }
        } else {
          if ((timeEvaluate > 0 && timeEvaluate < timeForward) || (timeEvaluate > timeBack && timeEvaluate < duration)) { return true }
        }
        return false
      }
      Object.defineProperty(Animation.prototype, 'isValid', {
        get: function () {
          return true
        },
        enumerable: true,
        configurable: true
      })
      return Animation
    }())
    LIVE2DCUBISMFRAMEWORK.Animation = Animation
    var BuiltinCrossfadeWeighters = (function () {
      function BuiltinCrossfadeWeighters () {
      }
      BuiltinCrossfadeWeighters.LINEAR = function (time, duration) {
        return (time / duration)
      }
      return BuiltinCrossfadeWeighters
    }())
    LIVE2DCUBISMFRAMEWORK.BuiltinCrossfadeWeighters = BuiltinCrossfadeWeighters
    var AnimationState = (function () {
      function AnimationState () {
      }
      return AnimationState
    }())
    LIVE2DCUBISMFRAMEWORK.AnimationState = AnimationState
    var BuiltinAnimationBlenders = (function () {
      function BuiltinAnimationBlenders () {
      }
      BuiltinAnimationBlenders.OVERRIDE = function (source, destination, initial, weight) {
        return ((destination * weight) + source * (1 - weight))
      }
      BuiltinAnimationBlenders.ADD = function (source, destination, initial, weight) {
        return (source + ((destination - initial) * weight))
      }
      BuiltinAnimationBlenders.MULTIPLY = function (source, destination, weight) {
        return (source * (1 + ((destination - 1) * weight)))
      }
      return BuiltinAnimationBlenders
    }())
    LIVE2DCUBISMFRAMEWORK.BuiltinAnimationBlenders = BuiltinAnimationBlenders
    var AnimationLayer = (function () {
      function AnimationLayer () {
        this.weight = 1
      }
      Object.defineProperty(AnimationLayer.prototype, 'currentAnimation', {
        get: function () {
          return this._animation
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(AnimationLayer.prototype, 'currentTime', {
        get: function () {
          return this._time
        },
        set: function (value) {
          this._time = value
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(AnimationLayer.prototype, 'isPlaying', {
        get: function () {
          return this._play
        },
        enumerable: true,
        configurable: true
      })
      AnimationLayer.prototype.play = function (animation, fadeDuration) {
        if (fadeDuration === undefined) { fadeDuration = 0 }
        if (this._animation && fadeDuration > 0) {
          this._goalAnimation = animation
          this._goalTime = 0
          this._fadeTime = 0
          this._fadeDuration = fadeDuration
        } else {
          this._animation = animation
          this.currentTime = 0
          this._play = true
        }
      }
      AnimationLayer.prototype.resume = function () {
        this._play = true
      }
      AnimationLayer.prototype.pause = function () {
        this._play = false
      }
      AnimationLayer.prototype.stop = function () {
        this._play = false
        this.currentTime = 0
      }
      AnimationLayer.prototype._update = function (deltaTime) {
        if (!this._play) {
          return
        }
        this._time += deltaTime
        this._goalTime += deltaTime
        this._fadeTime += deltaTime
        if (this._animation == null || (!this._animation.loop && this._time > this._animation.duration)) {
          this.stop()
          this._animation = null
        }
      }
      AnimationLayer.prototype._evaluate = function (target, stackFlags) {
        if (this._animation == null) {
          return
        }
        var weight = (this.weight < 1)
          ? this.weight
          : 1
        var animationWeight = (this._goalAnimation != null)
          ? (weight * this.weightCrossfade(this._fadeTime, this._fadeDuration))
          : weight
        this._animation.evaluate(this._time, animationWeight, this.blend, target, stackFlags, this.groups)
        if (this._goalAnimation != null) {
          animationWeight = 1 - (weight * this.weightCrossfade(this._fadeTime, this._fadeDuration))
          this._goalAnimation.evaluate(this._goalTime, animationWeight, this.blend, target, stackFlags, this.groups)
          if (this._fadeTime > this._fadeDuration) {
            this._animation = this._goalAnimation
            this._time = this._goalTime
            this._goalAnimation = null
          }
        }
      }
      return AnimationLayer
    }())
    LIVE2DCUBISMFRAMEWORK.AnimationLayer = AnimationLayer
    var Animator = (function () {
      function Animator (target, timeScale, layers) {
        this._target = target
        this.timeScale = timeScale
        this._layers = layers
      }
      Object.defineProperty(Animator.prototype, 'target', {
        get: function () {
          return this._target
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Animator.prototype, 'isPlaying', {
        get: function () {
          var ret = false
          this._layers.forEach(function (l) {
            if (l.isPlaying) {
              ret = true
            }
          })
          return ret
        },
        enumerable: true,
        configurable: true
      })
      Animator.prototype.addLayer = function (name, blender, weight) {
        if (blender === undefined) { blender = BuiltinAnimationBlenders.OVERRIDE }
        if (weight === undefined) { weight = 1 }
        var layer = new AnimationLayer()
        layer.blend = blender
        layer.weightCrossfade = BuiltinCrossfadeWeighters.LINEAR
        layer.weight = weight
        layer.groups = this.groups
        this._layers.set(name, layer)
      }
      Animator.prototype.getLayer = function (name) {
        return this._layers.has(name)
          ? this._layers.get(name)
          : null
      }
      Animator.prototype.removeLayer = function (name) {
        return this._layers.has(name)
          ? this._layers.delete(name)
          : null
      }
      Animator.prototype.clearLayers = function () {
        this._layers.clear()
      }
      Animator.prototype.updateAndEvaluate = function (deltaTime) {
        var _this = this
        deltaTime *= ((this.timeScale > 0)
          ? this.timeScale
          : 0)
        if (deltaTime > 0.001) {
          this._layers.forEach(function (l) {
            l._update(deltaTime)
          })
        }
        var paramStackFlags = new Array(this._target.parameters.count).fill(false) // eslint-disable-line no-array-constructor
        var partsStackFlags = new Array(this._target.parts.count).fill(false) // eslint-disable-line no-array-constructor
        var stackFlags = new Array(paramStackFlags, partsStackFlags) // eslint-disable-line no-array-constructor
        this._layers.forEach(function (l) {
          l._evaluate(_this._target, stackFlags)
        })
      }
      Animator._create = function (target, timeScale, layers) {
        var animator = new Animator(target, timeScale, layers)
        return animator.isValid
          ? animator
          : null
      }
      Object.defineProperty(Animator.prototype, 'isValid', {
        get: function () {
          return this._target != null
        },
        enumerable: true,
        configurable: true
      })
      return Animator
    }())
    LIVE2DCUBISMFRAMEWORK.Animator = Animator
    var AnimatorBuilder = (function () {
      function AnimatorBuilder () {
        this._timeScale = 1
        this._layerNames = []
        this._layerBlenders = []
        this._layerCrossfadeWeighters = []
        this._layerWeights = []
      }
      AnimatorBuilder.prototype.setTarget = function (value) {
        this._target = value
        return this
      }
      AnimatorBuilder.prototype.setTimeScale = function (value) {
        this._timeScale = value
        return this
      }
      AnimatorBuilder.prototype.addLayer = function (name, blender, weight) {
        if (blender === undefined) { blender = BuiltinAnimationBlenders.OVERRIDE }
        if (weight === undefined) { weight = 1 }
        this._layerNames.push(name)
        this._layerBlenders.push(blender)
        this._layerCrossfadeWeighters.push(BuiltinCrossfadeWeighters.LINEAR)
        this._layerWeights.push(weight)
        return this
      }
      AnimatorBuilder.prototype.build = function () {
        var layers = new Map()
        for (var l = 0; l < this._layerNames.length; ++l) {
          var layer = new AnimationLayer()
          layer.blend = this._layerBlenders[l]
          layer.weightCrossfade = this._layerCrossfadeWeighters[l]
          layer.weight = this._layerWeights[l]
          layers.set(this._layerNames[l], layer)
        }
        return Animator._create(this._target, this._timeScale, layers)
      }
      return AnimatorBuilder
    }())
    LIVE2DCUBISMFRAMEWORK.AnimatorBuilder = AnimatorBuilder
    var PhysicsVector2 = (function () {
      function PhysicsVector2 (x, y) {
        this.x = x
        this.y = y
      }
      PhysicsVector2.distance = function (a, b) {
        return Math.abs(a.substract(b).length)
      }
      PhysicsVector2.dot = function (a, b) {
        return ((a.x * b.x) + (a.y * b.y))
      }
      Object.defineProperty(PhysicsVector2.prototype, 'length', {
        get: function () {
          return Math.sqrt(PhysicsVector2.dot(this, this))
        },
        enumerable: true,
        configurable: true
      })
      PhysicsVector2.prototype.add = function (vector2) {
        return new PhysicsVector2(this.x + vector2.x, this.y + vector2.y)
      }
      PhysicsVector2.prototype.substract = function (vector2) {
        return new PhysicsVector2(this.x - vector2.x, this.y - vector2.y)
      }
      PhysicsVector2.prototype.multiply = function (vector2) {
        return new PhysicsVector2(this.x * vector2.x, this.y * vector2.y)
      }
      PhysicsVector2.prototype.multiplyByScalar = function (scalar) {
        return this.multiply(new PhysicsVector2(scalar, scalar))
      }
      PhysicsVector2.prototype.divide = function (vector2) {
        return new PhysicsVector2(this.x / vector2.x, this.y / vector2.y)
      }
      PhysicsVector2.prototype.divideByScalar = function (scalar) {
        return this.divide(new PhysicsVector2(scalar, scalar))
      }
      PhysicsVector2.prototype.rotateByRadians = function (radians) {
        var x = (this.x * Math.cos(radians)) - (this.y * Math.sin(radians))
        var y = (this.x * Math.sin(radians)) + (this.y * Math.cos(radians))
        return new PhysicsVector2(x, y)
      }
      PhysicsVector2.prototype.normalize = function () {
        var length = this.length
        var x = this.x / length
        var y = this.y / length
        return new PhysicsVector2(x, y)
      }
      PhysicsVector2.zero = new PhysicsVector2(0, 0)
      return PhysicsVector2
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsVector2 = PhysicsVector2
    var Physics = (function () {
      function Physics () {
      }
      Physics.clampScalar = function (scalar, lower, upper) {
        if (scalar < lower) {
          return lower
        }
        if (scalar > upper) {
          return upper
        }
        return scalar
      }
      Physics.directionToDegrees = function (from, to) {
        var radians = Physics.directionToRadians(from, to)
        var degrees = Physics.radiansToDegrees(radians)
        return ((to.x - from.x) > 0)
          ? -degrees
          : degrees
      }
      Physics.radiansToDegrees = function (radians) {
        return ((radians * 180) / Math.PI)
      }
      Physics.radiansToDirection = function (radians) {
        return new PhysicsVector2(Math.sin(radians), Math.cos(radians))
      }
      Physics.degreesToRadians = function (degrees) {
        return ((degrees / 180) * Math.PI)
      }
      Physics.directionToRadians = function (from, to) {
        var dot = PhysicsVector2.dot(from, to)
        var magnitude = from.length * to.length
        if (magnitude === 0) {
          return 0
        }
        var cosTheta = (dot / magnitude)
        return (Math.abs(cosTheta) <= 1.0)
          ? Math.acos(cosTheta)
          : 0
      }
      Physics.gravity = new PhysicsVector2(0, -1)
      Physics.wind = new PhysicsVector2(0, 0)
      Physics.maximumWeight = 100
      Physics.airResistance = 5
      Physics.movementThreshold = 0.001
      Physics.correctAngles = true
      return Physics
    }())
    LIVE2DCUBISMFRAMEWORK.Physics = Physics
    var PhysicsParticle = (function () {
      function PhysicsParticle (initialPosition, mobility, delay, acceleration, radius) {
        this.initialPosition = initialPosition
        this.mobility = mobility
        this.delay = delay
        this.acceleration = acceleration
        this.radius = radius
        this.position = initialPosition
        this.lastPosition = this.position
        this.lastGravity = new PhysicsVector2(0, -1)
        this.force = new PhysicsVector2(0, 0)
        this.velocity = new PhysicsVector2(0, 0)
      }
      return PhysicsParticle
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsParticle = PhysicsParticle
    var PhysicsFactorTuple = (function () {
      function PhysicsFactorTuple (x, y, angle) {
        this.x = x
        this.y = y
        this.angle = angle
      }
      PhysicsFactorTuple.prototype.add = function (factor) {
        var x = this.x + factor.x
        var y = this.y + factor.y
        var angle = this.angle + factor.angle
        return new PhysicsFactorTuple(x, y, angle)
      }
      return PhysicsFactorTuple
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsFactorTuple = PhysicsFactorTuple
    var PhysicsNormalizationTuple = (function () {
      function PhysicsNormalizationTuple (minimum, maximum, def) {
        this.minimum = minimum
        this.maximum = maximum
        this.def = def
      }
      return PhysicsNormalizationTuple
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsNormalizationTuple = PhysicsNormalizationTuple
    var PhysicsNormalizationOptions = (function () {
      function PhysicsNormalizationOptions (position, angle) {
        this.position = position
        this.angle = angle
      }
      return PhysicsNormalizationOptions
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsNormalizationOptions = PhysicsNormalizationOptions
    var PhysicsInput = (function () {
      function PhysicsInput (targetId, weight, factor, invert) {
        this.targetId = targetId
        this.weight = weight
        this.factor = factor
        this.invert = invert
      }
      Object.defineProperty(PhysicsInput.prototype, 'normalizedWeight', {
        get: function () {
          return Physics.clampScalar(this.weight / Physics.maximumWeight, 0, 1)
        },
        enumerable: true,
        configurable: true
      })
      PhysicsInput.prototype.evaluateFactor = function (parameterValue, parameterMinimum, parameterMaximum, parameterDefault, normalization) {
        console.assert(parameterMaximum > parameterMinimum)
        var parameterMiddle = this.getMiddleValue(parameterMinimum, parameterMaximum)
        var value = parameterValue - parameterMiddle
        switch (Math.sign(value)) {
          case 1:
            {
              const parameterRange = parameterMaximum - parameterMiddle
              if (parameterRange === 0) {
                value = normalization.angle.def
              } else {
                const normalizationRange = normalization.angle.maximum - normalization.angle.def
                if (normalizationRange === 0) {
                  value = normalization.angle.maximum
                } else {
                  value *= Math.abs(normalizationRange / parameterRange)
                  value += normalization.angle.def
                }
              }
            }
            break
          case -1:
            {
              const parameterRange = parameterMiddle - parameterMinimum
              if (parameterRange === 0) {
                value = normalization.angle.def
              } else {
                const normalizationRange = normalization.angle.def - normalization.angle.minimum
                if (normalizationRange === 0) {
                  value = normalization.angle.minimum
                } else {
                  value *= Math.abs(normalizationRange / parameterRange)
                  value += normalization.angle.def
                }
              }
            }
            break
          case 0:
            value = normalization.angle.def
            break
        }
        var weight = (this.weight / Physics.maximumWeight)
        value *= (this.invert) ? 1 : -1
        return new PhysicsFactorTuple(value * this.factor.x * weight, value * this.factor.y * weight, value * this.factor.angle * weight)
      }
      PhysicsInput.prototype.getRangeValue = function (min, max) {
        var maxValue = Math.max(min, max)
        var minValue = Math.min(min, max)
        return Math.abs(maxValue - minValue)
      }
      PhysicsInput.prototype.getMiddleValue = function (min, max) {
        var minValue = Math.min(min, max)
        return minValue + (this.getRangeValue(min, max) / 2)
      }
      return PhysicsInput
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsInput = PhysicsInput
    var PhysicsOutput = (function () {
      function PhysicsOutput (targetId, particleIndex, weight, angleScale, factor, invert) {
        this.targetId = targetId
        this.particleIndex = particleIndex
        this.weight = weight
        this.factor = factor
        this.invert = invert
        this.factor.angle *= angleScale
      }
      Object.defineProperty(PhysicsOutput.prototype, 'normalizedWeight', {
        get: function () {
          return Physics.clampScalar(this.weight / Physics.maximumWeight, 0, 1)
        },
        enumerable: true,
        configurable: true
      })
      PhysicsOutput.prototype.evaluateValue = function (translation, particles) {
        var value = (translation.x * this.factor.x) + (translation.y * this.factor.y)
        if (this.factor.angle > 0) {
          var parentGravity = Physics.gravity
          if (Physics.correctAngles && this.particleIndex > 1) {
            parentGravity = particles[this.particleIndex - 2].position
              .substract(particles[this.particleIndex - 1].position)
          }
          var angleResult = (Physics.directionToRadians(parentGravity, translation))
          value += (((translation.x - parentGravity.x) > 0) ? -angleResult : angleResult) * this.factor.angle
        }
        value *= ((this.invert)
          ? -1
          : 1)
        return value
      }
      return PhysicsOutput
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsOutput = PhysicsOutput
    var PhysicsSubRig = (function () {
      function PhysicsSubRig (input, output, particles, normalization) {
        this.input = input
        this.output = output
        this.particles = particles
        this.normalization = normalization
      }
      PhysicsSubRig.prototype._update = function (deltaTime, target) {
        var _this = this
        var parameters = target.parameters
        var factor = new PhysicsFactorTuple(0, 0, 0)
        this.input.forEach(function (i) {
          var parameterIndex = parameters.ids.indexOf(i.targetId)
          if (parameterIndex === -1) {
            return
          }
          factor = factor.add(i.evaluateFactor(parameters.values[parameterIndex], parameters.minimumValues[parameterIndex], parameters.maximumValues[parameterIndex], parameters.defaultValues[parameterIndex], _this.normalization))
        })
        var a = Physics.degreesToRadians(-factor.angle)
        var xy = new PhysicsVector2(factor.x, factor.y).rotateByRadians(a)
        factor.x = xy.x
        factor.y = xy.y
        var factorRadians = a
        var gravityDirection = Physics
          .radiansToDirection(factorRadians)
          .normalize()
        this.particles.forEach(function (p, i) {
          if (i === 0) {
            p.position = new PhysicsVector2(factor.x, factor.y)
            return
          }
          p.force = gravityDirection.multiplyByScalar(p.acceleration).add(Physics.wind)
          p.lastPosition = p.position
          var delay = p.delay * deltaTime * 30
          var direction = p.position.substract(_this.particles[i - 1].position)
          var distance = PhysicsVector2.distance(PhysicsVector2.zero, direction)
          var angle = Physics.directionToDegrees(p.lastGravity, gravityDirection)
          var radians = Physics.degreesToRadians(angle) / Physics.airResistance
          direction = direction
            .rotateByRadians(radians)
            .normalize()
          p.position = _this.particles[i - 1].position.add(direction.multiplyByScalar(distance))
          var velocity = p.velocity.multiplyByScalar(delay)
          var force = p.force
            .multiplyByScalar(delay)
            .multiplyByScalar(delay)
          p.position = p.position
            .add(velocity)
            .add(force)
          var newDirection = p.position
            .substract(_this.particles[i - 1].position)
            .normalize()
          p.position = _this.particles[i - 1].position.add(newDirection.multiplyByScalar(p.radius))
          if (Math.abs(p.position.x) < Physics.movementThreshold) {
            p.position.x = 0
          }
          if (delay !== 0) {
            p.velocity = p.position
              .substract(p.lastPosition)
              .divideByScalar(delay)
              .multiplyByScalar(p.mobility)
          } else {
            p.velocity = PhysicsVector2.zero
          }
          p.force = PhysicsVector2.zero
          p.lastGravity = gravityDirection
        })
      }
      PhysicsSubRig.prototype._evaluate = function (target) {
        var _this = this
        var parameters = target.parameters
        this.output.forEach(function (o) {
          if (o.particleIndex < 1 || o.particleIndex >= _this.particles.length) {
            return
          }
          var parameterIndex = parameters.ids.indexOf(o.targetId)
          if (parameterIndex === -1) {
            return
          }
          var translation = _this.particles[o.particleIndex - 1].position.substract(_this.particles[o.particleIndex].position)
          var value = Physics.clampScalar(o.evaluateValue(translation, _this.particles), parameters.minimumValues[parameterIndex], parameters.maximumValues[parameterIndex])
          var unclampedParameterValue = (parameters.values[parameterIndex] * (1 - o.normalizedWeight)) + (value * o.normalizedWeight)
          parameters.values[parameterIndex] = Physics.clampScalar(unclampedParameterValue, parameters.minimumValues[parameterIndex], parameters.maximumValues[parameterIndex])
        })
      }
      return PhysicsSubRig
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsSubRig = PhysicsSubRig
    var PhysicsRig = (function () {
      function PhysicsRig (target, timeScale, physics3Json) {
        var _this = this
        this.timeScale = 1
        this.timeScale = timeScale
        this._target = target
        if (!target) {
          return
        }
        this._subRigs = []
        physics3Json.PhysicsSettings.forEach(function (r) {
          var input = []
          r.Input.forEach(function (i) {
            var factor = new PhysicsFactorTuple(1, 0, 0)
            if (i.Type === 'Y') {
              factor.x = 0
              factor.y = 1
            } else if (i.Type === 'Angle') {
              factor.x = 0
              factor.angle = 1
            }
            input.push(new PhysicsInput(i.Source.Id, i.Weight, factor, i.Reflect))
          })
          var output = []
          r.Output.forEach(function (o) {
            var factor = new PhysicsFactorTuple(1, 0, 0)
            if (o.Type === 'Y') {
              factor.x = 0
              factor.y = 1
            } else if (o.Type === 'Angle') {
              factor.x = 0
              factor.angle = 1
            }
            output.push(new PhysicsOutput(o.Destination.Id, o.VertexIndex, o.Weight, o.Scale, factor, o.Reflect))
          })
          var particles = []
          r.Vertices.forEach(function (p) {
            var initialPosition = new PhysicsVector2(p.Position.X, p.Position.Y)
            particles.push(new PhysicsParticle(initialPosition, p.Mobility, p.Delay, p.Acceleration, p.Radius))
          })
          var jsonOptions = r.Normalization
          var positionsOption = new PhysicsNormalizationTuple(jsonOptions.Position.Minimum, jsonOptions.Position.Maximum, jsonOptions.Position.Default)
          var anglesOption = new PhysicsNormalizationTuple(jsonOptions.Angle.Minimum, jsonOptions.Angle.Maximum, jsonOptions.Angle.Default)
          var normalization = new PhysicsNormalizationOptions(positionsOption, anglesOption)
          _this._subRigs.push(new PhysicsSubRig(input, output, particles, normalization))
        })
      }
      PhysicsRig.prototype.updateAndEvaluate = function (deltaTime) {
        var _this = this
        deltaTime *= ((this.timeScale > 0)
          ? this.timeScale
          : 0)
        if (deltaTime > 0.01) {
          this._subRigs.forEach(function (r) {
            r._update(deltaTime, _this._target)
          })
        }
        this._subRigs.forEach(function (r) {
          r._evaluate(_this._target)
        })
      }
      PhysicsRig._fromPhysics3Json = function (target, timeScale, physics3Json) {
        var rig = new PhysicsRig(target, timeScale, physics3Json)
        return (rig._isValid)
          ? rig
          : null
      }
      Object.defineProperty(PhysicsRig.prototype, '_isValid', {
        get: function () {
          return this._target != null
        },
        enumerable: true,
        configurable: true
      })
      return PhysicsRig
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsRig = PhysicsRig
    var PhysicsRigBuilder = (function () {
      function PhysicsRigBuilder () {
        this._timeScale = 1
      }
      PhysicsRigBuilder.prototype.setTarget = function (value) {
        this._target = value
        return this
      }
      PhysicsRigBuilder.prototype.setTimeScale = function (value) {
        this._timeScale = value
        return this
      }
      PhysicsRigBuilder.prototype.setPhysics3Json = function (value) {
        this._physics3Json = value
        return this
      }
      PhysicsRigBuilder.prototype.build = function () {
        return PhysicsRig._fromPhysics3Json(this._target, this._timeScale, this._physics3Json)
      }
      return PhysicsRigBuilder
    }())
    LIVE2DCUBISMFRAMEWORK.PhysicsRigBuilder = PhysicsRigBuilder
    var UserData = (function () {
      function UserData (target, userData3Json) {
        var _this = this
        this._target = target
        if (!target) {
          return
        }
        this._version = userData3Json.Version
        this._userDataCount = userData3Json.Meta.UserDataCount
        this._totalUserDataSize = userData3Json.Meta.TotalUserDataSize
        if (userData3Json.UserData != null) {
          this._userDataBodys = []
          userData3Json.UserData.forEach(function (u) {
            _this._userDataBodys.push(new UserDataBody(u.Target, u.Id, u.Value))
          })
          console.assert(this._userDataBodys.length === this._userDataCount)
        }
      }
      UserData._fromUserData3Json = function (target, userData3Json) {
        var userdata = new UserData(target, userData3Json)
        return (userdata._isValid)
          ? userdata
          : null
      }
      Object.defineProperty(UserData.prototype, '_isValid', {
        get: function () {
          return this._target != null
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(UserData.prototype, 'userDataCount', {
        get: function () {
          if (this._userDataBodys == null) { return 0 }
          return this._userDataCount
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(UserData.prototype, 'totalUserDataSize', {
        get: function () {
          if (this._userDataBodys == null) { return 0 }
          return this._totalUserDataSize
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(UserData.prototype, 'userDataBodys', {
        get: function () {
          if (this._userDataBodys == null) { return null }
          return this._userDataBodys
        },
        enumerable: true,
        configurable: true
      })
      UserData.prototype.isExistUserDataById = function (id_) {
        if (this._userDataBodys == null) { return false }
        for (var _i = 0, _a = this._userDataBodys; _i < _a.length; _i++) {
          var ud = _a[_i]
          if (ud.id === id_) { return true }
        }
        return false
      }
      UserData.prototype.getUserDataValueById = function (id_) {
        if (this._userDataBodys == null) { return null }
        for (var _i = 0, _a = this._userDataBodys; _i < _a.length; _i++) {
          var ud = _a[_i]
          if (ud.id === id_) { return ud.value }
        }
        return null
      }
      UserData.prototype.getUserDataTargetById = function (id_) {
        if (this._userDataBodys == null) { return null }
        for (var _i = 0, _a = this._userDataBodys; _i < _a.length; _i++) {
          var ud = _a[_i]
          if (ud.id === id_) { return ud.target }
        }
        return null
      }
      UserData.prototype.getUserDataBodyById = function (id_) {
        if (this._userDataBodys == null) { return null }
        for (var _i = 0, _a = this._userDataBodys; _i < _a.length; _i++) {
          var ud = _a[_i]
          if (ud.id === id_) { return ud }
        }
        return null
      }
      return UserData
    }())
    LIVE2DCUBISMFRAMEWORK.UserData = UserData
    var UserDataBuilder = (function () {
      function UserDataBuilder () {
      }
      UserDataBuilder.prototype.setTarget = function (value) {
        this._target = value
        return this
      }
      UserDataBuilder.prototype.setUserData3Json = function (value) {
        this._userData3Json = value
        return value
      }
      UserDataBuilder.prototype.build = function () {
        return UserData._fromUserData3Json(this._target, this._userData3Json)
      }
      return UserDataBuilder
    }())
    LIVE2DCUBISMFRAMEWORK.UserDataBuilder = UserDataBuilder
    var UserDataBody = (function () {
      function UserDataBody (target, id, value) {
        this.target = target
        this.id = id
        this.value = value
      }
      return UserDataBody
    }())
    LIVE2DCUBISMFRAMEWORK.UserDataBody = UserDataBody
    var UserDataTargetType;
    (function (UserDataTargetType) {
      UserDataTargetType[UserDataTargetType.UNKNOWN = 0] = 'UNKNOWN'
      UserDataTargetType[UserDataTargetType.ArtMesh = 1] = 'ArtMesh'
    })(UserDataTargetType || (UserDataTargetType = {}))
    var Groups = (function () {
      function Groups (model3Json) {
        var _this = this
        if (typeof (model3Json.Groups) !== 'undefined') {
          this._groupBodys = []
          model3Json.Groups.forEach(function (u) {
            _this._groupBodys.push(new GroupBody(u.Target, u.Name, u.Ids))
          })
        } else {
          this._groupBodys = null
        }
      }
      Object.defineProperty(Groups.prototype, 'data', {
        get: function () {
          if (this._groupBodys == null) { return null }
          return this._groupBodys
        },
        enumerable: true,
        configurable: true
      })
      Groups.fromModel3Json = function (model3Json) {
        return new Groups(model3Json)
      }
      Groups.prototype.getGroupById = function (targetId) {
        if (this._groupBodys != null) {
          for (var _i = 0, _a = this._groupBodys; _i < _a.length; _i++) {
            var body = _a[_i]
            if (body.name === targetId) { return body }
          }
        }
        return null
      }
      return Groups
    }())
    LIVE2DCUBISMFRAMEWORK.Groups = Groups
    var GroupBody = (function () {
      function GroupBody (target, name, ids) {
        this.target = target
        this.name = name
        this.ids = ids
      }
      return GroupBody
    }())
    LIVE2DCUBISMFRAMEWORK.GroupBody = GroupBody
  })(LIVE2DCUBISMFRAMEWORK || (LIVE2DCUBISMFRAMEWORK = {}))

  var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
      extendStatics = Object.setPrototypeOf ||
      ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b }) || // eslint-disable-line no-proto
      function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p] } // eslint-disable-line no-prototype-builtins
      return extendStatics(d, b)
    }
    return function (d, b) {
      extendStatics(d, b)
      function __ () { this.constructor = d }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __())
    }
  })()
  var LIVE2DCUBISMPIXI;
  (function (LIVE2DCUBISMPIXI) {
    var Model = (function (_super) {
      __extends(Model, _super)
      function Model (coreModel, textures, animator, physicsRig, userData, groups) {
        var _this = _super.call(this) || this
        _this._coreModel = coreModel
        _this._textures = textures
        _this._animator = animator
        _this._physicsRig = physicsRig
        _this._userData = userData
        _this._groups = groups
        _this._animator.groups = _this._groups
        if (_this._coreModel == null) {
          return _this
        }
        _this._meshes = new Array(_this._coreModel.drawables.ids.length)
        for (var m = 0; m < _this._meshes.length; ++m) {
          var uvs = _this._coreModel.drawables.vertexUvs[m].slice(0, _this._coreModel.drawables.vertexUvs[m].length)
          for (var v = 1; v < uvs.length; v += 2) {
            uvs[v] = 1 - uvs[v]
          }
          _this._meshes[m] = new CubismMesh(textures[_this._coreModel.drawables.textureIndices[m]], _this._coreModel.drawables.vertexPositions[m], uvs, _this._coreModel.drawables.indices[m], PIXI.DRAW_MODES.TRIANGLES)
          _this._meshes[m].name = _this._coreModel.drawables.ids[m]
          _this._meshes[m].scale.y *= -1
          _this._meshes[m].isCulling = !Live2DCubismCore.Utils.hasIsDoubleSidedBit(_this._coreModel.drawables.constantFlags[m])
          if (Live2DCubismCore.Utils.hasBlendAdditiveBit(_this._coreModel.drawables.constantFlags[m])) {
            if (_this._coreModel.drawables.maskCounts[m] > 0) {
              var addFilter = new PIXI.Filter()
              addFilter.blendMode = PIXI.BLEND_MODES.ADD
              _this._meshes[m].filters = [addFilter]
            } else {
              _this._meshes[m].blendMode = PIXI.BLEND_MODES.ADD
            }
          } else if (Live2DCubismCore.Utils.hasBlendMultiplicativeBit(_this._coreModel.drawables.constantFlags[m])) {
            if (_this._coreModel.drawables.maskCounts[m] > 0) {
              var multiplyFilter = new PIXI.Filter()
              multiplyFilter.blendMode = PIXI.BLEND_MODES.MULTIPLY
              _this._meshes[m].filters = [multiplyFilter]
            } else {
              _this._meshes[m].blendMode = PIXI.BLEND_MODES.MULTIPLY
            }
          }
          _this.addChild(_this._meshes[m])
        }
        ;
        _this._maskSpriteContainer = new MaskSpriteContainer(coreModel, _this)
        return _this
      }
      Object.defineProperty(Model.prototype, 'parameters', {
        get: function () {
          return this._coreModel.parameters
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'parts', {
        get: function () {
          return this._coreModel.parts
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'drawables', {
        get: function () {
          return this._coreModel.drawables
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'canvasinfo', {
        get: function () {
          return this._coreModel.canvasinfo
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'textures', {
        get: function () {
          return this._textures
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'animator', {
        get: function () {
          return this._animator
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'userData', {
        get: function () {
          return this._userData
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'meshes', {
        get: function () {
          return this._meshes
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'masks', {
        get: function () {
          return this._maskSpriteContainer
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(Model.prototype, 'groups', {
        get: function () {
          return this._groups
        },
        enumerable: true,
        configurable: true
      })
      Model.prototype.update = function (delta) {
        var _this = this
        var deltaTime = 0.016 * delta
        this._animator.updateAndEvaluate(deltaTime)
        if (this._physicsRig) {
          this._physicsRig.updateAndEvaluate(deltaTime)
        }
        this._coreModel.update()
        var sort = false
        for (var m = 0; m < this._meshes.length; ++m) {
          this._meshes[m].alpha = this._coreModel.drawables.opacities[m]
          this._meshes[m].visible = Live2DCubismCore.Utils.hasIsVisibleBit(this._coreModel.drawables.dynamicFlags[m])
          if (Live2DCubismCore.Utils.hasVertexPositionsDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
            this._meshes[m].vertices = this._coreModel.drawables.vertexPositions[m]
            this._meshes[m].dirtyVertex = true
          }
          if (Live2DCubismCore.Utils.hasRenderOrderDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
            sort = true
          }
        }
        if (sort) {
          this.children.sort(function (a, b) {
            var aIndex = _this._meshes.indexOf(a)
            var bIndex = _this._meshes.indexOf(b)
            var aRenderOrder = _this._coreModel.drawables.renderOrders[aIndex]
            var bRenderOrder = _this._coreModel.drawables.renderOrders[bIndex]
            return aRenderOrder - bRenderOrder
          })
        }
        this._coreModel.drawables.resetDynamicFlags()
      }
      Model.prototype.destroy = function (options) {
        if (this._coreModel !== null) {
          this._coreModel.release()
        }
        _super.prototype.destroy.call(this, options)
        this.masks.destroy()
        this._meshes.forEach(function (m) {
          m.destroy()
        })
        if (options === true || options.texture) {
          this._textures.forEach(function (t) {
            t.destroy()
          })
        }
      }
      Model.prototype.getModelMeshById = function (id) {
        if (this._meshes == null) { return null }
        for (var _i = 0, _a = this._meshes; _i < _a.length; _i++) {
          var mesh = _a[_i]
          if (mesh.name === id) { return mesh }
        }
        return null
      }
      Model.prototype.addParameterValueById = function (id, value) {
        var p = this._coreModel.parameters.ids.indexOf(id)
        if (p === -1) {
          return
        }
        this._coreModel.parameters.values[p] = this._coreModel.parameters.values[p] + value
      }
      Model._create = function (coreModel, textures, animator, physicsRig, userData, groups) {
        if (physicsRig === undefined) { physicsRig = null }
        if (userData === undefined) { userData = null }
        if (groups === undefined) { groups = null }
        var model = new Model(coreModel, textures, animator, physicsRig, userData, groups)
        if (!model.isValid) {
          model.destroy()
          return null
        }
        return model
      }
      Object.defineProperty(Model.prototype, 'isValid', {
        get: function () {
          return this._coreModel != null
        },
        enumerable: true,
        configurable: true
      })
      return Model
    }(PIXI.Container))
    LIVE2DCUBISMPIXI.Model = Model
    var MaskSpriteContainer = (function (_super) {
      __extends(MaskSpriteContainer, _super)
      function MaskSpriteContainer (coreModel, pixiModel) {
        var _this = _super.call(this) || this
        _this._maskShaderVertSrc = '\n            attribute vec2 aVertexPosition;\n            attribute vec2 aTextureCoord;\n            uniform mat3 projectionMatrix;\n            varying vec2 vTextureCoord;\n            void main(void){\n                gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n                vTextureCoord = aTextureCoord;\n            }\n            '
        _this._maskShaderFragSrc = '\n            varying vec2 vTextureCoord;\n            uniform sampler2D uSampler;\n            void main(void){\n                vec4 c = texture2D(uSampler, vTextureCoord);\n                c.r = c.a;\n                c.g = 0.0;\n                c.b = 0.0;\n                gl_FragColor = c;\n            }\n            '
        _this._maskShader = new PIXI.Filter(_this._maskShaderVertSrc.toString(), _this._maskShaderFragSrc.toString())
        var _maskCounts = coreModel.drawables.maskCounts
        var _maskRelationList = coreModel.drawables.masks
        _this._maskMeshContainers = []
        _this._maskTextures = []
        _this._maskSprites = []
        for (var m = 0; m < pixiModel.meshes.length; ++m) {
          if (_maskCounts[m] > 0) {
            var newContainer = new PIXI.Container()
            for (var n = 0; n < _maskRelationList[m].length; ++n) {
              var meshMaskID = coreModel.drawables.masks[m][n]
              var maskMesh = new CubismMesh(pixiModel.meshes[meshMaskID].texture, pixiModel.meshes[meshMaskID].vertices, pixiModel.meshes[meshMaskID].uvs, pixiModel.meshes[meshMaskID].indices, PIXI.DRAW_MODES.TRIANGLES)
              maskMesh.name = pixiModel.meshes[meshMaskID].name
              maskMesh.transform = pixiModel.meshes[meshMaskID].transform
              maskMesh.worldTransform = pixiModel.meshes[meshMaskID].worldTransform
              maskMesh.localTransform = pixiModel.meshes[meshMaskID].localTransform
              maskMesh.isCulling = pixiModel.meshes[meshMaskID].isCulling
              maskMesh.isMaskMesh = true
              maskMesh.filters = [_this._maskShader]
              newContainer.addChild(maskMesh)
            }
            newContainer.transform = pixiModel.transform
            newContainer.worldTransform = pixiModel.worldTransform
            newContainer.localTransform = pixiModel.localTransform
            _this._maskMeshContainers.push(newContainer)
            var newTexture = PIXI.RenderTexture.create(0, 0)
            _this._maskTextures.push(newTexture)
            var newSprite = new PIXI.Sprite(newTexture)
            _this._maskSprites.push(newSprite)
            _this.addChild(newSprite)
            pixiModel.meshes[m].mask = newSprite
          }
        }
        return _this
      }
      Object.defineProperty(MaskSpriteContainer.prototype, 'maskSprites', {
        get: function () {
          return this._maskSprites
        },
        enumerable: true,
        configurable: true
      })
      Object.defineProperty(MaskSpriteContainer.prototype, 'maskMeshes', {
        get: function () {
          return this._maskMeshContainers
        },
        enumerable: true,
        configurable: true
      })
      MaskSpriteContainer.prototype.destroy = function (options) {
        this._maskSprites.forEach(function (m) {
          m.destroy()
        })
        this._maskTextures.forEach(function (m) {
          m.destroy()
        })
        this._maskMeshContainers.forEach(function (m) {
          m.destroy()
        })
        this._maskShader = null
      }
      MaskSpriteContainer.prototype.update = function (appRenderer) {
        for (var m = 0; m < this._maskSprites.length; ++m) {
          appRenderer.render(this._maskMeshContainers[m], this._maskTextures[m], true, null, false)
        }
      }
      MaskSpriteContainer.prototype.resize = function (viewWidth, viewHeight) {
        for (var m = 0; m < this._maskTextures.length; ++m) {
          this._maskTextures[m].resize(viewWidth, viewHeight, false)
        }
      }
      return MaskSpriteContainer
    }(PIXI.Container))
    LIVE2DCUBISMPIXI.MaskSpriteContainer = MaskSpriteContainer
    var ModelBuilder = (function () {
      function ModelBuilder () {
        this._textures = []
        this._timeScale = 1
        this._animatorBuilder = new LIVE2DCUBISMFRAMEWORK.AnimatorBuilder()
      }
      ModelBuilder.prototype.setMoc = function (value) {
        this._moc = value
        return this
      }
      ModelBuilder.prototype.setTimeScale = function (value) {
        this._timeScale = value
        return this
      }
      ModelBuilder.prototype.setPhysics3Json = function (value) {
        if (!this._physicsRigBuilder) {
          this._physicsRigBuilder = new LIVE2DCUBISMFRAMEWORK.PhysicsRigBuilder()
        }
        this._physicsRigBuilder.setPhysics3Json(value)
        return this
      }
      ModelBuilder.prototype.setUserData3Json = function (value) {
        if (!this._userDataBuilder) {
          this._userDataBuilder = new LIVE2DCUBISMFRAMEWORK.UserDataBuilder()
        }
        this._userDataBuilder.setUserData3Json(value)
        return this
      }
      ModelBuilder.prototype.addTexture = function (index, texture) {
        this._textures.splice(index, 0, texture)
        return this
      }
      ModelBuilder.prototype.addAnimatorLayer = function (name, blender, weight) {
        if (blender === undefined) { blender = LIVE2DCUBISMFRAMEWORK.BuiltinAnimationBlenders.OVERRIDE }
        if (weight === undefined) { weight = 1 }
        this._animatorBuilder.addLayer(name, blender, weight)
        return this
      }
      ModelBuilder.prototype.addGroups = function (groups) {
        this._groups = groups
        return this
      }
      ModelBuilder.prototype.buildFromModel3Json = function (loader, model3Obj, callbackFunc) {
        var _this = this
        var model3URL = model3Obj.url
        var modelDir = model3URL.substring(0, model3URL.lastIndexOf('/') + 1)
        var textureCount = 0
        if (typeof (model3Obj.data.FileReferences.Moc) !== 'undefined') { loader.add('moc', modelDir + model3Obj.data.FileReferences.Moc, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER }) }
        if (typeof (model3Obj.data.FileReferences.Textures) !== 'undefined') {
          model3Obj.data.FileReferences.Textures.forEach(function (element) {
            loader.add('texture' + textureCount, modelDir + element)
            textureCount++
          })
        }
        if (typeof (model3Obj.data.FileReferences.Physics) !== 'undefined') { loader.add('physics', modelDir + model3Obj.data.FileReferences.Physics, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON }) }
        if (typeof (model3Obj.data.FileReferences.UserData) !== 'undefined') { loader.add('userdata', modelDir + model3Obj.data.FileReferences.UserData, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON }) }
        if (typeof (model3Obj.data.Groups) !== 'undefined') { this._groups = LIVE2DCUBISMFRAMEWORK.Groups.fromModel3Json(model3Obj.data) }
        loader.load(function (loader, resources) {
          if (typeof (resources.moc) !== 'undefined') { _this.setMoc(Live2DCubismCore.Moc.fromArrayBuffer(resources.moc.data)) }
          if (typeof (resources['texture' + 0]) !== 'undefined') {
            for (var i = 0; i < textureCount; i++) { _this.addTexture(i, resources['texture' + i].texture) }
          }
          if (typeof (resources.physics) !== 'undefined') { _this.setPhysics3Json(resources.physics.data) }
          if (typeof (resources.userdata) !== 'undefined') { _this.setUserData3Json(resources.userdata.data) }
          var model = _this.build()
          callbackFunc(model)
        })
      }
      ModelBuilder.prototype.build = function () {
        var coreModel = Live2DCubismCore.Model.fromMoc(this._moc)
        if (coreModel == null) {
          return null
        }
        var animator = this._animatorBuilder
          .setTarget(coreModel)
          .setTimeScale(this._timeScale)
          .build()
        var physicsRig = null
        if (this._physicsRigBuilder) {
          physicsRig = this._physicsRigBuilder
            .setTarget(coreModel)
            .setTimeScale(this._timeScale)
            .build()
        }
        var userData = null
        if (this._userDataBuilder) {
          userData = this._userDataBuilder
            .setTarget(coreModel)
            .build()
        }
        return Model._create(coreModel, this._textures, animator, physicsRig, userData, this._groups)
      }
      return ModelBuilder
    }())
    LIVE2DCUBISMPIXI.ModelBuilder = ModelBuilder
    var CubismMesh = (function (_super) {
      __extends(CubismMesh, _super)
      function CubismMesh () {
        var _this = (_super !== null && _super.apply(this, arguments)) || this
        _this.isCulling = false
        _this.isMaskMesh = false
        return _this
      }
      CubismMesh.prototype._renderWebGL = function (renderer) {
        if (this.isMaskMesh === true) { renderer.state.setFrontFace(1) } else { renderer.state.setFrontFace(0) }
        if (this.isCulling === true) { renderer.state.setCullFace(1) } else { renderer.state.setCullFace(0) }
        _super.prototype._renderWebGL.call(this, renderer)
        renderer.state.setFrontFace(0)
      }
      return CubismMesh
    }(PIXI.mesh.Mesh))
    LIVE2DCUBISMPIXI.CubismMesh = CubismMesh
  })(LIVE2DCUBISMPIXI || (LIVE2DCUBISMPIXI = {}))

  class L2D {
    constructor (basePath) {
      this.basePath = basePath
      this.loader = new PIXI.loaders.Loader(this.basePath)
      this.animatorBuilder = new LIVE2DCUBISMFRAMEWORK.AnimatorBuilder()
      this.timeScale = 1
      this.models = {}
    }

    setPhysics3Json (value) {
      if (!this.physicsRigBuilder) {
        this.physicsRigBuilder = new LIVE2DCUBISMFRAMEWORK.PhysicsRigBuilder()
      }
      this.physicsRigBuilder.setPhysics3Json(value)

      return this
    }

    load (name, v) {
      if (!this.models[name]) {
        const modelDir = name + '/'
        const modelPath = name + '.model3.json'
        const textures = []
        let textureCount = 0
        const motionNames = []
        const modelNames = []

        // if (!modelNames.includes(name+'_model')){
        this.loader.add(name + '_model', modelDir + modelPath, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })
        modelNames.push(name + '_model')
        // }

        this.loader.load((loader, resources) => {
          const model3Obj = resources[name + '_model'].data

          if (typeof (model3Obj.FileReferences.Moc) !== 'undefined') {
            loader.add(name + '_moc', modelDir + model3Obj.FileReferences.Moc, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER })
          }

          if (typeof (model3Obj.FileReferences.Textures) !== 'undefined') {
            model3Obj.FileReferences.Textures.forEach((element) => {
              loader.add(name + '_texture' + textureCount, modelDir + element)
              textureCount++
            })
          }

          if (typeof (model3Obj.FileReferences.Physics) !== 'undefined') {
            loader.add(name + '_physics', modelDir + model3Obj.FileReferences.Physics, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })
          }

          if (typeof (model3Obj.FileReferences.Motions) !== 'undefined') {
            for (const group in model3Obj.FileReferences.Motions) {
              model3Obj.FileReferences.Motions[group].forEach((element) => {
                const motionName = element.File.split('/').pop().split('.').shift()
                if (!motionNames.includes(name + '_' + motionName)) {
                  loader.add(name + '_' + motionName, modelDir + element.File, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })
                  motionNames.push(name + '_' + motionName)
                } else {
                  var n = name + '_' + motionName + String(Date.now())
                  loader.add(n, modelDir + element.File, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })
                  motionNames.push(name + '_' + motionName)
                }
              })
            }
          }

          let groups = null
          if (typeof (model3Obj.Groups) !== 'undefined') {
            groups = LIVE2DCUBISMFRAMEWORK.Groups.fromModel3Json(model3Obj)
          }

          loader.load((l, r) => {
            let moc = null
            if (typeof (r[name + '_moc']) !== 'undefined') {
              moc = Live2DCubismCore.Moc.fromArrayBuffer(r[name + '_moc'].data)
            }

            if (typeof (r[name + '_texture' + 0]) !== 'undefined') {
              for (let i = 0; i < textureCount; i++) {
                textures.splice(i, 0, r[name + '_texture' + i].texture)
              }
            }

            if (typeof (r[name + '_physics']) !== 'undefined') {
              this.setPhysics3Json(r[name + '_physics'].data)
            }

            const motions = new Map()
            motionNames.forEach((element) => {
              const n = element.split(name + '_').pop()
              motions.set(n, LIVE2DCUBISMFRAMEWORK.Animation.fromMotion3Json(r[element].data))
            })

            let model = null
            const coreModel = Live2DCubismCore.Model.fromMoc(moc)
            if (coreModel == null) {
              return
            }

            const animator = this.animatorBuilder
              .setTarget(coreModel)
              .setTimeScale(this.timeScale)
              .build()

            const physicsRig = this.physicsRigBuilder
              .setTarget(coreModel)
              .setTimeScale(this.timeScale)
              .build()

            const userData = null

            model = LIVE2DCUBISMPIXI.Model._create(coreModel, textures, animator, physicsRig, userData, groups)
            model.motions = motions
            this.models[name] = model

            v.changeCanvas(model)
          })
        })
      } else {
        v.changeCanvas(this.models[name])
      }
    }
  }
  class Live2dV3 { // eslint-disable-line no-unused-vars
    constructor ({ basePath, modelName, width = 500, height = 300, el, sizeLimit, mobileLimit, sounds }) {
      if (typeof Live2DCubismCore === 'undefined') {
        console.error('live2dv3 failed to load:\nMissing live2dcubismcore.js\nPlease add "https://cdn.jsdelivr.net/gh/HCLonely/Live2dV3/js/live2dcubismcore.min.js" to the "<script>" tag.\nLook at https://github.com/HCLonely/Live2dV3')
        return
      }
      if (typeof PIXI === 'undefined') {
        console.error('live2dv3 failed to load:\nMissing pixi.js\nPlease add "https://cdn.jsdelivr.net/npm/pixi.js@4.6.1/dist/pixi.min.js" to the "<script>" tag.\nLook at https://github.com/HCLonely/Live2dV3')
        return
      }
      if (!el) {
        console.error('"el" parameter is required')
        return
      }

      if (!this.isDom(el)) {
        if (el.length > 0) {
          if (this.isDom(el[0])) {
            el = el[0]
          } else {
            console.error('live2dv3 failed to load:\n', el[0], 'is not a HTMLElement object')
            return
          }
        } else {
          console.error('live2dv3 failed to load:\n', el, 'is not a HTMLElement object')
          return
        }
      }

      if (sizeLimit && (document.documentElement.clientWidth < width || document.documentElement.clientHeight < height)) return
      if (mobileLimit && /Mobile|Mac OS|Android|iPhone|iPad/i.test(navigator.userAgent)) return

      window.console.log('Live2dV3: loading model "' + modelName + '"')

      this.l2d = new L2D(basePath)

      this.canvas = el

      if (modelName) {
        this.modelName = modelName
        this.l2d.load(modelName, this)
      }

      this.app = new PIXI.Application(width, height, { transparent: true })
      this.canvas.appendChild(this.app.view)

      this.app.ticker.add((deltaTime) => {
        if (!this.model) {
          return
        }

        this.model.update(deltaTime)
        this.model.masks.update(this.app.renderer)
      })
      window.onresize = (event) => {
        if (event === undefined) { event = null }
        this.app.view.style.width = width + 'px'
        this.app.view.style.height = height + 'px'
        this.app.renderer.resize(width, height)

        if (this.model) {
          this.model.position = new PIXI.Point((width * 0.5), (height * 0.5))
          this.model.scale = new PIXI.Point((this.model.position.x * 1.3), (this.model.position.x * 1.3)) //模型尺寸
          this.model.masks.resize(this.app.view.width, this.app.view.height)
        }
      }
      this.isClick = false
      this.app.view.addEventListener('mousedown', (event) => {
        this.isClick = true
      })
      this.app.view.addEventListener('mousemove', (event) => {
        if (this.isClick) {
          this.isClick = false
          if (this.model) {
            this.model.inDrag = true
          }
        }

        if (this.model) {
          const mouseX = this.model.position.x - event.offsetX
          const mouseY = this.model.position.y - event.offsetY
          this.model.pointerX = -mouseX / this.app.view.height
          this.model.pointerY = -mouseY / this.app.view.width
        }
      })
      this.app.view.addEventListener('mouseup', (event) => {
        if (!this.model) {
          return
        }

        if (this.isClick) {
          if (this.isHit('TouchHead', event.offsetX, event.offsetY)) {
            this.startAnimation('touch_head', 'base')
          } else if (this.isHit('TouchSpecial', event.offsetX, event.offsetY)) {
            this.startAnimation('touch_special', 'base')
          } else {
            const bodyMotions = ['touch_body', 'main_1', 'main_2', 'main_3']
            const currentMotion = bodyMotions[Math.floor(Math.random() * bodyMotions.length)]
            this.startAnimation(currentMotion, 'base')
          }
          if (sounds && sounds.length > 0) {
            const soundFile = sounds[Math.floor((Math.random() * sounds.length))]
            const filePath = /^https?:\/\//.test(soundFile) ? soundFile : [basePath, modelName, soundFile].join('/').replace(/(?<!:)\/\//g, '/')
            if (typeof Howl !== 'undefined') {
              new Howl({ src: [filePath] }).play()
            } else if (typeof Audio !== 'undefined') {
              new Audio(filePath).play()
            } else {
              console.error('Current browser does not support playing sound.')
            }
          }
        }

        this.isClick = false
        this.model.inDrag = false
      })
    }

    changeCanvas (model) {
      this.app.stage.removeChildren()

      this.model = model
      this.model.update = this.onUpdate
      this.model.animator.addLayer('base', LIVE2DCUBISMFRAMEWORK.BuiltinAnimationBlenders.OVERRIDE, 1)

      this.app.stage.addChild(this.model)
      this.app.stage.addChild(this.model.masks)

      window.onresize()
    }

    onUpdate (delta) {
      const deltaTime = 0.016 * delta

      if (!this.animator.isPlaying) {
        const m = this.motions.get('idle')
        this.animator.getLayer('base').play(m)
      }
      this._animator.updateAndEvaluate(deltaTime)

      if (this.inDrag) {
        this.addParameterValueById('ParamAngleX', this.pointerX * 30)
        this.addParameterValueById('ParamAngleY', -this.pointerY * 30)
        this.addParameterValueById('ParamBodyAngleX', this.pointerX * 10)
        this.addParameterValueById('ParamBodyAngleY', -this.pointerY * 10)
        this.addParameterValueById('ParamEyeBallX', this.pointerX)
        this.addParameterValueById('ParamEyeBallY', -this.pointerY)
      }

      if (this._physicsRig) {
        this._physicsRig.updateAndEvaluate(deltaTime)
      }

      this._coreModel.update()

      let sort = false
      for (let m = 0; m < this._meshes.length; ++m) {
        this._meshes[m].alpha = this._coreModel.drawables.opacities[m]
        this._meshes[m].visible = Live2DCubismCore.Utils.hasIsVisibleBit(this._coreModel.drawables.dynamicFlags[m])
        if (Live2DCubismCore.Utils.hasVertexPositionsDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
          this._meshes[m].vertices = this._coreModel.drawables.vertexPositions[m]
          this._meshes[m].dirtyVertex = true
        }
        if (Live2DCubismCore.Utils.hasRenderOrderDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
          sort = true
        }
      }

      if (sort) {
        this.children.sort((a, b) => {
          const aIndex = this._meshes.indexOf(a)
          const bIndex = this._meshes.indexOf(b)
          const aRenderOrder = this._coreModel.drawables.renderOrders[aIndex]
          const bRenderOrder = this._coreModel.drawables.renderOrders[bIndex]

          return aRenderOrder - bRenderOrder
        })
      }

      this._coreModel.drawables.resetDynamicFlags()
    }

    startAnimation (motionId, layerId) {
      if (!this.model) {
        return
      }

      const m = this.model.motions.get(motionId)
      if (!m) {
        return
      }

      const l = this.model.animator.getLayer(layerId)
      if (!l) {
        return
      }

      l.play(m)
    }

    isHit (id, posX, posY) {
      if (!this.model) {
        return false
      }

      const m = this.model.getModelMeshById(id)
      if (!m) {
        return false
      }

      const vertexOffset = 0
      const vertexStep = 2
      const vertices = m.vertices

      let left = vertices[0]
      let right = vertices[0]
      let top = vertices[1]
      let bottom = vertices[1]

      for (let i = 1; i < 4; ++i) {
        const x = vertices[vertexOffset + i * vertexStep]
        const y = vertices[vertexOffset + i * vertexStep + 1]

        if (x < left) {
          left = x
        }
        if (x > right) {
          right = x
        }
        if (y < top) {
          top = y
        }
        if (y > bottom) {
          bottom = y
        }
      }

      const mouseX = m.worldTransform.tx - posX
      const mouseY = m.worldTransform.ty - posY
      const tx = -mouseX / m.worldTransform.a
      const ty = -mouseY / m.worldTransform.d

      return ((left <= tx) && (tx <= right) && (top <= ty) && (ty <= bottom))
    }

    isDom (e) {
      if (typeof HTMLElement === 'object') {
        return e instanceof HTMLElement
      } else {
        return e && typeof e === 'object' && e.nodeType === 1 && typeof e.nodeName === 'string'
      }
    }

    loadModel (modelName) {
      this.l2d.load(modelName || this.modelName, this)
    }
  }
  const VERSION = '1.2.2'
  let _a
  if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
    const args = [
      '\n\n       %c %c %c \u2730 Live2dV3 ' + VERSION + ' \u2730  %c  \n%c  https://github.com/HCLonely/Live2dV3  %c\n\n',
      'background: #ff66a5; padding:5px 0;',
      'background: #ff66a5; padding:5px 0;',
      'color: #ff66a5; background: #030307; padding:5px 0;',
      'background: #ff66a5; padding:5px 0;',
      'background: #ffc3dc; padding:5px 0;',
      'background: #ff66a5; padding:5px 0;'];
    (_a = window.console).log.apply(_a, args)
  } else if (window.console) {
    window.console.log('Live2dV3 ' + VERSION + ' - https://github.com/HCLonely/Live2dV3')
  }

  window.l2dViewer = function (options) {
    return new Live2dV3(options)
  }
})()
