import { HTMLMorph } from 'lively.morphic';
import { pt } from 'lively.graphics';

/**
 * A VideoMorph, which is just an overlay on the HTML Video element
 * This is a subclass of the HTMLMorph, and so it inherits all of the HTMLMorph's
 * properties.
 * properties (should be in the constructor)
 *   - src: url for the video
 *   - type: type of the video (mp4, ogg, etc)
 *   - controls: true/false to show not/show the controls (default false)
 *   - loop: true/false to play on a loop (default true)
 *   - autoplay: true/false to play on load (default true)
 *   - videoLayout:  one of 'autosize', 'autoaspect', 'none'. Default to autoaspect.
 *          If 'autosize', size the morph to the video's size.
 *          If 'autoaspect', resize to correct aspect ratio within current bounding box
 * methods:
 *    - startPlaying() -- start playing the video
 *    - stopPlaying() -- stop playing the video
 *    - rewind()  -- set the video counter to 0
 *
 * read-only properties:
 *     - videoDomElement -- the DOM element for the video
 *
 * Example:
 * // new VideoMorph({autoplay: false, src:'https://matt.engagelively.com/assets/ITF/New-creative-video-6-.mp4', videoLayout:'autosize'}).openInWorld()
 */

export class VideoMorph extends HTMLMorph {
  static get properties () {
    return {
      autoplay: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('autoplay', !!aBool);
        }
      },
      loop: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('loop', !!aBool);
        }
      },
      controls: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('controls', !!aBool);
        }
      },
      src: {
        defaultValue: 'https://matt.engagelively.com/assets/kaleidoscope-art-17141.mp4',
        set (srcURL) {
          this.setVideoProperty('src', srcURL);
          this.videoLoaded = false;
        }
      },
      codec: {
        defaultValue: 'video/mp4',
        set (videoType) {
          this.setVideoProperty('codec', videoType);
        }
      },
      videoLayout: {
        defaultValue: 'autoaspect',
        set (aLayoutStyle) {
          const choices = ['none', 'autoaspect', 'autosize'];
          const index = choices.indexOf(aLayoutStyle);
          const choice = index >= 0 ? choices[index] : 'none';
          this.setProperty('videoLayout', choice);
          this.resizeToExtentProperties();
        }

      }

    };
  }

  constructor (props) {
    this.constructorProps = props;
    super(props);
  }

  setVideoProperty (propertyName, value) {
    this.setProperty(propertyName, value);
    this.resetHTML();
  }

  onLoad () {
    const props = this.constructorProps;
    this.log = [];
    this.autorelayout = true;
    this.videoLoaded = false;
    const setField = (field, defaultVal) => {
      this[field] = props && props[field] ? props[field] : defaultVal;
      this.log.push([field, this[field]]);
    };
    const normalizeBoolean = field => {
      this[field] = props ? !!props[field] : false;
    };

    const bools = ['loop', 'controls', 'autoplay'];
    bools.forEach(bool => normalizeBoolean(bool));
    const fields = [
      { name: 'src', defaultVal: 'https://matt.engagelively.com/assets/kaleidoscope-art-17141.mp4' },
      { name: 'type', defaultVal: 'video/mp4' },
      { name: 'badBrowserMessage', defaultVal: 'Your browser does not support video content' },
      { name: 'loop', defaultVal: false },
      { name: 'autoplay', defaultVal: false },
      { name: 'controls', defaultVal: false }
    ];

    fields.forEach(field => setField(field.name, field.defaultVal));
    this.resetHTML();

    this.awaitingResize = false;

    this.autorelayout = false;
  }

  /**
   * Resize to the value of the extent property. Since the default behavior on
   * bounds change is to set videoLayout to 'none', and we don't want that
   * to happen in this case, set `autorelayout` to true to tell
   * onBoundsChanged() not to reset the videoLayout property.
   */
  resizeToExtentProperties () {
    this.whenRendered().then(_ => {
      this.autorelayout = true;
      if (this.videoLayout === 'autosize') {
        this.resizeToNaturalExtent();
      } else if (this.videoLayout === 'autoaspect') {
        this.resizeToFitVideo();
      }

      this.autorelayout = false;
    });
  }

  get domElementExtent () {
    return this.videoDomElement ? pt(this.videoDomElement.width, this.videoDomElement.height) : null;
  }

  onBoundsChanged (bounds) {
    super.onBoundsChanged(bounds);
    try {
      if (!this.autorelayout) {
      // once a user has resized, this turns off auto-resizing to accommodate the video
      // the autorelayout flag is set by the resize methods to ensure that this
      // won't happen when we are resizing to accommodate a video
        this.videoLayout = 'none';
      }

      if (this.bounds().extent().eqPt(this.domElementExtent)) {
        return;
      }
    } catch (error) {
      return;
    }
    this.resetHTML();
  }

  init () {
    this.resetHTML();
    this.startPlaying();
  }

  get videoDomElement () {
    return this.domNode.querySelectorAll('video')[0];
  }

  get naturalExtent () {
    if (this.videoDomElement) {
      return pt(this.videoDomElement.videoWidth, this.videoDomElement.videoHeight);
    } else {
      return pt(10, 10);
    }
  }

  resizeToNaturalExtent () {
    if (this.videoLoaded) {
      this.extent = this.naturalExtent;
    } else {
    }
  }

  resizeToFitVideo () {
    const videoExtent = this.naturalExtent;
    const widthRatio = this.width / videoExtent.x;
    const heightRatio = this.height / videoExtent.y;
    // remain within the current bounding box, but shrink one dimension so
    // this.width/this.height = video.extent.x/video.extent.y
    if (heightRatio > widthRatio) {
      // morph is too tall for the video
      this.extent = pt(this.extent.x, videoExtent.y * widthRatio);
    } else if (widthRatio > heightRatio) {
      // morph is too wide for the video
      this.extent = pt(videoExtent.x * heightRatio, this.extent.y);
    }
  }

  rewind () {
    this.videoDomElement.currentTime = 0;
  }

  startPlaying () {
    this.videoDomElement.play();
  }

  pausePlaying () {
    this.videoDomElement.pause();
  }

  stopPlaying () {
    this.videoDomElement.pause();
    this.videoDomElement.currentTime = 0;
  }

  resetHTML () {
    const options = ` ${this.loop ? 'loop' : ''} ${this.controls ? 'controls' : ''} ${this.autoplay ? 'autoplay' : ''}`;
    this.html = `
  <video id="${this.videoId}"  width = "100%" height="100%" style="object-fit: cover;"${options}>
  <source src="${this.src}"  type="${this.codec}"/> 
${this.badBrowserMessage}
</video>
`;
  }

  remove () {
    this.stopPlaying();
    super.remove();
  }

  menuItems () {
    return $world.defaultMenuItems(this);
  }
}
