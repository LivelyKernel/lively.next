/* global URL */
import { component, ShadowObject, Text, TilingLayout, add, part } from 'lively.morphic';
import { AbstractPromptModel, RedButton, GreenButton, LightPrompt } from 'lively.components/prompts.cp.js';
import { Color, pt } from 'lively.graphics';
import { InputLineDefault, LabeledCheckBox } from 'lively.components/inputs.cp.js';
import { InformIconOnLight } from 'lively.components/helpers.cp.js';
import { UserFlap } from 'lively.ide/studio/user-flap.cp.js';
import { connect } from 'lively.bindings';
import { rect } from 'lively.graphics/geometry-2d.js';
import { SaveWorldDialog } from 'lively.ide/studio/dialogs.cp.js';
import { without } from 'lively.morphic/components/core.js';

import { Label } from 'lively.morphic/text/label.js';
import { CheckBox } from 'lively.components/widgets.js';

class ProjectCreationPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      projectBrowser: {},
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'from remote checkbox', signal: 'checked', handler: 'onCheckbox' },
            { model: 'cancel button', signal: 'fire', handler: 'close' }
          ];
        }
      },
      label: 'Create new Project'
    };
  }

  close () {
    this.projectBrowser.toggleFader(true);
    this.view.remove();
  }

  resolve () {
    const inputElement = this.fromRemote ? this.ui.remoteUrl : this.ui.projectName;
    const inputString = inputElement.textString;
    if (this.fromRemote) {
      try {
        const url = new URL(inputString);
        if (url.host !== 'github.com') {
          inputElement.clear();
          inputElement.indicateError('enter github url');
          return;
        }
      } catch (err) {
        inputElement.indicateError('enter valid url');
      }
    } else {
      if (!inputString.match(/^[a-zA-Z-]*$/)) {
        inputElement.clear();
        inputElement.indicateError('enter valid name');
        return;
      }
      super.resolve(inputString);
    }
  }

  viewDidLoad () {
    if (!$world.currentUsertoken) {
      this.waitForLogin();
    } else this.projectNameMode();
    this.ui.promptTitle.textString = 'Configure new Project:';
    this.ui.okButton.submorphs[0].textString = 'Confirm';
  }

  waitForLogin () {
    this.ui.projectName.deactivate();
    this.ui.remoteUrl.deactivate();

    this.ui.userFlapContainer.visible = true;
    this.ui.userFlapContainer.animate({ duration: 500, borderColor: Color.red })
      .then(() => this.ui.userFlapContainer.animate({ duration: 500, borderColor: Color.transparent }))
      .then(() => this.ui.userFlapContainer.animate({ duration: 500, borderColor: Color.red }))
      .then(() => this.ui.userFlapContainer.animate({ duration: 500, borderColor: Color.transparent }));

    this.withoutBindingsDo(() => this.ui.fromRemoteCheckbox.disable());
    connect(this.ui.userFlap, 'onLogin', this, 'onLogin');
  }

  onLogin () {
    $world.get('user flap').showLoggedInUser();
    this.ui.userFlapContainer.visible = false;
    this.withoutBindingsDo(() => this.ui.fromRemoteCheckbox.enable());
    this.projectNameMode();
  }

  onCheckbox (fromRemote) {
    this.ui.remoteUrl.clearError();
    this.ui.projectName.clearError();
    this.ui.projectOwner.clearError();
    if (fromRemote) {
      this.remoteUrlMode();
    } else {
      this.projectNameMode();
    }
  }

  projectNameMode () {
    this.fromRemote = false;
    this.ui.projectName.activate();
    this.ui.projectOwner.activate();
    this.ui.remoteUrl.deactivate();
    this.ui.projectOwner.indicateError('required', 'github user name of the project owner');
    this.ui.projectName.indicateError('required', 'only - and letters are allowed');
  }

  remoteUrlMode () {
    this.fromRemote = true;
    this.ui.projectName.deactivate();
    this.ui.projectOwner.deactivate();
    this.ui.remoteUrl.activate();
    this.ui.remoteUrl.indicateError('required', 'must be the url to a github repository');
  }
}

class ProjectSavePrompt extends AbstractPromptModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'cancel button', signal: 'fire', handler: () => this.view.remove() },
            { target: 'minor check', signal: 'toggle', handler: (status) => this.increaseMinor = status },
            { target: 'major check', signal: 'toggle', handler: (status) => this.increaseMajor = status }
          ];
        }
      }
    };
  }

  async resolve () {
    const { description } = this.ui;
    const message = description.textString;

    let increaseLevel;
    if (this.increaseMajor) increaseLevel = 'major';
    else if (this.increaseMinor) increaseLevel = 'minor';
    else increaseLevel = 'patch';

    await $world.openedProject.save({ increaseLevel, message });
  }
}

export const ProjectCreationPrompt = component(LightPrompt, {
  defaultViewModel: ProjectCreationPromptModel,
  extent: pt(385, 345),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(15, 15, 0, 0),
    spacing: 16
  }),
  epiMorph: false,
  hasFixedPosition: true,
  viewModel: {
    label: ['Create New Project\n', {
      fontWeight: 'bold'
    }]
  },
  submorphs: [
    add({
      name: 'project creation form',
      extent: pt(318, 200),
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'column',
        hugContentsHorizontally: true,
        orderByIndex: true,
        resizePolicies: [['description', {
          height: 'fill',
          width: 'fill'
        }]],
        spacing: 5
      }),
      submorphs: [
        {
          name: 'user flap container',
          visible: false,
          clipMode: 'hidden',
          borderRadius: 20,
          borderWidth: 2,
          layout: new TilingLayout({
            align: 'center',
            orderByIndex: true
          }),
          extent: pt(318, 48.9),
          fill: Color.transparent,
          submorphs: [
            part(UserFlap)
          ]

        },
        {
          fill: Color.transparent,
          layout: new TilingLayout({
            align: 'center',
            axisAlign: 'center'
          }),
          submorphs: [
            part(LabeledCheckBox, { name: 'from remote checkbox', viewModel: { label: 'Initialize from Remote?' } }),
            part(InformIconOnLight, { viewModel: { information: 'Should the project be initialized from an existing remote repository?' } })
          ]
        },
        part(InputLineDefault, { name: 'remote url', placeholder: 'URL' }),
        part(InputLineDefault, {
          name: 'project name',
          placeholder: 'Project Name',
          submorphs: [{
            name: 'placeholder',
            extent: pt(142, 34),
            fontFamily: '"IBM Plex Sans",Sans-Serif',
            nativeCursor: 'text',
            textAndAttributes: ['Project Name', null]
          }]
        }), part(InputLineDefault, {
          name: 'project owner',
          placeholder: 'Project Owner',
          submorphs: [{
            name: 'placeholder',
            extent: pt(142, 34),
            fontFamily: '"IBM Plex Sans",Sans-Serif',
            nativeCursor: 'text',
            textAndAttributes: ['Project Owner', null]
          }]
        }),
        {
          name: 'description',
          type: Text,
          master: InputLineDefault,
          textAndAttributes: ['Description of the Project', null],
          lineWrapping: 'by-words',
          readOnly: false,
          fixedHeight: true,
          fixedWidth: true
        }
      ]
    }), add({
      name: 'button wrapper',
      extent: pt(331, 48.9),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        align: 'center',
        orderByIndex: true,
        reactToSubmorphAnimations: false,
        renderViaCSS: true,
        spacing: 20
      }),
      submorphs: [part(GreenButton, {
        name: 'ok  button',
        submorphs: [{ name: 'label', textString: 'Confirm' }]
      }),
      part(RedButton, {
        name: 'cancel button',
        submorphs: [{ name: 'label', textString: 'Cancel' }]
      })
      ]
    })]
});

export const SaveProjectDialog = component(SaveWorldDialog, {
  defaultViewModel: ProjectSavePrompt,
  submorphs: [{
    name: 'prompt title',
    nativeCursor: 'text',
    textAndAttributes: ['Save Project', null]
  }, {
    name: 'prompt controls',
    extent: pt(455.5, 180.5),
    submorphs: [without('third row'), without('second row'), without('first row'), add({
      name: 'second row',
      extent: pt(450, 70.3),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'right',
        axis: 'column',
        orderByIndex: true,
        padding: rect(0, 15, 0, -15),
        spacing: 11
      }),
      position: pt(-146, 28),
      submorphs: [{
        name: 'aMorph',
        borderColor: Color.rgba(23, 160, 251, 0),
        borderWidth: 1,
        extent: pt(256.5, 31),
        fill: Color.rgba(255, 255, 255, 0),
        layout: new TilingLayout({
          orderByIndex: true
        }),
        position: pt(0, -1),
        submorphs: [{
          type: Label,
          name: 'description label',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontFamily: '"IBM Plex Sans"',
          fontSize: 15,
          nativeCursor: 'pointer',
          textAndAttributes: ['bump minor version:', null]
        }, {
          type: CheckBox,
          name: 'minor check',
          borderWidth: 0,
          position: pt(139, 0)
        }]
      }, {
        name: 'aMorph1',
        borderColor: Color.rgba(23, 160, 251, 0),
        borderWidth: 1,
        extent: pt(256.5, 29.5),
        fill: Color.rgba(255, 255, 255, 0),
        layout: new TilingLayout({
          orderByIndex: true
        }),
        position: pt(0, 63),
        submorphs: [{
          type: Label,
          name: 'description label',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontFamily: '"IBM Plex Sans"',
          fontSize: 15,
          nativeCursor: 'pointer',
          textAndAttributes: ['bump major version:', null]
        }, {
          type: CheckBox,
          name: 'major check',
          borderWidth: 0,
          position: pt(139, 0)
        }]
      }]
    }), {
      name: 'fourth row',
      submorphs: [{
        name: 'description',
        dropShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
        textAndAttributes: ['\n\
', null]

      }]
    }]
  }, {
    name: 'button wrapper',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(12, 12, 0, 0),
      spacing: 12
    })
  }]
});
