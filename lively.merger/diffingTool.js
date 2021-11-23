import { Morph } from 'lively.morphic/morph.js';
import { Tree, TreeData } from 'lively.components/tree.js';
import { pt } from 'lively.graphics/geometry-2d.js';
import { HorizontalLayout } from 'lively.morphic';
import { Color } from 'lively.graphics/color.js';
import { ProportionalLayout } from 'lively.morphic/layout.js';

export class DiffingTool extends Morph {
  constructor () {
    super();

    this._treeLeft = new Tree({
      borderColor: Color.red,
      borderWidth: 2,
      treeData: new TreeData()
    });
    this._treeRight = new Tree({
      borderColor: Color.blue,
      borderWidth: 2,
      treeData: new TreeData()
    });

    this.initialize();
  }

  initialize () {
    this.layout = new ProportionalLayout({
      submorphWidthPolicy: 'resize',
      submorphHeightPolicy: 'resize'
    });

    this.addMorph(this._treeLeft);
    this.addMorph(this._treeRight);

    this.extent = pt(300, 300);
  }

  set treeData ({ left: leftData, right: rightData }) {
    this.leftTreeData = leftData;
    this.rightTreeData = rightData;
  }

  set leftTreeData (data) {
    this._treeLeft.treeData = new TreeData(data);
    this._treeLeft.update();
  }

  set rightTreeData (data) {
    this._treeRight.treeData = new TreeData(data);
    this._treeRight.update();
  }
}
