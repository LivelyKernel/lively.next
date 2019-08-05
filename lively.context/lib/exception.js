/*global global, module*/
import { arr } from "lively.lang";
import { Scope, Frame, Function as AcornFunction } from "./interpreter.js";
import { getCurrentASTRegistry } from "lively.context";
import { acorn } from "lively.ast";

export function __createClosure(namespace, idx, parentFrameState, f) {
  // FIXME: Either save idx and use __getClosure later or attach the AST here and now (code dup.)?
  var registry = getCurrentASTRegistry();
  f._cachedAst = registry && registry[namespace] && registry[namespace][idx];
  // parentFrameState = [computedValues, varMapping, parentParentFrameState]
  f._cachedScopeObject = parentFrameState;
  f.livelyDebuggingEnabled = true;
  return f;
}

window.__createClosure = __createClosure;

// FIXME naming -- actually we return the ast node not a closure
export function __getClosure(namespace, idx) {
  var subRegistry = getCurrentASTRegistry()[namespace];
  return (subRegistry != null ? subRegistry[idx] : null); // ast
}

export class UnwindException {

    constructor(error) {
      this.error = error;
      error.unwindException = this;
      this.frameInfo = [];
    }

    get isUnwindException() { return true }

    toString() {
      return '[UNWIND] ' + this.error.toString();
    }

    storeFrameInfo(/*...*/) {
        this.frameInfo.push(arguments);
    }

    recreateFrames() {
        this.frameInfo.forEach(function(frameInfo) {
            this.createAndShiftFrame.apply(this, arr.from(frameInfo));
        }, this);
        this.frameInfo = [];
        return this;
    }

    createAndShiftFrame(thiz, args, frameState, lastNodeAstIndex, namespaceForOrigAst, pointerToOriginalAst) {
        var topScope = Scope.recreateFromFrameState(frameState),
            alreadyComputed = frameState[0],
            func = new AcornFunction(__getClosure(namespaceForOrigAst, pointerToOriginalAst), topScope),
            frame = Frame.create(func /*, varMapping */),
            pc;
        frame.setThis(thiz);
        if (frame.func.node && frame.func.node.type != 'Program')
            frame.setArguments(args);
        frame.setAlreadyComputed(alreadyComputed);
        if (!this.top) {
            pc = this.error && acorn.walk.findNodeByAstIndex(frame.getOriginalAst(),
                this.error.astIndex ? this.error.astIndex : lastNodeAstIndex);
        } else {
            if (frame.isAlreadyComputed(lastNodeAstIndex)) lastNodeAstIndex++;
            pc = acorn.walk.findNodeByAstIndex(frame.getOriginalAst(), lastNodeAstIndex);
        }
        frame.setPC(pc);
        frame.setScope(topScope);

        return this.shiftFrame(frame, true);
    }

    shiftFrame(frame, isRecreating) {
        if (!isRecreating)
            this.recreateFrames();
        if (!frame.isResuming()) console.log('Frame without PC found!', frame);
        if (!this.top) {
            this.top = this.last = frame;
        } else {
            this.last.setParentFrame(frame);
            this.last = frame;
        }
        return frame;
    }

    unshiftFrame() {
        this.recreateFrames();
        if (!this.top) return;

        var frame = this.top,
            prevFrame;
        while (frame.getParentFrame()) {
            prevFrame = frame;
            frame = frame.getParentFrame();
        }
        if (prevFrame) { // more then one frame
            prevFrame.setParentFrame(undefined);
            this.last = prevFrame;
        } else {
            this.top = this.last = undefined;
        }
        return frame;
    }

}

// fixme: User proper reqriting that does not depend on global var
window.UnwindException = UnwindException;
